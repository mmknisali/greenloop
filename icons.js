/* GreenLoop – paylaşılan SVG ikon kütüphanesi.
   Emoji yerine tutarlı, tek stilde çizgi ikonlar kullanmak için. */
const ICONS = {
  factory:      '<path d="M4 21V11l4.5 2.8V11l4.5 2.8V11l4.5 2.8V8h2.5v13H4z"/><path d="M4 21h18"/>',
  link:         '<path d="M9 15l6-6"/><path d="M8.5 13.2a4 4 0 0 1 0-5.7l2-2a4 4 0 1 1 5.7 5.7l-1 1"/><path d="M15.5 10.8a4 4 0 0 1 0 5.7l-2 2a4 4 0 1 1-5.7-5.7l1-1"/>',
  chat:         '<path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4c-1.3 0-2.6-.3-3.7-.9L3 21l2-5.8a8.3 8.3 0 0 1-.9-3.7A8.4 8.4 0 0 1 12.6 3a8.4 8.4 0 0 1 8.4 8.5z"/>',
  chart:        '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="12" width="3" height="8"/><rect x="11" y="7" width="3" height="13"/><rect x="16" y="10" width="3" height="10"/>',
  leaf:         '<path d="M6 20c8 0 14-6 14-14V4h-2C10 4 4 10 4 18v2h2z"/><path d="M4 20l6-6"/>',
  recycle:      '<path d="M4 12a8 8 0 0 1 14.5-5"/><path d="M15 3l3 3-3 1"/><path d="M20 12a8 8 0 0 1-14.5 5"/><path d="M9 21l-3-3 3-1"/>',
  refresh:      '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  warning:      '<path d="M12 2.5L2 21h20L12 2.5z"/><line x1="12" y1="9.5" x2="12" y2="14"/><circle cx="12" cy="17.3" r=".6" fill="currentColor" stroke="none"/>',
  ai:           '<rect x="5" y="9" width="14" height="10" rx="2"/><circle cx="9.2" cy="14" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="14" r="1.1" fill="currentColor" stroke="none"/><path d="M12 9V5"/><circle cx="12" cy="4" r="1.2"/><path d="M3 13h2"/><path d="M19 13h2"/>',
  network:      '<circle cx="6" cy="6" r="2.1"/><circle cx="18" cy="6" r="2.1"/><circle cx="6" cy="18" r="2.1"/><circle cx="18" cy="18" r="2.1"/><circle cx="12" cy="12" r="2.1"/><line x1="7.7" y1="7.7" x2="10.2" y2="10.2"/><line x1="16.3" y1="7.7" x2="13.8" y2="10.2"/><line x1="7.7" y1="16.3" x2="10.2" y2="13.8"/><line x1="16.3" y1="16.3" x2="13.8" y2="13.8"/>',
  arrowRight:   '<line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/>',
  arrowLeft:    '<line x1="20" y1="12" x2="4" y2="12"/><polyline points="10 6 4 12 10 18"/>',
  arrowDown:    '<line x1="12" y1="4" x2="12" y2="20"/><polyline points="6 14 12 20 18 14"/>',
  check:        '<polyline points="4 12 9 17 20 6"/>',
  plus:         '<line x1="12" y1="4" x2="12" y2="20"/><line x1="4" y1="12" x2="20" y2="12"/>',
  minus:        '<line x1="4" y1="12" x2="20" y2="12"/>',
  close:        '<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>',
  upload:       '<path d="M12 19V5"/><polyline points="6 11 12 5 18 11"/><path d="M4 21h16"/>',
  download:     '<path d="M12 5v14"/><polyline points="6 13 12 19 18 13"/><path d="M4 21h16"/>',
  search:       '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="20" y1="20" x2="15.3" y2="15.3"/>',
  pin:          '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.3"/>',
  calendar:     '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
  building:     '<rect x="4" y="3" width="16" height="18"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>',
  users:        '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="8" r="2.4"/><path d="M15.5 14.6c2.6.4 4.5 2.3 4.5 5.4"/>',
  user:         '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/>',
  clipboard:    '<rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="15" y2="15"/>',
  palette:      '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-.6-.3-1-.6-1.4-.3-.4-.6-.8-.6-1.4 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-7.4-9-7.4z"/><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="7.5" r="1" fill="currentColor" stroke="none"/>',
  rocket:       '<path d="M13 2c3 0 6 3 6 7 0 4-3 7-3 7l-3 3-3-3s-3-3-3-7c0-4 3-7 6-7z"/><circle cx="13" cy="9" r="1.6"/><path d="M8 16l-3 3 1-4"/><path d="M18 16l3 3-1-4"/>',
  edit:         '<path d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/><line x1="14" y1="7" x2="17" y2="10"/>',
  sparkle:      '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>',
  microscope:   '<path d="M9 21h7"/><path d="M12 21v-4"/><path d="M7 17a5 5 0 0 1 5-5 5 5 0 0 1 5 5"/><path d="M9 12V8l3-3 3 3"/><line x1="14" y1="6" x2="17" y2="3"/>',
  map:          '<polygon points="9 3 3 6 3 20 9 17 15 20 21 17 21 3 15 6 9 3"/><line x1="9" y1="3" x2="9" y2="17"/><line x1="15" y1="6" x2="15" y2="20"/>',
  handshake:    '<path d="M2 12l4-3 3 2 3-2 3 2 3-2 4 3"/><path d="M8 11l3 3 2-2"/><path d="M13 12l3 3"/>',
  trendDown:    '<polyline points="3 7 10 14 14 10 21 17"/><polyline points="21 10 21 17 14 17"/>',
  globe:        '<circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9z"/>',
  component:    '<polygon points="12 2 20 7 20 17 12 22 4 17 4 7 12 2"/><circle cx="12" cy="12" r="3"/>',
  wheat:        '<path d="M12 22V6"/><path d="M12 6l-3 3M12 6l3 3M12 10l-3 3M12 10l3 3M12 14l-3 3M12 14l3 3"/>',
  thread:       '<circle cx="12" cy="7" r="3"/><circle cx="12" cy="17" r="3"/><line x1="9.5" y1="9" x2="9.5" y2="15"/><line x1="14.5" y1="9" x2="14.5" y2="15"/>',
  coffee:       '<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c0 1-1 1-1 2s1 1 1 2M12 3c0 1-1 1-1 2s1 1 1 2"/>',
  flask:        '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><line x1="7.5" y1="14" x2="16.5" y2="14"/>',
  brick:        '<rect x="3" y="4" width="18" height="16"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="9" y1="4" x2="9" y2="10"/><line x1="15" y1="10" x2="15" y2="16"/><line x1="9" y1="16" x2="9" y2="20"/>',
  battery:      '<rect x="2" y="8" width="18" height="8" rx="1.5"/><line x1="22" y1="11" x2="22" y2="13"/><line x1="5" y1="11" x2="5" y2="13"/><line x1="9" y1="10.5" x2="9" y2="13.5"/>',
  pill:         '<path d="M4.5 14.5l6-6a4 4 0 1 1 5.6 5.6l-6 6a4 4 0 1 1-5.6-5.6z"/><line x1="8.5" y1="10.5" x2="13.5" y2="15.5"/>',
  barrel:       '<rect x="6" y="3" width="12" height="18" rx="2"/><line x1="6" y1="8" x2="18" y2="8"/><line x1="6" y1="16" x2="18" y2="16"/>',
  package:      '<path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v9l9 5 9-5V8"/><line x1="12" y1="13" x2="12" y2="22"/>',
  wave:         '<path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0"/><path d="M2 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0"/>',
  energy:       '<polygon points="13 2 4 14 11 14 10 22 20 9 13 9 13 2"/>',
  plug:         '<path d="M9 2v6M15 2v6"/><path d="M6 8h12v4a6 6 0 0 1-12 0V8z"/><path d="M12 18v4"/>',
  construction: '<path d="M4 18a8 8 0 0 1 16 0"/><line x1="2" y1="18" x2="22" y2="18"/><line x1="12" y1="6" x2="12" y2="9"/>',
  truck:        '<rect x="1" y="8" width="13" height="8"/><path d="M14 11h4l3 3v2h-7z"/><circle cx="6" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>'
};

