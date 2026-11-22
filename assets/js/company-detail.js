const params     = new URLSearchParams(location.search);
const companyId  = params.get('id');
const root       = document.getElementById('main-content');
let company = null, currentUser = null;
let conversationId = null, historyRequest = 0;

(async () => {
  [company, currentUser] = await Promise.all([Companies.getById(companyId), navUser]);

  if (!company) {
    root.innerHTML = `<div class="not-found"><div class="not-found-icon">${Icon('factory')}</div><p>Şirket bulunamadı.</p><a href="network.html">${Icon('arrowLeft')} Ağa Dön</a></div>`;
    return;
  }

  document.title = 'GreenLoop – ' + company.name;
  renderPage();

  if (currentUser && String(company.userId) !== String(currentUser.id)) {
    await refreshContactHistory();
    startMessagePolling(refreshContactHistory, company.id);
  }
})();

function renderPage() {
  const webUrl = safeHttpUrl(company.web);
  const webLabel = escapeHtml(company.web);
  const emission = Math.min(100, Math.max(0, Number(company.emission) || 0));
  root.innerHTML = `
  <div class="hero">
    <div class="hero-inner">
      <div class="hero-avatar">${Icon(resolveCompanyIcon(company.icon))}</div>
      <div class="hero-info">
        <div class="company-name">${escapeHtml(company.name)}</div>
        <div class="company-meta">
          <span class="sector-badge">${escapeHtml(company.sector||'Sektör')}</span>
          <span class="meta-pill">${Icon('pin')} ${escapeHtml(company.il)} / ${escapeHtml(company.ilce)}</span>
          ${company.size ? `<span class="meta-pill">${Icon('users')} ${escapeHtml(company.size)} çalışan</span>` : ''}
          <span class="meta-pill">${Icon('calendar')} ${escapeHtml(company.date)}</span>
        </div>
      </div>
      <div class="hero-emission">
        <div class="emission-big">%${escapeHtml(company.emission||0)}</div>
        <div class="emission-lbl">Emisyon Azaltımı</div>
      </div>
    </div>
  </div>
  <div class="content">
    <div class="left-col">
      ${company.desc ? `<div class="section"><div class="section-title">${Icon('edit')} Şirket Hakkında</div><div class="desc-text">${escapeHtml(company.desc)}</div></div>` : ''}
      <div class="section">
        <div class="section-title">${Icon('component')} Kullandığı Hammaddeler</div>
        <div class="tag-list">${(company.inputs||[]).length ? company.inputs.map(t=>`<span class="stag in">${escapeHtml(t)}</span>`).join('') : '<span class="tag-empty">Belirtilmemiş</span>'}</div>
      </div>
      <div class="section">
        <div class="section-title">${Icon('recycle')} Ürettiği Atıklar</div>
        <div class="tag-list">${(company.outputs||[]).length ? company.outputs.map(t=>`<span class="stag out">${escapeHtml(t)}</span>`).join('') : '<span class="tag-empty">Belirtilmemiş</span>'}</div>
      </div>
      <div class="section">
        <div class="section-title">${Icon('chart')} Emisyon Azaltım Oranı</div>
        <div class="emission-value">%${emission}</div>
        <div class="em-bar-track" aria-hidden="true"><div class="em-bar-fill" id="em-bar"></div></div>
      </div>
      <div class="section">
        <div class="section-title">${Icon('clipboard')} Genel Bilgiler</div>
        <dl class="info-grid">
          <div class="info-item"><dt>Şehir</dt><dd class="val">${Icon('pin')} ${escapeHtml(company.il||'—')} / ${escapeHtml(company.ilce||'—')}</dd></div>
          <div class="info-item"><dt>Sektör</dt><dd class="val">${escapeHtml(company.sector||'—')}</dd></div>
          ${company.size ? `<div class="info-item"><dt>Çalışan</dt><dd class="val">${Icon('users')} ${escapeHtml(company.size)}</dd></div>` : ''}
          ${company.email ? `<div class="info-item"><dt>E-posta</dt><dd class="val">${escapeHtml(company.email)}</dd></div>` : ''}
          ${company.tel   ? `<div class="info-item"><dt>Telefon</dt><dd class="val">${escapeHtml(company.tel)}</dd></div>` : ''}
          ${company.web   ? `<div class="info-item"><dt>Web</dt><dd class="val">${webUrl ? `<a href="${escapeHtml(webUrl)}" target="_blank" rel="noopener noreferrer">${webLabel}</a>` : webLabel}</dd></div>` : ''}
          <div class="info-item"><dt>Eklenme Tarihi</dt><dd class="val">${escapeHtml(company.date||'—')}</dd></div>
        </dl>
      </div>
    </div>
    <div>
      <div class="contact-card">
        <div class="contact-head">
          <div class="contact-head-title">${Icon('chat')} İletişime Geç</div>
          <div class="contact-head-sub">${escapeHtml(company.name)} ile mesajlaşın</div>
        </div>
        <div class="contact-body" id="contact-body"></div>
      </div>
    </div>
  </div>`;

  setTimeout(() => { const bar = document.getElementById('em-bar'); if (bar) bar.style.width = emission + '%'; }, 100);
  renderContactBox();
}

