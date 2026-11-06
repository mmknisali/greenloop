document.getElementById('nav-back-link').innerHTML = Icon('arrowLeft') + ' Atık Ağına Dön';
const params     = new URLSearchParams(location.search);
const companyId  = params.get('id');
const root       = document.getElementById('main-content');
let company = null, currentUser = null;
let detailPollInterval = null;
let detailLastPoll = new Date().toISOString();

(async () => {
  [company, currentUser] = await Promise.all([Companies.getById(companyId), Auth.getCurrent()]);

  if (!company) {
    root.innerHTML = '<div class="not-found"><div style="margin-bottom:1rem;opacity:.3;display:flex;justify-content:center;"><span style="width:3rem;height:3rem;display:inline-block;">' + Icon('factory') + '</span></div><p>Şirket bulunamadı.</p><a href="network.html" style="color:var(--gb);text-decoration:none;font-size:.88rem;">' + Icon('arrowLeft') + ' Ağa Dön</a></div>';
    return;
  }

  document.title = company.name + ' — GreenLoop';
  renderPage();

  if (currentUser && company.userId !== currentUser.id) {
    detailPollInterval = setInterval(async () => {
      const now = new Date().toISOString();
      const res = await Messages.pollNew(detailLastPoll, company.id, currentUser.id);
      if (res.ok && res.data.length > 0) {
        detailLastPoll = now;
        await renderContactBox();
      }
    }, 3000);
  }
})();

function renderPage() {
  root.innerHTML = `
  <div class="hero">
    <div class="hero-inner">
      <div class="hero-avatar">${Icon(resolveCompanyIcon(company.emoji))}</div>
      <div class="hero-info">
        <div class="company-name">${company.name}</div>
        <div class="company-meta" style="margin-top:.6rem;gap:.6rem;">
          <span class="sector-badge">${company.sector||'Sektör'}</span>
          <span class="meta-pill">${Icon('pin')} ${company.il||''} / ${company.ilce||''}</span>
          ${company.size ? `<span class="meta-pill">${Icon('users')} ${company.size} çalışan</span>` : ''}
          <span class="meta-pill">${Icon('calendar')} ${company.date||''}</span>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div class="emission-big">%${company.emission||0}</div>
        <div class="emission-lbl">Emisyon Azaltımı</div>
      </div>
    </div>
  </div>
  <div class="content">
    <div class="left-col">
      ${company.desc ? `<div class="section"><div class="section-title">${Icon('edit')} Şirket Hakkında</div><div class="desc-text">${company.desc}</div></div>` : ''}
      <div class="section">
        <div class="section-title">${Icon('component')} Kullandığı Hammaddeler</div>
        <div class="tag-list">${(company.inputs||[]).length ? company.inputs.map(t=>`<span class="stag in">${t}</span>`).join('') : '<span style="font-size:.82rem;color:rgba(255,255,255,.25)">Belirtilmemiş</span>'}</div>
      </div>
      <div class="section">
        <div class="section-title">${Icon('recycle')} Ürettiği Atıklar</div>
        <div class="tag-list">${(company.outputs||[]).length ? company.outputs.map(t=>`<span class="stag out">${t}</span>`).join('') : '<span style="font-size:.82rem;color:rgba(255,255,255,.25)">Belirtilmemiş</span>'}</div>
      </div>
      <div class="section">
        <div class="section-title">${Icon('chart')} Emisyon Azaltım Oranı</div>
        <div style="font-family:'Syne',sans-serif;font-size:2rem;font-weight:800;color:var(--y);">%${company.emission||0}</div>
        <div class="em-bar-track"><div class="em-bar-fill" id="em-bar" style="width:0%"></div></div>
      </div>
      <div class="section">
        <div class="section-title">${Icon('clipboard')} Genel Bilgiler</div>
        <div class="info-grid">
          <div class="info-item"><label>Şehir</label><div class="val">${Icon('pin')} ${company.il||'—'} / ${company.ilce||'—'}</div></div>
          <div class="info-item"><label>Sektör</label><div class="val">${company.sector||'—'}</div></div>
          ${company.size ? `<div class="info-item"><label>Çalışan</label><div class="val">${Icon('users')} ${company.size}</div></div>` : ''}
          ${company.email ? `<div class="info-item"><label>E-posta</label><div class="val">${company.email}</div></div>` : ''}
          ${company.tel   ? `<div class="info-item"><label>Telefon</label><div class="val">${company.tel}</div></div>` : ''}
          ${company.web   ? `<div class="info-item"><label>Web</label><div class="val"><a href="${company.web}" target="_blank" style="color:var(--gb);">${company.web}</a></div></div>` : ''}
          <div class="info-item"><label>Eklenme Tarihi</label><div class="val">${company.date||'—'}</div></div>
        </div>
      </div>
    </div>
    <div>
      <div class="contact-card">
        <div class="contact-head">
          <div class="contact-head-title">${Icon('chat')} İletişime Geç</div>
          <div class="contact-head-sub">${company.name} ile mesajlaşın</div>
        </div>
        <div class="contact-body" id="contact-body"></div>
      </div>
    </div>
  </div>`;

  setTimeout(() => { const bar = document.getElementById('em-bar'); if (bar) bar.style.width = (company.emission||0) + '%'; }, 100);
  renderContactBox();
}

