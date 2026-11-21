const navUser = Auth.getCurrent();

(() => {
  const logo = className => `<a class="${className}" href="index.html">GreenLoop<span class="dot">.</span></a>`;
  const links = items => `<ul class="nav-links">${items.map(([href, label, active]) =>
    `<li><a href="${href}"${active ? ' class="active" aria-current="page"' : ''}>${label}</a></li>`).join('')}</ul>`;
  const templates = {
    home: () => logo('nav-logo') + links([
      ['#about', 'Proje'], ['network.html', 'Atık Ağı'], ['#chat-section', 'AI Asistan'],
    ]) + '<div class="nav-right"><a href="login.html" class="nav-btn outline">Giriş Yap</a><a href="login.html?tab=register" class="nav-btn">Hesap Oluştur</a></div>',
    network: () => logo('nav-logo') + links([
      ['index.html', 'Ana Sayfa'], ['network.html', 'Atık Ağı', true],
    ]) + '<div class="nav-right"><a href="login.html" class="nav-login">Giriş Yap</a><a href="login.html" class="nav-cta">Şirket Ekle</a></div>',
    detail: () => logo('nav-logo') + `<a class="nav-back" href="network.html">${Icon('arrowLeft')} Atık Ağına Dön</a>`,
    login: () => logo('brand'),
    sidebar: () => logo('sb-brand'),
    mobile: () => logo('mob-logo'),
  };

  document.querySelectorAll('[data-nav]').forEach(el => {
    const variant = el.dataset.nav;
    el.innerHTML = templates[variant]();
    if (variant === 'home') {
      const sync = () => el.classList.toggle('scrolled', window.scrollY > 40);
      window.addEventListener('scroll', sync, { passive: true });
      sync();
    }
    if (variant === 'home' || variant === 'network') navUser.then(user => {
      if (!user) return;
      const home = variant === 'home';
      el.querySelector('.nav-right').innerHTML = `
        <span class="nav-user">${esc(user.ad)} ${esc(user.soyad)}</span>
        <a href="dashboard.html" class="${home ? 'nav-btn' : 'nav-cta'}">Panel${home ? ' ' + Icon('arrowRight') : ''}</a>`;
    });
  });

  const fields = document.querySelectorAll('[data-nav-user]');
  if (fields.length) navUser.then(user => {
    if (!user) return;
    const values = { full: `${user.ad} ${user.soyad}`, first: user.ad, email: user.email };
    fields.forEach(el => { el.textContent = values[el.dataset.navUser]; });
  });
})();
