document.getElementById('btn-explore').innerHTML     = Icon('network') + ' Ağı Keşfet';
document.getElementById('btn-ai').innerHTML           = Icon('ai') + ' AI ile Konuş';
document.getElementById('btn-network').innerHTML      = Icon('network') + ' Ağı Görüntüle';
document.getElementById('btn-register').innerHTML     = 'Hesap Oluştur ' + Icon('arrowRight');
document.getElementById('about-tag').innerHTML        = Icon('sparkle') + ' Proje';
document.getElementById('recovery-tag').innerHTML      = Icon('recycle') + ' Potansiyel';
document.getElementById('stats-tag').innerHTML         = Icon('chart') + ' Etki';
document.getElementById('network-tag').innerHTML      = Icon('network') + ' Ağ';
document.getElementById('chat-header-avatar').innerHTML = Icon('ai');
document.getElementById('cmsg-avatar-0').innerHTML    = Icon('ai');

document.getElementById('flow-steps').innerHTML = [
  ['green','factory','Atık Verisi Yüklenir','Şirket atık ve hammadde bilgisini sisteme girer'],
  ['yellow','component','Sistem Analiz Eder','Atık türü ve olası kullanım alanları belirlenir'],
  ['blue','link','Eşleştirme Yapılır','Uygun sektörler ve şirketler önerilir'],
  ['teal','leaf','Emisyon Tasarrufu','Karbon azaltım miktarı hesaplanır']
].map(function (s, i, arr) {
  var step = '<div class="flow-step"><div class="step-icon ' + s[0] + '">' + Icon(s[1]) + '</div>' +
    '<div class="step-text"><strong>' + s[2] + '</strong><span>' + s[3] + '</span></div></div>';
  return i < arr.length - 1 ? step + '<div class="flow-arrow">' + Icon('arrowDown') + '</div>' : step;
}).join('');

document.getElementById('feature-grid').innerHTML = [
  ['factory','Şirket profili oluşturun','Atık ve hammadde ihtiyaçlarınızı, sektörünüzü ve konumunuzu sisteme girin'],
  ['link','Otomatik eşleşme görün','Sistem şehir, sektör ve atık uyumuna göre olası ortakları sıralar'],
  ['chat','Doğrudan mesajlaşın','Eşleşen şirketlerle platform üzerinden doğrudan iletişime geçin'],
  ['network','Ağı haritada izleyin','Tüm şirketleri ve aralarındaki bağlantıları interaktif grafikte görün']
].map(function (f) {
  return '<div class="feature-card reveal"><div class="feature-icon">' + Icon(f[0]) + '</div>' +
    '<div class="feature-body"><strong>' + f[1] + '</strong><span>' + f[2] + '</span></div></div>';
}).join('');

const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

const barObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.style.width = (parseFloat(e.target.dataset.width) * 100) + '%';
    barObs.unobserve(e.target);
  });
}, { threshold: .4 });
document.querySelectorAll('.bar-fill').forEach(el => barObs.observe(el));

function animateCounter(el, target) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = target;
    return;
  }
  const dur = 1400, t0 = performance.now();
  function step(t) {
    const p = Math.min((t - t0) / dur, 1);
    el.textContent = Math.floor(p * target);
    if (p < 1) requestAnimationFrame(step); else el.textContent = target;
  }
  requestAnimationFrame(step);
}
const counterObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    animateCounter(e.target, parseInt(e.target.dataset.target, 10));
    counterObs.unobserve(e.target);
  });
}, { threshold: .4 });
document.querySelectorAll('.stat-number').forEach(el => counterObs.observe(el));

const chatHistory = [];
let isLoading = false;
const msgBox  = document.getElementById('chat-messages');
const ta      = document.getElementById('chat-textarea');
const sendBtn = document.getElementById('chat-send');
const errBox  = document.getElementById('chat-error');
const chatFailed = 'Yanıt alınamadı. Lütfen tekrar deneyin.';