function renderContactBox() {
  const body = document.getElementById('contact-body');
  if (!body) return;

  if (currentUser && String(company.userId) === String(currentUser.id)) {
    body.innerHTML = `<p class="contact-owner">Bu sizin şirketiniz.<br><a href="dashboard.html">Panele git ${Icon('arrowRight')}</a></p>`;
    return;
  }

  body.innerHTML = `
    <div id="contact-history" hidden></div>
    <div class="msg-box">
      <div class="msg-success" id="msg-ok" role="status">${Icon('check')} Mesajınız gönderildi!</div>
      <div class="msg-error"   id="msg-err" role="alert"></div>
      ${!currentUser ? `
        <div class="msg-field"><label for="m-name">Adınız *</label><input id="m-name" placeholder="Ad Soyad" autocomplete="name"/></div>
        <div class="msg-field"><label for="m-email">E-posta *</label><input id="m-email" type="email" placeholder="ornek@email.com" autocomplete="email"/></div>
        <div hidden><label for="m-website">Web sitesi</label><input id="m-website" name="website" autocomplete="off" tabindex="-1"/></div>` : ''}
      <div class="msg-field"><label for="m-text">Mesajınız *</label><textarea id="m-text" maxlength="5000" placeholder="Hammadde ihtiyacınız, atık teklifiniz veya iş birliği talebiniz..."></textarea></div>
      <button class="send-btn" id="send-btn" onclick="sendMsg()">Mesaj Gönder ${Icon('arrowRight')}</button>
      ${!currentUser ? `<p class="contact-hint">Yanıtları platformda almak için mesaj göndermeden önce <a href="login.html">giriş yapın</a>.</p>` : ''}
    </div>`;
}

async function refreshContactHistory() {
  const history = document.getElementById('contact-history');
  if (!currentUser || !history) return;
  const request = ++historyRequest;
  if (conversationId == null) {
    const threads = await Messages.getSentThreads();
    conversationId ??= threads.find(t => String(t.companyId) === String(company.id))?.conversationId;
  }
  if (conversationId == null || request !== historyRequest) return;
  const msgs = await Messages.getThreadMsgs(conversationId);
  if (!msgs || request !== historyRequest) return;
  history.hidden = !msgs.length;
  history.innerHTML = msgs.length ? `<div class="thread-box" id="thread-box">${msgs.map(m => {
    const isMe = !m.fromCompanyId && String(m.fromUserId) === String(currentUser.id);
    return `<div class="contact-message${isMe ? ' own' : ''}">
      <div class="cb ${isMe ? 'me' : 'them'}">${escapeHtml(m.text)}</div>
      <div class="cb-meta">${escapeHtml(m.fromName)} · ${escapeHtml(new Date(m.createdAt).toLocaleString('tr-TR'))}</div>
    </div>`;
  }).join('')}</div><div class="contact-divider"></div>` : '';
  const threadBox = document.getElementById('thread-box');
  if (threadBox) threadBox.scrollTop = threadBox.scrollHeight;
}

async function sendMsg() {
  const text   = document.getElementById('m-text')?.value.trim();
  const okEl   = document.getElementById('msg-ok');
  const errEl  = document.getElementById('msg-err');
  const btn    = document.getElementById('send-btn');
  if (btn.disabled) return;
  okEl.style.display = 'none'; errEl.style.display = 'none';

  if (!text) { errEl.innerHTML = Icon('warning') + ' Mesaj alanı boş olamaz.'; errEl.style.display = 'block'; return; }

  let fromName, fromEmail;
  if (currentUser) {
    fromName  = currentUser.ad + ' ' + currentUser.soyad;
    fromEmail = currentUser.email;
  } else {
    fromName  = document.getElementById('m-name')?.value.trim();
    fromEmail = document.getElementById('m-email')?.value.trim();
    if (!fromName) { errEl.innerHTML = Icon('warning') + ' Adınızı girin.'; errEl.style.display = 'block'; return; }
    if (!fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) { errEl.innerHTML = Icon('warning') + ' Geçerli bir e-posta girin.'; errEl.style.display = 'block'; return; }
  }

  const btnOrigHtml = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Gönderiliyor...';
  const data = { toCompanyId: company.id, fromName, fromEmail, text };
  if (!currentUser) data.website = document.getElementById('m-website').value;
  const res = await Messages.send(data, !!currentUser);
  btn.disabled = false; btn.innerHTML = btnOrigHtml;

  if (!res.ok) { errEl.innerHTML = Icon('warning') + ' ' + escapeHtml(res.msg || 'Bir hata oluştu.'); errEl.style.display = 'block'; return; }

  document.getElementById('m-text').value = '';
  okEl.style.display = 'block';
  setTimeout(() => okEl.style.display = 'none', 2000);
  if (currentUser) {
    conversationId = res.data?.conversationId ?? conversationId;
    await refreshContactHistory();
  }
}
