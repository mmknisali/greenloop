applyIcons();
let user = null;
let inputs = [], outputs = [];
let currentConversation = null, modalRequest = 0;
let currentMsgTab = 'in';
let stopPolling, overviewRequest = 0, companyListRequest = 0, messageListRequest = 0, lastMessageListHtml;
const unreadMessages = new Map();
const threadDialog = document.getElementById('thread-modal');
const actionDialog = document.getElementById('action-modal');

(async () => {
  user = await navUser;
  if (!user) { location.href = 'login.html'; return; }
  if (user.previewAdmin) document.querySelectorAll('.logout-btn').forEach(button => { button.hidden = true; });
  if (user.previewReadOnly) {
    document.querySelectorAll('[data-preview-private]').forEach(el => { el.hidden = true; });
    document.getElementById('preview-note').hidden = false;
  }

  document.getElementById('welcome-msg').textContent  = 'Hoş geldiniz, ' + user.ad + '!';

  populateIlSelect('f-il', 'f-ilce');

  initIconPicker();

  document.getElementById('f-emission').oninput = function () { document.getElementById('em-val').textContent = '%' + this.value; };
  mkTag('inp-wrap', 'inp-field', inputs, 'in');
  mkTag('out-wrap', 'out-field', outputs, 'out');

  await renderOverview();
  if (!user.previewReadOnly) stopPolling = startMessagePolling(handleNewMessages);
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
  if (document.getElementById('tp-overview').classList.contains('active') && messages.some(m => !m.fromCompanyId)) {
    const threads = await Messages.getThreadsForCompany();
    document.getElementById('ov-msgs').textContent = threads?.length ?? '—';
  }
}

function initIconPicker() {
  const labels = {
    factory: 'Fabrika', wheat: 'Buğday', thread: 'İplik', coffee: 'Kahve', flask: 'Laboratuvar',
    leaf: 'Yaprak', brick: 'Tuğla', recycle: 'Geri dönüşüm', battery: 'Pil', pill: 'İlaç',
    barrel: 'Varil', package: 'Paket', wave: 'Dalga', energy: 'Enerji', plug: 'Fiş',
    construction: 'İnşaat', truck: 'Kamyon', component: 'Parça',
  };
  document.getElementById('emoji-grid').innerHTML = SECTOR_ICON_KEYS.map(key => `
    <input class="sr-only" type="radio" id="company-icon-${key}" name="company-icon" value="${key}"${key === 'factory' ? ' checked' : ''}>
    <label class="eopt" for="company-icon-${key}" title="${labels[key]}">${Icon(key)}<span class="sr-only">${labels[key]}</span></label>
  `).join('');
}

function mkTag(wId, iId, arr, cls) {
  const w = document.getElementById(wId), inp = document.getElementById(iId);
  function render() {
    w.querySelectorAll('.tpill').forEach(el => el.remove());
    arr.forEach((t, i) => {
      const p = document.createElement('div');
      p.className = 'tpill ' + cls;
      p.innerHTML = `${escapeHtml(t)}<button type="button" aria-label="${escapeHtml(t)} etiketini kaldır">${Icon('close')}</button>`;
      p.querySelector('button').onclick = () => { arr.splice(i, 1); render(); inp.focus(); };
      w.insertBefore(p, inp);
    });
  }
  inp.onkeydown = e => {
    if (e.isComposing) return;
    if ((e.key === 'Enter' || e.key === ',') && inp.value.trim()) {
      e.preventDefault();
      const v = inp.value.trim().replace(/,$/, '');
      if (v && !arr.includes(v)) arr.push(v);
      inp.value = ''; render();
    }
    if (e.key === 'Backspace' && !inp.value && arr.length) { arr.pop(); render(); }
  };
  w.onclick = e => { if (!e.target.closest('button')) inp.focus(); };
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

function setLoadState(region, busy, text) {
  region.setAttribute('aria-busy', String(busy));
  const status = document.getElementById(`${region.id}-status`);
  if (status.textContent !== text) status.textContent = text;
}

function listSkeleton(cardClass) {
  return `<div class="${cardClass} loading-card" aria-hidden="true"><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line short"></span></div>`.repeat(2);
}

function emptyState(icon, text) {
  return `<div class="empty-state"><div class="ei">${Icon(icon)}</div><p>${escapeHtml(text)}</p></div>`;
}

// Live refreshes can replace the button that launched a dialog or held keyboard focus.
function restoreDashboardFocus(opener) {
  if (opener?.getClientRects().length) { opener.focus(); return; }
  const card = opener?.closest('.msg-thread, .company-card');
  if (!card) return;
  const { conversationId, companyId, type } = card.dataset;
  const selector = companyId != null ? `[data-company-id="${CSS.escape(companyId)}"]`
    : `[data-conversation-id="${CSS.escape(conversationId)}"][data-type="${type}"]`;
  const replacement = document.querySelector(`${selector} .${opener.classList[0]}`);
  const fallback = document.querySelector(companyId != null ? '#company-grid' : '.msg-tab.active');
  (replacement || fallback)?.focus();
}

function replaceList(list, html) {
  const focused = list.contains(document.activeElement) ? document.activeElement : null;
  list.innerHTML = html;
  if (focused !== list) restoreDashboardFocus(focused);
}

async function showActionDialog(title, text, { opener, confirmDelete = false } = {}) {
  while (actionDialog.open) await new Promise(resolve => actionDialog.addEventListener('close', resolve, { once: true }));
  const focusTarget = opener ?? document.activeElement;
  document.getElementById('action-title').textContent = title;
  document.getElementById('action-text').textContent = text;
  document.getElementById('action-dismiss').textContent = confirmDelete ? 'Vazgeç' : 'Tamam';
  document.getElementById('action-confirm').hidden = !confirmDelete;
  actionDialog.returnValue = '';
  actionDialog.showModal();
  return new Promise(resolve => {
    actionDialog.addEventListener('close', () => {
      restoreDashboardFocus(focusTarget);
      resolve(actionDialog.returnValue === 'confirm');
    }, { once: true });
  });
}

async function renderOverview() {
  const stats = document.getElementById('overview-stats');
  const request = ++overviewRequest;
  setLoadState(stats, true, 'Özet yükleniyor…');
  const data = await Promise.all([Companies.getByUser(), user.previewReadOnly ? [] : Messages.getThreadsForCompany()]).catch(() => null);
  if (request !== overviewRequest) return;
  const [cos, threads] = data ?? [];
  document.getElementById('ov-companies').textContent = cos?.length ?? '—';
  document.getElementById('ov-inputs').textContent    = cos?.reduce((s, c) => s + (c.inputs  || []).length, 0) ?? '—';
  document.getElementById('ov-outputs').textContent   = cos?.reduce((s, c) => s + (c.outputs || []).length, 0) ?? '—';
  document.getElementById('ov-msgs').textContent      = threads?.length ?? '—';
  setLoadState(stats, false, data ? 'Özet yüklendi.' : 'Özet yüklenemedi.');
}

async function renderCompanies() {
  const g = document.getElementById('company-grid');
  const request = ++companyListRequest;
  if (!g.hasChildNodes()) g.innerHTML = listSkeleton('company-card');
  setLoadState(g, true, 'Şirketler yükleniyor…');
  const cos = await Companies.getByUser().catch(() => null);
  if (request !== companyListRequest) return;
  const emptyText = cos ? 'Henüz şirket eklemediniz.' : 'Şirketler yüklenemedi.';
  const html = cos?.length ? cos.map(c => `
    <div class="company-card" data-company-id="${escapeHtml(c.id)}">
      <div class="cc-head"><div class="cc-emoji">${Icon(resolveCompanyIcon(c.icon ?? c.emoji))}</div><div><div class="cc-name">${escapeHtml(c.name)}</div><div class="cc-loc">${Icon('pin')} ${escapeHtml(c.il)} / ${escapeHtml(c.ilce)}</div></div></div>
      <div class="cc-tags">${(c.inputs||[]).slice(0,2).map(t=>`<span class="cc-tag in">${Icon('component')} ${escapeHtml(t)}</span>`).join('')}${(c.outputs||[]).slice(0,2).map(t=>`<span class="cc-tag out">${Icon('recycle')} ${escapeHtml(t)}</span>`).join('')}</div>
      <div class="cc-footer">
        <div class="cc-emission">%${escapeHtml(c.emission||0)} <span class="cc-emission-label">emisyon</span></div>
        <div class="cc-actions">
          <button class="cc-btn view">Görüntüle</button>
           ${user.previewReadOnly ? '' : '<button class="cc-btn del">Sil</button>'}
        </div>
      </div>
    </div>`).join('') : emptyState('factory', emptyText);
  replaceList(g, html);
  setLoadState(g, false, cos?.length ? `${cos.length} şirket listelendi.` : emptyText);
}

document.getElementById('company-grid').addEventListener('click', e => {
  const button = e.target.closest('.cc-btn');
  if (!button) return;
  const { companyId } = button.closest('.company-card').dataset;
  if (button.classList.contains('del')) delCompany(companyId, button);
  else location.href = companyDetailUrl(companyId);
});

async function delCompany(id, opener) {
  if (!await showActionDialog('Şirketi sil', 'Bu şirket silinsin mi?', { opener, confirmDelete: true })) return;
  const res = await Companies.delete(id);
  if (!res.ok) {
    await showActionDialog('Şirket silinemedi', res.msg || 'Lütfen tekrar deneyin.');
    return;
  }
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
  errEl.textContent = ''; okEl.textContent = '';
  if (!name)   { errEl.innerHTML = Icon('warning') + ' Şirket adı zorunludur.'; return; }
  if (!sector) { errEl.innerHTML = Icon('warning') + ' Sektör seçiniz.'; return; }
  if (!il)     { errEl.innerHTML = Icon('warning') + ' İl seçiniz.'; return; }
  if (!ilce)   { errEl.innerHTML = Icon('warning') + ' İlçe seçiniz.'; return; }
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
    icon: document.querySelector('#emoji-grid :checked').value,
  });
  btn.disabled = false; btn.innerHTML = btnOrigHtml;
  if (!res.ok) { errEl.innerHTML = Icon('warning') + ' ' + escapeHtml(res.msg || 'Bir hata oluştu.'); return; }
  ['f-name','f-email','f-tel','f-web','f-desc'].forEach(id => document.getElementById(id).value = '');
  ['f-sector','f-size','f-il'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-ilce').value = ''; document.getElementById('f-ilce').disabled = true;
  document.getElementById('f-emission').value = 25; document.getElementById('em-val').textContent = '%25';
  inputs.length = 0; outputs.length = 0;
  document.querySelectorAll('#inp-wrap .tpill, #out-wrap .tpill').forEach(el => el.remove());
  document.getElementById('company-icon-factory').checked = true;
  okEl.innerHTML = Icon('check') + ' Şirket başarıyla ağa eklendi!';
  await renderOverview();
}

function switchMsgTab(tab) {
  currentMsgTab = tab;
  document.querySelectorAll('.msg-tab').forEach(button => {
    const selected = button.id === `mtab-${tab}`;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  renderMessages();
}

async function renderMessages() {
  const list = document.getElementById('msg-list');
  const request = ++messageListRequest;
  const type = currentMsgTab, inbound = type === 'in';
  if (list.dataset.tab !== type) {
    list.dataset.tab = type;
    lastMessageListHtml = null;
    setLoadState(list, true, 'Mesajlar yükleniyor…');
    replaceList(list, listSkeleton('msg-thread'));
  }
  const threads = await (inbound ? Messages.getThreadsForCompany() : Messages.getSentThreads()).catch(() => null);
  const companies = inbound && threads?.length ? await Companies.getByUser().catch(() => []) : [];
  if (request !== messageListRequest) return;
  const companyNames = new Map(companies.map(c => [String(c.id), c.name]));
  const emptyText = !threads ? 'Mesajlar yüklenemedi.' : inbound ? 'Henüz gelen mesaj yok.' : 'Henüz mesaj göndermediniz.';
  const html = threads?.length ? threads.map((t, index) => {
    const companyName = t.companyName ?? companyNames.get(String(t.companyId)) ?? '—';
    const hasUnread = t.unreadCount != null ? t.unreadCount > 0
      : (t.msgs ?? [t.lastMsg]).some(m => m && !m.read && (inbound ? !m.fromCompanyId : !!m.fromCompanyId));
    const preview = String(t.lastMsg?.text ?? '');
    const name = escapeHtml(inbound ? t.senderName : companyName);
    return `<div class="msg-thread${hasUnread?' unread':''}" data-conversation-id="${escapeHtml(t.conversationId)}"
                 data-company-name="${escapeHtml(companyName)}" data-type="${type}">
      <button type="button" class="mt-head" aria-haspopup="dialog" aria-label="${name} konuşmasını aç${hasUnread ? ', okunmamış' : ''}" aria-describedby="mt-company-${index} mt-preview-${index}">
        <span class="mt-avatar">${Icon(inbound ? 'user' : resolveCompanyIcon(t.companyIcon ?? t.companyEmoji))}</span>
        <span class="mt-info"><span class="mt-name">${name}</span><span class="mt-company" id="mt-company-${index}">${inbound ? escapeHtml(companyName) + ' şirketine' : 'Gönderilen konuşma'}</span></span>
        ${hasUnread ? '<span class="unread-dot" aria-hidden="true"></span>' : ''}
        <span class="mt-meta">${t.lastMsg ? escapeHtml(new Date(t.lastMsg.createdAt).toLocaleDateString('tr-TR')) : ''}</span>
      </button>
      <div class="mt-footer">
        <div class="mt-preview" id="mt-preview-${index}">${escapeHtml(preview.slice(0,100))}${preview.length>100?'…':''}</div>
        <button type="button" class="mt-delete" aria-label="${name} konuşmasını sil" aria-describedby="mt-company-${index}" aria-haspopup="dialog">Sil</button>
      </div>
    </div>`;
  }).join('') : emptyState(inbound ? 'chat' : 'upload', emptyText);
  if (lastMessageListHtml !== html) replaceList(list, lastMessageListHtml = html);
  setLoadState(list, false, threads?.length ? `${threads.length} konuşma listelendi.` : emptyText);
}

document.getElementById('msg-list').addEventListener('click', e => {
  const button = e.target.closest('.mt-head, .mt-delete');
  if (!button) return;
  const card = button.closest('.msg-thread');
  if (button.classList.contains('mt-delete')) deleteThread(card.dataset.conversationId, card.dataset.type, button);
  else openThread(card.dataset, button);
});

async function deleteThread(conversationId, type, opener) {
  if (!await showActionDialog('Konuşmayı sil', 'Bu konuşma silinsin mi?', { opener, confirmDelete: true })) return;
  const res = await Messages.deleteThread({ conversationId, type });
  if (!res.ok) {
    await showActionDialog('Konuşma silinemedi', res.msg || 'Lütfen tekrar deneyin.');
    return;
  }
  for (const [id, threadId] of unreadMessages) {
    if (threadId === conversationId) unreadMessages.delete(id);
  }
  setBadge(unreadMessages.size);
  if (currentConversation?.id === conversationId) closeModal();
  await renderMessages();
}

async function openThread({ conversationId, companyName, type }, opener) {
  currentConversation = { id: conversationId, type, opener };
  document.getElementById('modal-title').textContent = (companyName || 'Şirket') + ' — Konuşma';
  const box = document.getElementById('modal-msgs');
  box.innerHTML = listSkeleton('chat-bubble them');
  threadDialog.showModal();
  setLoadState(box, true, 'Konuşma yükleniyor…');
  if (await refreshModal()) await renderMessages();
}

function isOwnMessage(m, type) {
  return type === 'in' ? !!m.fromCompanyId : !m.fromCompanyId && String(m.fromUserId) === String(user.id);
}

function renderModalMsgs(msgs, thread) {
  const box = document.getElementById('modal-msgs');
  const emptyText = msgs ? 'Bu konuşmada henüz mesaj yok.' : 'Konuşma yüklenemedi.';
  const html = msgs?.length ? msgs.map(m => {
    const side = isOwnMessage(m, thread.type) ? 'me' : 'them';
    return `<div class="chat-message ${side}">
      <div class="chat-bubble ${side}">${escapeHtml(m.text)}</div>
      <div class="bubble-meta">${escapeHtml(m.fromName||'—')} · ${escapeHtml(new Date(m.createdAt).toLocaleString('tr-TR'))}</div>
    </div>`;
  }).join('') : emptyState('chat', emptyText);
  if (thread.lastHtml !== html) {
    box.innerHTML = thread.lastHtml = html;
    box.scrollTop = box.scrollHeight;
  }
  setLoadState(box, false, '');
}

async function refreshModal() {
  const thread = currentConversation;
  if (!thread || !threadDialog.open) return false;
  const request = ++modalRequest;
  const msgs = await Messages.getThreadMsgs(thread.id).catch(() => null);
  if (!threadDialog.open || thread !== currentConversation || request !== modalRequest) return false;
  renderModalMsgs(msgs, thread);
  if (!msgs) return false;
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
  if (!text || !thread || thread.sending) return;
  thread.sending = true;
  button.setAttribute('aria-disabled', 'true');
  const res = await Messages.reply({ conversationId: thread.id, type: thread.type, text });
  thread.sending = false;
  const threadStillOpen = thread === currentConversation && threadDialog.open;
  if (threadStillOpen) button.removeAttribute('aria-disabled');
  if (!res.ok) {
    if (threadStillOpen) await showActionDialog('Yanıt gönderilemedi', res.msg || 'Lütfen tekrar deneyin.');
    return;
  }
  if (threadStillOpen) {
    if (input.value === draft) input.value = '';
    await refreshModal();
  }
  await renderMessages();
}

function closeModal() {
  threadDialog.close();
}

threadDialog.addEventListener('close', () => {
  if (threadDialog.open) return;
  const opener = currentConversation?.opener;
  document.getElementById('reply-ta').value = '';
  threadDialog.querySelector('.modal-send').removeAttribute('aria-disabled');
  currentConversation = null;
  if (!actionDialog.open) restoreDashboardFocus(opener);
});

async function doLogout() {
  stopPolling?.();
  await Auth.logout();
  location.href = 'login.html';
}

document.getElementById('reply-ta').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendReply(); }
});