function mdInline(text, companies) {
  const tokens = /`([^`]+)`|\[([^\]]+)\]\(([^()]*)\)|\*\*(.+?)\*\*|\*([^*]+)\*/g;
  let html = '', end = 0;
  for (const token of text.matchAll(tokens)) {
    const [raw, code, label, target, bold, italic] = token;
    html += escapeHtml(text.slice(end, token.index));
    if (code !== undefined) {
      html += `<code>${escapeHtml(code)}</code>`;
    } else if (label !== undefined) {
      // Resolve the citation ID, never the model's label or URL.
      const id = /^(?:company:|(?:\.\/)?company-detail\.html\?id=)([^\s&?#]+)$/.exec(target);
      let company;
      if (id) {
        try { company = companies.get(decodeURIComponent(id[1])); } catch (_) {}
      }
      html += company
        ? `<a class="chat-company-card" href="${escapeHtml(companyDetailUrl(company.id))}"><strong>${escapeHtml(company.name)}</strong><small>${Icon('pin')} ${escapeHtml(company.il)}</small></a>`
        : escapeHtml(label);
    } else if (bold !== undefined) {
      html += `<strong>${mdInline(bold, companies)}</strong>`;
    } else {
      html += `<em>${mdInline(italic, companies)}</em>`;
    }
    end = token.index + raw.length;
  }
  return html + escapeHtml(text.slice(end));
}

function mdParse(text, companies) {
  const lines = text.split(/\r\n?|\n/);
  const blocks = [];
  let list = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const item = /^[-*] (.+)$/.exec(line);
    if (item) {
      if (!list) blocks.push('<ul>');
      list = true;
      blocks.push(`<li>${mdInline(item[1], companies)}</li>`);
      continue;
    }
    if (list) blocks.push('</ul>');
    list = false;
    if (line.startsWith('```')) {
      const start = ++i;
      while (i < lines.length && !lines[i].startsWith('```')) i++;
      blocks.push(`<pre><code>${escapeHtml(lines.slice(start, i).join('\n'))}</code></pre>`);
    } else if (line.startsWith('### ')) {
      blocks.push(`<h3>${mdInline(line.slice(4), companies)}</h3>`);
    } else if (line.startsWith('> ')) {
      blocks.push(`<blockquote>${mdInline(line.slice(2), companies)}</blockquote>`);
    } else if (line.trim()) {
      blocks.push(`<p>${mdInline(line, companies)}</p>`);
    }
  }
  if (list) blocks.push('</ul>');
  return blocks.join('');
}

class ChatError extends Error {}

function chatErrorMessage(payload, fallback = chatFailed) {
  if (payload?.ok === false && typeof payload.msg === 'string') return payload.msg.trim() || fallback;
  return fallback;
}

function addChatMessage(role, html) {
  const wrap = document.createElement('div');
  wrap.className = `cmsg ${role}`;
  wrap.innerHTML = `<div class="cmsg-avatar">${Icon(role === 'user' ? 'user' : 'ai')}</div><div class="cmsg-bubble">${html}</div>`;
  msgBox.appendChild(wrap);
  return wrap;
}