function Icon(name, cls) {
  const p = ICONS[name] || ICONS.component;
  return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
}

/* D3/SVG bağlamları için: tüm ikonları tek bir <defs><symbol> seti olarak döndürür,
   böylece grafik gibi ham SVG tuvallerinde <use href="#i-NAME"/> ile kullanılabilir. */
function iconSymbolDefs() {
  return '<defs>' + Object.keys(ICONS).map(function (name) {
    return '<symbol id="i-' + name + '" viewBox="0 0 24 24">' + ICONS[name] + '</symbol>';
  }).join('') + '</defs>';
}

/* Sektör / atık simgesi seçimi için: eski emoji verisiyle geriye dönük uyumluluk. */
const SECTOR_ICON_KEYS = ['factory','wheat','thread','coffee','flask','leaf','brick','recycle',
  'battery','pill','barrel','package','wave','energy','plug','construction','truck','component'];

const LEGACY_EMOJI_TO_ICON = {
  '🏭':'factory','🌾':'wheat','🧵':'thread','☕':'coffee','⚗️':'flask','⚗':'flask','🔩':'component',
  '🌿':'leaf','🧱':'brick','♻️':'recycle','♻':'recycle','🔋':'battery','💊':'pill','🛢️':'barrel',
  '🛢':'barrel','🥩':'package','🌊':'wave','⚡':'energy','🔌':'plug','🏗️':'construction','🏗':'construction',
  '🚛':'truck'
};

/* Statik HTML içinde data-icon="isim" [data-icon-class="ek-sinif"] taşıyan
   her elemanın içeriğini ilgili SVG ikonla doldurur. */
function applyIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
    el.innerHTML = Icon(el.getAttribute('data-icon'), el.getAttribute('data-icon-class') || '');
  });
}

/* company.icon alanı ya yeni bir ikon anahtarı (ör. "factory") ya da eski bir emoji
   karakteri olabilir; ikisini de aynı SVG ikonuna çözer. */
function resolveCompanyIcon(value) {
  if (!value) return 'factory';
  if (ICONS[value]) return value;
  return LEGACY_EMOJI_TO_ICON[value] || 'factory';
}
