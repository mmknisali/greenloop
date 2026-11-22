applyIcons();
if (new URLSearchParams(location.search).get('tab') === 'register') switchTab('register');

(async () => {
  const user = await navUser;
  if (user && !user.previewAdmin) location.href = 'dashboard.html';
})();

function switchTab(t) {
  document.getElementById('login-form').style.display    = t === 'login'    ? 'block' : 'none';
  document.getElementById('register-form').style.display = t === 'register' ? 'block' : 'none';
  for (const name of ['login', 'register']) {
    const tab = document.getElementById(`tab-${name}`);
    const selected = name === t;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
}

document.querySelector('.auth-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const next = document.activeElement.id === 'tab-login' ? 'register' : 'login';
  switchTab(next);
  document.getElementById(`tab-${next}`).focus();
});

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.innerHTML = Icon('warning') + ' ' + esc(msg);
  el.style.display = 'block';
}

function setLoading(btnId, on) {
  const btn = document.getElementById(btnId);
  btn.disabled = on;
  if (on) btn.dataset.orig = btn.textContent;
  btn.textContent = on ? 'Lütfen bekleyin...' : btn.dataset.orig;
}

async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  document.getElementById('login-err').style.display = 'none';
  if (!email || !pass) return showErr('login-err', 'Tüm alanları doldurun.');
  setLoading('btn-login', true);
  const res = await Auth.loginWithCredentials(email, pass);
  setLoading('btn-login', false);
  if (!res.ok) return showErr('login-err', res.msg);
  location.href = 'dashboard.html';
}

async function doRegister() {
  const ad    = document.getElementById('r-ad').value.trim();
  const soyad = document.getElementById('r-soyad').value.trim();
  const email = document.getElementById('r-email').value.trim();
  const tel   = document.getElementById('r-tel').value.trim();
  const pass  = document.getElementById('r-pass').value;
  const pass2 = document.getElementById('r-pass2').value;
  document.getElementById('reg-err').style.display = 'none';
  if (!ad || !soyad || !email || !pass) return showErr('reg-err', 'Zorunlu alanları doldurun.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('reg-err', 'Geçerli bir e-posta girin.');
  if (pass.length < 6)  return showErr('reg-err', 'Şifre en az 6 karakter olmalı.');
  if (pass !== pass2)   return showErr('reg-err', 'Şifreler eşleşmiyor.');
  setLoading('btn-register', true);
  const res = await Auth.register({ ad, soyad, email, tel, password: pass });
  setLoading('btn-register', false);
  if (!res.ok) return showErr('reg-err', res.msg);
  location.href = 'dashboard.html';
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing || !e.target.matches('input')) return;
  if (document.getElementById('login-form').style.display !== 'none') doLogin();
  else doRegister();
});
