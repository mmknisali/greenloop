applyIcons();
let user = null;
let inputs = [], outputs = [], selIcon = 'factory';
let currentThreadKey = null, currentThreadType = 'in';
let currentMsgTab = 'in';
let pollInterval = null;
let lastPollTime = new Date().toISOString();

(async () => {
  user = await Auth.getCurrent();
  if (!user) { location.href = 'login.html'; return; }

  const fullName = user.ad + ' ' + user.soyad;
  document.getElementById('sb-name').textContent      = fullName;
  document.getElementById('sb-email').textContent     = user.email;
  document.getElementById('welcome-msg').textContent  = 'Hoş geldiniz, ' + user.ad + '!';
  document.getElementById('mob-user-name').textContent = user.ad;
  document.getElementById('mob-user-info').textContent = fullName + ' · ' + user.email;
  document.getElementById('mob-logout-area').style.display = 'none';

  populateIlSelect('f-il', 'f-ilce');

  const ICON_KEYS = SECTOR_ICON_KEYS;
  const eg = document.getElementById('emoji-grid');
  ICON_KEYS.forEach(k => {
    const d = document.createElement('div');
    d.className = 'eopt' + (k === 'factory' ? ' sel' : '');
    d.innerHTML = Icon(k);
    d.title = k;
    d.onclick = () => { selIcon = k; document.querySelectorAll('.eopt').forEach(el => el.classList.toggle('sel', el.title === k)); };
    eg.appendChild(d);
  });

  document.getElementById('f-emission').oninput = function () { document.getElementById('em-val').textContent = '%' + this.value; };
  mkTag('inp-wrap', 'inp-field', inputs, 'in');
  mkTag('out-wrap', 'out-field', outputs, 'out');

  await renderOverview();
  startPolling();
})();

function setBadge(count) {
  const desk  = document.getElementById('unread-badge');
  const mob   = document.getElementById('mob-badge');
  if (count > 0) {
    desk.textContent = count; desk.style.display = 'inline';
    mob.textContent  = count; mob.style.display  = 'inline';
  } else {
    desk.textContent = ''; desk.style.display = 'none';
    mob.textContent  = ''; mob.style.display  = 'none';
  }
}

function startPolling() {
  pollInterval = setInterval(async () => {
    const now = new Date().toISOString();
    const res = await Messages.pollNew(lastPollTime, '', user.id);
    const msgPageOpen = document.getElementById('tp-messages').classList.contains('active');
    const overviewOpen = document.getElementById('tp-overview').classList.contains('active');
    const modalOpen   = document.getElementById('modal-bg').classList.contains('open');

    if (res.ok && res.data.length) {
      lastPollTime = now;
      const incoming = res.data.filter(m => m.fromUserId !== user.id && !m.fromCompanyId);
      if (incoming.length > 0 && !msgPageOpen) {
        const cur = parseInt(document.getElementById('unread-badge').textContent) || 0;
        setBadge(cur + incoming.length);
      }
      if (modalOpen && currentThreadKey) await refreshModal();
      if (msgPageOpen) await renderMessages();
    }

    if (overviewOpen) await renderOverview();
  }, 3000);
}

function mkTag(wId, iId, arr, cls) {
  const w = document.getElementById(wId), inp = document.getElementById(iId);
  function render() {
    w.querySelectorAll('.tpill').forEach(el => el.remove());
    arr.forEach((t, i) => {
      const p = document.createElement('div');
      p.className = 'tpill ' + cls;
      p.innerHTML = `${t}<button>${Icon('close')}</button>`;
      p.querySelector('button').onclick = () => { arr.splice(i, 1); render(); };
      w.insertBefore(p, inp);
    });
  }
  inp.onkeydown = e => {
    if ((e.key === 'Enter' || e.key === ',') && inp.value.trim()) {
      e.preventDefault();
      const v = inp.value.trim().replace(/,$/, '');
      if (v && !arr.includes(v)) arr.push(v);
      inp.value = ''; render();
    }
    if (e.key === 'Backspace' && !inp.value && arr.length) { arr.pop(); render(); }
  };
  w.onclick = () => inp.focus();
}

