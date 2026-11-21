applyIcons();
let user = null;
let inputs = [], outputs = [], selIcon = 'factory';
let currentConversation = null, modalRequest = 0;
let currentMsgTab = 'in';
let stopPolling, messageListRequest = 0, lastMessageListHtml;
const unreadMessages = new Map();

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
  stopPolling = startMessagePolling(handleNewMessages);
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

async function handleNewMessages(messages) {
  for (const m of messages) {
    if (!m.read) unreadMessages.set(String(m.id), String(m.conversationId));
  }
  setBadge(unreadMessages.size);
  const thread = currentConversation;
  if (thread && messages.some(m => String(m.conversationId) === thread.id)) {
    await refreshModal();
  }
  if (document.getElementById('tp-messages').classList.contains('active')) await renderMessages();
}

function mkTag(wId, iId, arr, cls) {
  const w = document.getElementById(wId), inp = document.getElementById(iId);
  function render() {
    w.querySelectorAll('.tpill').forEach(el => el.remove());
    arr.forEach((t, i) => {
      const p = document.createElement('div');
      p.className = 'tpill ' + cls;
      p.innerHTML = `${escapeHtml(t)}<button>${Icon('close')}</button>`;
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
  if (t === 'messages') await renderMessages();
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
    <div class="company-card" data-company-id="${escapeHtml(c.id)}">
      <div class="cc-head"><div class="cc-emoji">${Icon(resolveCompanyIcon(c.icon ?? c.emoji))}</div><div><div class="cc-name">${escapeHtml(c.name)}</div><div class="cc-loc">${Icon('pin')} ${escapeHtml(c.il)} / ${escapeHtml(c.ilce)}</div></div></div>
      <div class="cc-tags">${(c.inputs||[]).slice(0,2).map(t=>`<span class="cc-tag in">${Icon('component')} ${escapeHtml(t)}</span>`).join('')}${(c.outputs||[]).slice(0,2).map(t=>`<span class="cc-tag out">${Icon('recycle')} ${escapeHtml(t)}</span>`).join('')}</div>
      <div class="cc-footer">
        <div class="cc-emission">%${escapeHtml(c.emission||0)} <span style="font-size:.68rem;font-weight:400;color:rgba(255,255,255,.4)">emisyon</span></div>
        <div class="cc-actions">
          <button class="cc-btn view">Görüntüle</button>
          <button class="cc-btn del">Sil</button>
        </div>
      </div>
    </div>`).join('');
}

document.getElementById('company-grid').addEventListener('click', e => {
  const button = e.target.closest('.cc-btn');
  if (!button) return;
  const { companyId } = button.closest('.company-card').dataset;
  if (button.classList.contains('del')) delCompany(companyId);
  else location.href = companyDetailUrl(companyId);
});

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
    icon: selIcon,
  });
  btn.disabled = false; btn.innerHTML = btnOrigHtml;
  if (!res.ok) { errEl.innerHTML = Icon('warning') + ' ' + escapeHtml(res.msg || 'Bir hata oluştu.'); errEl.style.display = 'block'; return; }
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
  const request = ++messageListRequest;
  const type = currentMsgTab, inbound = type === 'in';
  const threads = await (inbound ? Messages.getThreadsForCompany() : Messages.getSentThreads());
  const companies = inbound && threads.length ? await Companies.getByUser() : [];
  if (request !== messageListRequest) return;
  const companyNames = new Map(companies.map(c => [String(c.id), c.name]));
  const html = threads.map(t => {
    const companyName = t.companyName ?? companyNames.get(String(t.companyId)) ?? '—';
    const hasUnread = t.unreadCount != null ? t.unreadCount > 0
      : (t.msgs ?? [t.lastMsg]).some(m => m && !m.read && (inbound ? !m.fromCompanyId : !!m.fromCompanyId));
    const preview = String(t.lastMsg?.text ?? '');
    return `<div class="msg-thread${hasUnread?' unread':''}" data-conversation-id="${escapeHtml(t.conversationId)}"
                 data-company-name="${escapeHtml(companyName)}" data-type="${type}">
      <div class="mt-head">
        <div class="mt-avatar">${Icon(inbound ? 'user' : resolveCompanyIcon(t.companyIcon ?? t.companyEmoji))}</div>
        <div class="mt-info"><div class="mt-name">${escapeHtml(inbound ? t.senderName : companyName)}</div><div class="mt-company">${inbound ? escapeHtml(companyName) + ' şirketine' : 'Gönderilen konuşma'}</div></div>
        ${hasUnread?'<div class="unread-dot"></div>':''}
        <div class="mt-meta">${t.lastMsg ? escapeHtml(new Date(t.lastMsg.createdAt).toLocaleDateString('tr-TR')) : ''}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 1.2rem .8rem;">
        <div class="mt-preview" style="padding:0;border:none;flex:1;">${escapeHtml(preview.slice(0,100))}${preview.length>100?'…':''}</div>
        <button class="mt-delete">Sil</button>
      </div>
    </div>`;
  }).join('') || `<div class="empty-state"><div class="ei">${Icon(inbound ? 'chat' : 'upload')}</div><p>${inbound ? 'Henüz gelen mesaj yok.' : 'Henüz mesaj göndermediniz.'}</p></div>`;
  if (lastMessageListHtml !== html) list.innerHTML = lastMessageListHtml = html;
}

document.getElementById('msg-list').addEventListener('click', e => {
  const card = e.target.closest('.msg-thread');
  if (!card?.dataset.conversationId) return;
  if (e.target.closest('.mt-delete')) deleteThread(card.dataset.conversationId, card.dataset.type);
  else if (e.target.closest('.mt-head')) openThread(card.dataset);
});

async function deleteThread(conversationId, type) {
  if (!confirm('Bu konuşma silinsin mi?')) return;
  const res = await Messages.deleteThread({ conversationId, type });
  if (!res.ok) { alert('Silinemedi: ' + (res.msg || 'Hata')); return; }
  for (const [id, threadId] of unreadMessages) {
    if (threadId === conversationId) unreadMessages.delete(id);
  }
  setBadge(unreadMessages.size);
  if (currentConversation?.id === conversationId) closeModal();
  await renderMessages();
}

async function openThread({ conversationId, companyName, type }) {
  currentConversation = { id: conversationId, type };
  document.getElementById('modal-title').textContent = (companyName || 'Şirket') + ' — Konuşma';
  document.getElementById('modal-msgs').textContent = 'Yükleniyor...';
  document.getElementById('modal-bg').classList.add('open');
  if (await refreshModal()) await renderMessages();
}

function isOwnMessage(m, type) {
  return type === 'in' ? !!m.fromCompanyId : !m.fromCompanyId && String(m.fromUserId) === String(user.id);
}

function renderModalMsgs(msgs, type) {
  const box = document.getElementById('modal-msgs');
  box.innerHTML = msgs.map(m => {
    const isMe = isOwnMessage(m, type);
    return `<div style="display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'}">
      <div class="chat-bubble ${isMe?'me':'them'}">${escapeHtml(m.text)}</div>
      <div class="bubble-meta">${escapeHtml(m.fromName||'—')} · ${escapeHtml(new Date(m.createdAt).toLocaleString('tr-TR'))}</div>
    </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

async function refreshModal() {
  const thread = currentConversation;
  if (!thread) return false;
  const request = ++modalRequest;
  const msgs = await Messages.getThreadMsgs(thread.id);
  if (thread !== currentConversation || request !== modalRequest) return false;
  if (!msgs) {
    document.getElementById('modal-msgs').textContent = 'Konuşma yüklenemedi.';
    return false;
  }
  renderModalMsgs(msgs, thread.type);
  const ids = msgs.filter(m => m.id != null && !m.read && !isOwnMessage(m, thread.type)).map(m => m.id);
  let markedRead = false;
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const res = await Messages.markRead(batch);
    if (!res.ok) break;
    batch.forEach(id => unreadMessages.delete(String(id)));
    markedRead = true;
  }
  if (markedRead) setBadge(unreadMessages.size);
  return markedRead;
}

async function sendReply() {
  const input = document.getElementById('reply-ta');
  const button = document.querySelector('.modal-send');
  const draft = input.value, text = draft.trim(), thread = currentConversation;
  if (!text || !thread || button.disabled) return;
  button.disabled = true;
  const res = await Messages.reply({ conversationId: thread.id, type: thread.type, text });
  button.disabled = false;
  if (!res.ok) { alert(res.msg || 'Yanıt gönderilemedi.'); return; }
  if (thread === currentConversation) {
    if (input.value === draft) input.value = '';
    await refreshModal();
  }
  await renderMessages();
}

function closeModal() {
  document.getElementById('modal-bg').classList.remove('open');
  document.getElementById('reply-ta').value = '';
  currentConversation = null;
}

async function doLogout() {
  stopPolling?.();
  await Auth.logout();
  location.href = 'login.html';
}

document.getElementById('reply-ta').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
});