async function renderContactBox() {
  const body = document.getElementById('contact-body');
  if (!body) return;

  if (currentUser && company.userId === currentUser.id) {
    body.innerHTML = `<p style="font-size:.82rem;color:rgba(255,255,255,.35);text-align:center;padding:.5rem 0;">Bu sizin şirketiniz.<br><a href="dashboard.html" style="color:var(--gb);">Panele git ${Icon('arrowRight')}</a></p>`;
    return;
  }

  const threadMsgs = currentUser ? await Messages.getConversation(company.id) : [];

  body.innerHTML = `
    ${threadMsgs.length ? `<div class="thread-box" id="thread-box">${threadMsgs.map(m => {
      const isMe = !!m.fromUserId;
      return `<div style="display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'}">
        <div class="cb ${isMe ? 'me' : 'them'}">${m.text}</div>
        <div class="cb-meta">${m.fromName} · ${new Date(m.createdAt).toLocaleString('tr-TR')}</div>
      </div>`;
    }).join('')}</div><div style="height:1px;background:rgba(82,183,136,.1);"></div>` : ''}
    <div class="msg-box">
      <div class="msg-success" id="msg-ok">${Icon('check')} Mesajınız gönderildi!</div>
      <div class="msg-error"   id="msg-err"></div>
      ${!currentUser ? `
        <div class="msg-field"><label>Adınız *</label><input id="m-name" placeholder="Ad Soyad"/></div>
        <div class="msg-field"><label>E-posta *</label><input id="m-email" type="email" placeholder="ornek@email.com"/></div>` : ''}
      <div class="msg-field"><label>Mesajınız *</label><textarea id="m-text" placeholder="Hammadde ihtiyacınız, atık teklifiniz veya iş birliği talebiniz..."></textarea></div>
      <button class="send-btn" id="send-btn" onclick="sendMsg()">Mesaj Gönder ${Icon('arrowRight')}</button>
      ${!currentUser ? `<p style="font-size:.7rem;color:rgba(255,255,255,.25);text-align:center;"><a href="login.html" style="color:var(--gb);">Giriş yapın</a> — geçmiş mesajları görüntüleyin</p>` : ''}
    </div>`;

  const tb = document.getElementById('thread-box');
  if (tb) tb.scrollTop = tb.scrollHeight;
}

async function sendMsg() {
  const text   = document.getElementById('m-text')?.value.trim();
  const okEl   = document.getElementById('msg-ok');
  const errEl  = document.getElementById('msg-err');
  const btn    = document.getElementById('send-btn');
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
  const res = await Messages.send({ toCompanyId: company.id, fromName, fromEmail, text });
  btn.disabled = false; btn.innerHTML = btnOrigHtml;

  if (!res.ok) { errEl.innerHTML = Icon('warning') + ' ' + (res.msg || 'Bir hata oluştu.'); errEl.style.display = 'block'; return; }

  document.getElementById('m-text').value = '';
  okEl.style.display = 'block';
  setTimeout(() => okEl.style.display = 'none', 2000);
  await renderContactBox();
}
