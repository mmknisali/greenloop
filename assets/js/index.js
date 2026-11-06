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

const OLLAMA_URL   = 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = 'qwen2.5:3b';
const SYSTEM_PROMPT = `Ben GreenLoop platformunun yapay zeka asistanıyım. GreenLoop, ReSource takımı tarafından geliştirilmiş, endüstriyel atıkları döngüsel ekonomi mantığıyla değere dönüştüren bir platformdur.

Sadece şu konularda yardım et:
- Endüstriyel ve evsel atık türleri, geri dönüşüm yöntemleri
- Atıkların hangi sektörlerde hammadde olarak kullanılabileceği
- Karbon emisyonu azaltımı ve sürdürülebilirlik
- Döngüsel ekonomi modelleri ve uygulamaları
- Türkiye ve dünyadan atık yönetimi örnekleri
Kendini tanıtmanı isterlerse ReSource takımı tarafından yapıldığını güzel bir şekilde belirt.

Bu konuların dışında gelen sorulara nazikçe şunu söyle: "Bu konuda yardımcı olamam, ben yalnızca atık yönetimi ve döngüsel ekonomi konularında destek veriyorum."

Yanıtlarını Türkçe ver. Kısa, anlaşılır ve pratik ol. Teknik terimleri açıkla.`;

(async () => {
  const cu = await Auth.getCurrent();
  if (cu) {
    document.getElementById('nav-right').innerHTML = `
      <span style="font-size:.82rem;color:var(--text-mid);">${cu.ad} ${cu.soyad}</span>
      <a href="dashboard.html" class="nav-btn">Panel ${Icon('arrowRight')}</a>`;
  }
})();

window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('scrolled', window.scrollY > 40);
});

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

let chatHistory = [], isLoading = false;
const msgBox  = document.getElementById('chat-messages');
const ta      = document.getElementById('chat-textarea');
const sendBtn = document.getElementById('chat-send');
const errBox  = document.getElementById('chat-error');

function mdParse(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_,c) => `<pre><code>${c.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')
    .replace(/^([^<].+)$/, '<p>$1</p>');
}

function esc(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function sendMsg() {
  const text = ta.value.trim();
  if (!text || isLoading) return;
  ta.value = ''; ta.style.height = '44px';
  errBox.style.display = 'none';
  isLoading = true; sendBtn.disabled = true;

  chatHistory.push({ role: 'user', content: text });

  const uDiv = document.createElement('div');
  uDiv.className = 'cmsg user';
  uDiv.innerHTML = `<div class="cmsg-avatar">${Icon('user')}</div><div class="cmsg-bubble"><p>${esc(text)}</p></div>`;
  msgBox.appendChild(uDiv);

  const tyDiv = document.createElement('div');
  tyDiv.className = 'cmsg assistant'; tyDiv.id = 'typing';
  tyDiv.innerHTML = `<div class="cmsg-avatar">${Icon('ai')}</div><div class="cmsg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  msgBox.appendChild(tyDiv);
  msgBox.scrollTop = msgBox.scrollHeight;

  try {
       const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...chatHistory.slice(-8)],
      stream: true,
      keep_alive: '30m',
      options: { num_ctx: 2048, num_predict: 400, temperature: 0.3 },
    }),
  });

    document.getElementById('typing')?.remove();
    if (!res.ok) throw new Error('Sunucu hatası ' + res.status);

    const wrap = document.createElement('div');
    wrap.className = 'cmsg assistant';
    wrap.innerHTML = `<div class="cmsg-avatar">${Icon('ai')}</div><div class="cmsg-bubble"></div>`;
    msgBox.appendChild(wrap);
    const bubble = wrap.querySelector('.cmsg-bubble');

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', reply = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const j = JSON.parse(line);
        reply += j.message?.content || '';
        bubble.innerHTML = mdParse(reply);
        msgBox.scrollTop = msgBox.scrollHeight;
      }
    }
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    document.getElementById('typing')?.remove();
    errBox.innerHTML = Icon('warning') + ' ' + esc(err.message);
    errBox.style.display = 'block';
    chatHistory.pop();
  } finally {
    isLoading = false; sendBtn.disabled = false; ta.focus();
  }
}

sendBtn.addEventListener('click', sendMsg);
ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
ta.addEventListener('input', () => { ta.style.height = '44px'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