async function readReply(res, bubble) {
  if (!res.body) throw new ChatError(chatFailed);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const companies = new Map();
  let buffer = '', reply = '', event = '', data = [], finished = false;

  function dispatch() {
    const kind = event || 'message';
    const payload = data.join('\n');
    event = '';
    data = [];
    if (!payload || !['message', 'companies', 'reset', 'error'].includes(kind)) return;
    if (kind === 'message' && payload.trim() === '[DONE]') {
      finished = true;
      return;
    }
    const envelope = JSON.parse(payload);
    if (envelope?.ok !== true || kind === 'error') throw new ChatError(chatErrorMessage(envelope));
    if (kind === 'reset') {
      reply = '';
    } else if (kind === 'companies') {
      if (!Array.isArray(envelope.data)) throw new ChatError(chatFailed);
      companies.clear();
      for (const company of envelope.data) {
        if (company && (typeof company.id === 'string' || Number.isSafeInteger(company.id)) &&
            String(company.id) && typeof company.name === 'string' && typeof company.il === 'string') {
          companies.set(String(company.id), company);
        }
      }
    } else if (typeof envelope.data?.text === 'string') {
      reply += envelope.data.text;
    } else {
      throw new ChatError(chatFailed);
    }
  }

  try {
    while (!finished) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() + '\n\n' : decoder.decode(value, { stream: true });
      // Keep a trailing CR until the next chunk in case it is part of CRLF.
      const trailingCR = !done && buffer.endsWith('\r');
      const lines = (trailingCR ? buffer.slice(0, -1) : buffer).split(/\r\n?|\n/);
      buffer = lines.pop() + (trailingCR ? '\r' : '');
      const previousReply = reply;
      for (const line of lines) {
        if (!line) dispatch();
        else if (line === 'event' || line.startsWith('event:')) event = line.slice(6).replace(/^ /, '');
        else if (line === 'data' || line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        if (finished) break;
      }
      if (reply !== previousReply) {
        const atBottom = msgBox.scrollHeight - msgBox.scrollTop - msgBox.clientHeight < 32;
        bubble.innerHTML = mdParse(reply, companies);
        if (atBottom) msgBox.scrollTop = msgBox.scrollHeight;
      }
      if (done) break;
    }
    if (!finished) throw new ChatError('Yanıt yarıda kesildi. Lütfen tekrar deneyin.');
    return reply.trim();
  } finally {
    reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function resizeChatInput() {
  ta.style.height = '44px';
  ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
}

async function sendMsg() {
  const text = ta.value.trim();
  if (!text || isLoading) return;
  ta.value = '';
  resizeChatInput();
  errBox.textContent = '';
  isLoading = true;
  sendBtn.disabled = true;
  msgBox.setAttribute('aria-busy', 'true');

  const question = { role: 'user', content: text };
  const user = addChatMessage('user', `<p>${escapeHtml(text)}</p>`);
  const assistant = addChatMessage('assistant', '<div class="typing-dots" aria-label="Yanıt hazırlanıyor"><span></span><span></span><span></span></div>');
  msgBox.scrollTop = msgBox.scrollHeight;

  try {
    let res;
    try {
      res = await fetch(`${API}/chat.php`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream, application/json' },
        body: JSON.stringify({ messages: [...chatHistory.slice(-6), question] }),
      });
    } catch (_) {
      throw new ChatError('Sohbet sunucusuna ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.');
    }

    if (!res.ok || res.headers.get('content-type')?.includes('application/json')) {
      const payload = await res.json().catch(() => null);
      const fallback = res.status === 429 ? 'Çok fazla istek gönderdiniz. Biraz bekleyip tekrar deneyin.' : chatFailed;
      throw new ChatError(chatErrorMessage(payload, fallback));
    }

    const reply = await readReply(res, assistant.querySelector('.cmsg-bubble'));
    if (!reply) throw new ChatError('Asistan boş yanıt verdi. Sorunuzu farklı bir şekilde yazıp tekrar deneyin.');
    chatHistory.push(question, { role: 'assistant', content: reply });
  } catch (err) {
    assistant.remove();
    if (!ta.value) {
      user.remove();
      ta.value = text;
      resizeChatInput();
    }
    errBox.textContent = err instanceof ChatError ? err.message : chatFailed;
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    msgBox.setAttribute('aria-busy', 'false');
  }
}

document.getElementById('chat-form').addEventListener('submit', e => { e.preventDefault(); sendMsg(); });
ta.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMsg(); }
});
ta.addEventListener('input', resizeChatInput);
document.querySelectorAll('.chat-prompt').forEach(chip => {
  chip.addEventListener('click', () => {
    ta.value = chip.textContent.trim();
    resizeChatInput();
    ta.focus();
  });
});