function setActiveTab(t) {
  document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.mob-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tp-' + t).classList.add('active');
  document.querySelector(`.sb-item[onclick="goTab('${t}')"]`)?.classList.add('active');
  const mobBtn = document.getElementById('mt-' + t);
  if (mobBtn) mobBtn.classList.add('active');
}

async function goTab(t) {
  setActiveTab(t);
  if (t === 'overview')  await renderOverview();
  if (t === 'companies') await renderCompanies();
  if (t === 'messages') {
    setBadge(0);
    await renderMessages();
  }
}

async function renderOverview() {
  const [cos, threads] = await Promise.all([Companies.getByUser(), Messages.getThreadsForCompany()]);
  document.getElementById('ov-companies').textContent = cos.length;
  document.getElementById('ov-inputs').textContent    = cos.reduce((s, c) => s + (c.inputs  || []).length, 0);
  document.getElementById('ov-outputs').textContent   = cos.reduce((s, c) => s + (c.outputs || []).length, 0);
  document.getElementById('ov-msgs').textContent      = threads.length;
}

async function renderCompanies() {
  const cos = await Companies.getByUser();
  const g   = document.getElementById('company-grid');
  if (!cos.length) { g.innerHTML = '<div class="empty-state"><div class="ei">' + Icon('factory') + '</div><p>Henüz şirket eklemediniz.</p></div>'; return; }
  g.innerHTML = cos.map(c => `
    <div class="company-card">
      <div class="cc-head"><div class="cc-emoji">${Icon(resolveCompanyIcon(c.emoji))}</div><div><div class="cc-name">${c.name}</div><div class="cc-loc">${Icon('pin')} ${c.il||''} / ${c.ilce||''}</div></div></div>
      <div class="cc-tags">${(c.inputs||[]).slice(0,2).map(t=>`<span class="cc-tag in">${Icon('component')} ${t}</span>`).join('')}${(c.outputs||[]).slice(0,2).map(t=>`<span class="cc-tag out">${Icon('recycle')} ${t}</span>`).join('')}</div>
      <div class="cc-footer">
        <div class="cc-emission">%${c.emission||0} <span style="font-size:.68rem;font-weight:400;color:rgba(255,255,255,.4)">emisyon</span></div>
        <div class="cc-actions">
          <button class="cc-btn view" onclick="location.href='company-detail.html?id=${c.id}'">Görüntüle</button>
          <button class="cc-btn del"  onclick="delCompany('${c.id}')">Sil</button>
        </div>
      </div>
    </div>`).join('');
}

async function delCompany(id) {
  if (!confirm('Bu şirket silinsin mi?')) return;
  await Companies.delete(id);
  await renderCompanies();
  await renderOverview();
}

async function addCompany() {
  const name   = document.getElementById('f-name').value.trim();
  const sector = document.getElementById('f-sector').value;
  const il     = document.getElementById('f-il').value;
  const ilce   = document.getElementById('f-ilce').value;
  const errEl  = document.getElementById('f-err');
  const okEl   = document.getElementById('f-ok');
  errEl.style.display = 'none'; okEl.style.display = 'none';
  if (!name)   { errEl.innerHTML = Icon('warning') + ' Şirket adı zorunludur.'; errEl.style.display = 'block'; return; }
  if (!sector) { errEl.innerHTML = Icon('warning') + ' Sektör seçiniz.';        errEl.style.display = 'block'; return; }
  if (!il)     { errEl.innerHTML = Icon('warning') + ' İl seçiniz.';            errEl.style.display = 'block'; return; }
  if (!ilce)   { errEl.innerHTML = Icon('warning') + ' İlçe seçiniz.';          errEl.style.display = 'block'; return; }
  const btn = document.getElementById('btn-add');
  const btnOrigHtml = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Ekleniyor...';
  const res = await Companies.add({
    name, sector, il, ilce,
    size: document.getElementById('f-size').value,
    email: document.getElementById('f-email').value.trim(),
    tel: document.getElementById('f-tel').value.trim(),
    web: document.getElementById('f-web').value.trim(),
    inputs: [...inputs], outputs: [...outputs],
    emission: parseInt(document.getElementById('f-emission').value),
    desc: document.getElementById('f-desc').value.trim(),
    emoji: selIcon,
  });
  btn.disabled = false; btn.innerHTML = btnOrigHtml;
  if (!res.ok) { errEl.innerHTML = Icon('warning') + ' ' + (res.msg || 'Bir hata oluştu.'); errEl.style.display = 'block'; return; }
  ['f-name','f-email','f-tel','f-web','f-desc'].forEach(id => document.getElementById(id).value = '');
  ['f-sector','f-size','f-il'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-ilce').value = ''; document.getElementById('f-ilce').disabled = true;
  document.getElementById('f-emission').value = 25; document.getElementById('em-val').textContent = '%25';
  inputs.length = 0; outputs.length = 0;
  document.querySelectorAll('#inp-wrap .tpill, #out-wrap .tpill').forEach(el => el.remove());
  selIcon = 'factory'; document.querySelectorAll('.eopt').forEach((el, i) => el.classList.toggle('sel', i === 0));
  okEl.innerHTML = Icon('check') + ' Şirket başarıyla ağa eklendi!'; okEl.style.display = 'block';
  setTimeout(() => okEl.style.display = 'none', 3500);
  await renderOverview();
}

function switchMsgTab(tab) {
  currentMsgTab = tab;
  document.getElementById('mtab-in').classList.toggle('active',  tab === 'in');
  document.getElementById('mtab-out').classList.toggle('active', tab === 'out');
  renderMessages();
}

async function renderMessages() {
  const list = document.getElementById('msg-list');
  if (currentMsgTab === 'in') {
    const threads = await Messages.getThreadsForCompany();
    if (!threads.length) { list.innerHTML = '<div class="empty-state"><div class="ei">' + Icon('chat') + '</div><p>Henüz gelen mesaj yok.</p></div>'; return; }
    const cos   = await Companies.getByUser();
    const coMap = Object.fromEntries(cos.map(c => [c.id, c]));
    const html  = threads.map(t => {
      const co = coMap[t.companyId];
      const hasUnread = t.msgs.some(m => !m.read && !m.fromCompanyId);
      return `<div class="msg-thread${hasUnread?' unread':''}" data-tk="${encodeURIComponent(t.key)}" data-type="in">
        <div class="mt-head" onclick="openThread(this.parentElement)">
          <div class="mt-avatar">${Icon('user')}</div>
          <div class="mt-info"><div class="mt-name">${t.senderName}</div><div class="mt-company">${co?co.name:'—'} şirketine</div></div>
          ${hasUnread?'<div class="unread-dot"></div>':''}
          <div class="mt-meta">${new Date(t.lastMsg.createdAt).toLocaleDateString('tr-TR')}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 1.2rem .8rem;">
          <div class="mt-preview" style="padding:0;border:none;flex:1;">${(t.lastMsg.text||'').slice(0,100)}${(t.lastMsg.text||'').length>100?'…':''}</div>
          <button class="mt-delete" onclick="deleteThread('${encodeURIComponent(t.key)}','in')">Sil</button>
        </div>
      </div>`;
    }).join('');
    if (list.innerHTML !== html) list.innerHTML = html;
  } else {
    const threads = await Messages.getSentThreads();
    if (!threads.length) { list.innerHTML = '<div class="empty-state"><div class="ei">' + Icon('upload') + '</div><p>Henüz mesaj göndermediniz.</p></div>'; return; }
    const html = threads.map(t => `
      <div class="msg-thread" data-cid="${t.companyId}" data-type="out">
        <div class="mt-head" onclick="openSentThread(this.parentElement)">
          <div class="mt-avatar">${Icon(resolveCompanyIcon(t.companyEmoji))}</div>
          <div class="mt-info"><div class="mt-name">${t.companyName}</div><div class="mt-company">Gönderilen konuşma</div></div>
          <div class="mt-meta">${new Date(t.lastMsg.createdAt).toLocaleDateString('tr-TR')}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 1.2rem .8rem;">
          <div class="mt-preview" style="padding:0;border:none;flex:1;">${(t.lastMsg.text||'').slice(0,100)}${(t.lastMsg.text||'').length>100?'…':''}</div>
          <button class="mt-delete" onclick="deleteThread('${t.companyId}','out')">Sil</button>
        </div>
      </div>`).join('');
    if (list.innerHTML !== html) list.innerHTML = html;
  }
}

async function deleteThread(encodedKey, type) {
  if (!confirm('Bu konuşma silinsin mi?')) return;
  const threadKey = decodeURIComponent(encodedKey);
  const res = await Messages.deleteThread({ threadKey, type });
  if (!res.ok) { alert('Silinemedi: ' + (res.msg || 'Hata')); return; }
  await renderMessages();
}

async function openThread(el) {
  currentThreadKey  = decodeURIComponent(el.dataset.tk);
  currentThreadType = 'in';
  const msgs = await Messages.getThreadMsgs(currentThreadKey);
  await Promise.all(msgs.filter(m => !m.read && !m.fromCompanyId).map(m => Messages.markRead(m.id)));
  const co = (await Companies.getByUser()).find(c => c.id === currentThreadKey.split('|')[0]);
  document.getElementById('modal-title').textContent = (co?co.name:'Şirket') + ' — Konuşma';
  renderModalMsgs(msgs, 'in');
  document.getElementById('modal-bg').classList.add('open');
  await renderMessages();
}

async function openSentThread(el) {
  currentThreadKey  = el.dataset.cid;
  currentThreadType = 'out';
  const [msgs, co] = await Promise.all([Messages.getConversation(currentThreadKey), Companies.getById(currentThreadKey)]);
  document.getElementById('modal-title').textContent = (co?co.name:'Şirket') + ' — Konuşma';
  renderModalMsgs(msgs, 'out');
  document.getElementById('modal-bg').classList.add('open');
}

function renderModalMsgs(msgs, type) {
  const box = document.getElementById('modal-msgs');
  box.innerHTML = msgs.map(m => {
    const isMe = type === 'in' ? !!m.fromCompanyId : (!!m.fromUserId && !m.fromCompanyId);
    return `<div style="display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'}">
      <div class="chat-bubble ${isMe?'me':'them'}">${m.text}</div>
      <div class="bubble-meta">${m.fromName||'—'} · ${new Date(m.createdAt).toLocaleString('tr-TR')}</div>
    </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

async function refreshModal() {
  if (!currentThreadKey) return;
  const msgs = currentThreadType === 'in'
    ? await Messages.getThreadMsgs(currentThreadKey)
    : await Messages.getConversation(currentThreadKey);
  renderModalMsgs(msgs, currentThreadType);
}

async function sendReply() {
  const text = document.getElementById('reply-ta').value.trim();
  if (!text || !currentThreadKey) return;
  document.getElementById('reply-ta').value = '';
  if (currentThreadType === 'in') await Messages.reply({ companyId: currentThreadKey.split('|')[0], text });
  else await Messages.send({ toCompanyId: currentThreadKey, text });
  await refreshModal();
  await renderMessages();
}

function closeModal() {
  document.getElementById('modal-bg').classList.remove('open');
  currentThreadKey = null;
}

async function doLogout() {
  clearInterval(pollInterval);
  await Auth.logout();
  location.href = 'login.html';
}

document.getElementById('reply-ta').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
});
