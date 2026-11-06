applyIcons();
let allCompanies = [];

const IL_COORDS = {
  'Adana':{lat:37.00,lon:35.32},'Adıyaman':{lat:37.76,lon:38.27},'Afyonkarahisar':{lat:38.75,lon:30.54},
  'Ağrı':{lat:39.72,lon:43.05},'Amasya':{lat:40.65,lon:35.83},'Ankara':{lat:39.92,lon:32.85},
  'Antalya':{lat:36.89,lon:30.71},'Ardahan':{lat:41.11,lon:42.70},'Artvin':{lat:41.18,lon:41.82},
  'Aydın':{lat:37.84,lon:27.84},'Balıkesir':{lat:39.64,lon:27.88},'Bartın':{lat:41.63,lon:32.34},
  'Batman':{lat:37.88,lon:41.13},'Bayburt':{lat:40.26,lon:40.23},'Bilecik':{lat:40.14,lon:29.98},
  'Bingöl':{lat:38.88,lon:40.50},'Bitlis':{lat:38.40,lon:42.12},'Bolu':{lat:40.73,lon:31.60},
  'Burdur':{lat:37.72,lon:30.29},'Bursa':{lat:40.19,lon:29.06},'Çanakkale':{lat:40.15,lon:26.41},
  'Çankırı':{lat:40.60,lon:33.62},'Çorum':{lat:40.55,lon:34.95},'Denizli':{lat:37.77,lon:29.09},
  'Diyarbakır':{lat:37.91,lon:40.23},'Düzce':{lat:40.84,lon:31.16},'Edirne':{lat:41.68,lon:26.56},
  'Elazığ':{lat:38.67,lon:39.22},'Erzincan':{lat:39.75,lon:39.49},'Erzurum':{lat:39.91,lon:41.27},
  'Eskişehir':{lat:39.78,lon:30.52},'Gaziantep':{lat:37.07,lon:37.38},'Giresun':{lat:40.92,lon:38.39},
  'Gümüşhane':{lat:40.46,lon:39.48},'Hakkari':{lat:37.57,lon:43.74},'Hatay':{lat:36.40,lon:36.35},
  'Iğdır':{lat:39.89,lon:44.05},'Isparta':{lat:37.76,lon:30.55},'İstanbul':{lat:41.01,lon:28.96},
  'İzmir':{lat:38.42,lon:27.13},'Kahramanmaraş':{lat:37.59,lon:36.94},'Karabük':{lat:41.20,lon:32.62},
  'Karaman':{lat:37.18,lon:33.22},'Kars':{lat:40.61,lon:43.10},'Kastamonu':{lat:41.38,lon:33.78},
  'Kayseri':{lat:38.73,lon:35.49},'Kırıkkale':{lat:39.85,lon:33.51},'Kırklareli':{lat:41.73,lon:27.23},
  'Kırşehir':{lat:39.15,lon:34.17},'Kilis':{lat:36.72,lon:37.12},'Kocaeli':{lat:40.76,lon:29.92},
  'Konya':{lat:37.87,lon:32.49},'Kütahya':{lat:39.42,lon:29.99},'Malatya':{lat:38.35,lon:38.31},
  'Manisa':{lat:38.62,lon:27.43},'Mardin':{lat:37.31,lon:40.74},'Mersin':{lat:36.81,lon:34.64},
  'Muğla':{lat:37.21,lon:28.36},'Muş':{lat:38.73,lon:41.49},'Nevşehir':{lat:38.62,lon:34.72},
  'Niğde':{lat:37.97,lon:34.68},'Ordu':{lat:40.98,lon:37.88},'Osmaniye':{lat:37.07,lon:36.25},
  'Rize':{lat:41.03,lon:40.52},'Sakarya':{lat:40.78,lon:30.40},'Samsun':{lat:41.29,lon:36.33},
  'Siirt':{lat:37.93,lon:41.95},'Sinop':{lat:42.03,lon:35.15},'Sivas':{lat:39.75,lon:37.01},
  'Şanlıurfa':{lat:37.16,lon:38.79},'Şırnak':{lat:37.52,lon:42.46},'Tekirdağ':{lat:40.98,lon:27.51},
  'Tokat':{lat:40.32,lon:36.55},'Trabzon':{lat:41.00,lon:39.73},'Tunceli':{lat:39.11,lon:39.55},
  'Uşak':{lat:38.68,lon:29.41},'Van':{lat:38.49,lon:43.38},'Yalova':{lat:40.65,lon:29.27},
  'Yozgat':{lat:39.82,lon:34.81},'Zonguldak':{lat:41.45,lon:31.80}
};

function haversine(il1, il2) {
  const c1 = IL_COORDS[il1], c2 = IL_COORDS[il2];
  if (!c1 || !c2) return null;
  const R = 6371, dLat = (c2.lat - c1.lat) * Math.PI / 180, dLon = (c2.lon - c1.lon) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(c1.lat*Math.PI/180) * Math.cos(c2.lat*Math.PI/180) * Math.sin(dLon/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

async function init() {
  const cu = await Auth.getCurrent();
  if (cu) {
    document.getElementById('nav-right').innerHTML =
      `<span class="nav-user">${cu.ad} ${cu.soyad}</span><a href="dashboard.html" class="nav-cta">Panel</a>`;
  }
  allCompanies = await Companies.getAll();
  updateStats();
  populateFilters();
  renderCards();
  buildGraph();
}

function updateStats() {
  document.getElementById('stat-total').textContent   = allCompanies.length;
  document.getElementById('stat-cities').textContent  = new Set(allCompanies.map(c => c.il).filter(Boolean)).size;
  document.getElementById('stat-sectors').textContent = new Set(allCompanies.map(c => c.sector).filter(Boolean)).size;
}

function populateFilters() {
  const sEl     = document.getElementById('sector-filter');
  const cEl     = document.getElementById('city-filter');
  const sectors = [...new Set(allCompanies.map(c => c.sector).filter(Boolean))].sort();
  const cities  = [...new Set(allCompanies.map(c => c.il).filter(Boolean))].sort();
  sEl.innerHTML = '<option value="">Tüm Sektörler</option>' + sectors.map(s => `<option value="${s}">${s}</option>`).join('');
  cEl.innerHTML = '<option value="">Tüm Şehirler</option>'  + cities.map(c  => `<option value="${c}">${c}</option>`).join('');
}

function renderCards() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const sF     = document.getElementById('sector-filter').value;
  const cF     = document.getElementById('city-filter').value;
  const data   = allCompanies.filter(c => {
    if (sF && c.sector !== sF) return false;
    if (cF && c.il     !== cF) return false;
    if (search && !c.name.toLowerCase().includes(search) && !(c.il||'').toLowerCase().includes(search)) return false;
    return true;
  });
  const grid = document.getElementById('cards-grid');
  if (!data.length) { grid.innerHTML = '<div class="empty-cards"><div class="eic">' + Icon('search') + '</div><p>Sonuç bulunamadı.</p></div>'; return; }
  grid.innerHTML = data.map(c => `
    <a class="member-card" href="company-detail.html?id=${c.id}">
      <div class="mc-top"><div class="mc-avatar">${Icon(resolveCompanyIcon(c.emoji))}</div><div><div class="mc-name">${c.name}${c.demo?' <span style="font-size:.6rem;font-weight:700;color:var(--y);border:1px solid rgba(249,199,79,.35);padding:1px 5px;border-radius:100px;vertical-align:middle;">DEMO</span>':''}</div><div class="mc-loc">${Icon('pin')} ${c.il||'—'} / ${c.ilce||'—'}</div></div></div>
      <div><span class="mc-sector">${c.sector||'Sektör'}</span></div>
      <div class="mc-tags">${(c.inputs||[]).slice(0,2).map(t=>`<span class="mc-tag in">${Icon('component')} ${t}</span>`).join('')}${(c.outputs||[]).slice(0,2).map(t=>`<span class="mc-tag out">${Icon('recycle')} ${t}</span>`).join('')}</div>
      <div class="mc-footer"><div class="mc-emission">%${c.emission||0} <span style="font-size:.68rem;font-weight:400;color:rgba(255,255,255,.35)">emisyon azaltımı</span></div><div class="mc-date">${c.date||''}</div></div>
    </a>`).join('');
}

['search-input','sector-filter','city-filter'].forEach(id => document.getElementById(id).addEventListener('input', renderCards));

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'graph') buildGraph();
  });
});

/* Gerçek harita: CARTO'nun koyu temalı OSM karo katmanı üzerinde
   şirketleri gerçek il koordinatlarında gösteriyoruz (SVG çizim değil). */
const INIT_CENTER = [39.05, 35.4];
const INIT_ZOOM   = 6;
const map = L.map('graph-map', { zoomControl:false, attributionControl:true, minZoom:5, maxZoom:12 })
  .setView(INIT_CENTER, INIT_ZOOM);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_513u_1_b4ba91f6a7f669d53a1f6eca', {
  attribution:'&copy; OpenStreetMap katkıda bulunanlar &copy; CARTO',
  subdomains:'abcd'
}).addTo(map);

const edgeLayer   = L.layerGroup().addTo(map);
const markerLayer = L.layerGroup().addTo(map);

document.getElementById('gc-in').onclick    = () => map.zoomIn();
document.getElementById('gc-out').onclick   = () => map.zoomOut();
document.getElementById('gc-reset').onclick = () => map.setView(INIT_CENTER, INIT_ZOOM);

const tooltip = document.getElementById('g-tooltip');
map.on('click', () => tooltip.classList.remove('show'));

function buildGraph() {
  edgeLayer.clearLayers();
  markerLayer.clearLayers();

  const companies = allCompanies;
  document.getElementById('graph-empty').style.display = companies.length ? 'none' : 'flex';
  if (!companies.length) return;

  const nodes = companies.map(c => ({...c}));
  const edges = [], edgeSet = new Set();

  function addEdge(src, tgt, label, eff, km, type = 'sector') {
    const key = [src,tgt].sort().join('|');
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ source:src, target:tgt, label, eff, km, type });
  }

  nodes.forEach(consumer => {
    (consumer.inputs||[]).forEach(inp => {
      const producers = nodes.filter(n => n.id !== consumer.id && (n.outputs||[]).includes(inp));
      producers.sort((a,b) => (a.il === consumer.il ? 0 : 1) - (b.il === consumer.il ? 0 : 1));
      producers.forEach((prod,i) => addEdge(prod.id, consumer.id, inp, i===0 && producers.length>1, haversine(prod.il, consumer.il), 'waste'));
    });
  });
  nodes.forEach((a,i) => {
    nodes.forEach((b,j) => {
      if (j <= i) return;
      if (a.sector && b.sector && a.sector === b.sector) addEdge(a.id, b.id, a.sector, false, haversine(a.il, b.il));
    });
  });

  let minKm = Infinity, nearestIds = new Set();
  edges.forEach(e => { if (e.km !== null && e.km < minKm) { minKm = e.km; nearestIds = new Set([e.source, e.target]); } });

  const byCity = {};
  nodes.forEach(n => { (byCity[n.il || '—'] = byCity[n.il || '—'] || []).push(n); });
  Object.entries(byCity).forEach(([il, group]) => {
    const coords = IL_COORDS[il] || { lat: 39.0, lon: 35.5 };
    if (group.length === 1) {
      group[0].lat = coords.lat; group[0].lon = coords.lon;
    } else {
      const r = 0.06;
      group.forEach((n, i) => {
        const ang = (i / group.length) * Math.PI * 2 - Math.PI / 2;
        n.lat = coords.lat + Math.sin(ang) * r;
        n.lon = coords.lon + (Math.cos(ang) * r) / Math.cos(coords.lat * Math.PI / 180);
      });
    }
  });
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  edges.forEach(e => {
    const s = nodeById.get(e.source), t = nodeById.get(e.target);
    if (!s || !t) return;
    const color = e.eff ? '#f9c74f' : e.type === 'sector' ? '#a78bfa' : '#52b788';
    const line = L.polyline([[s.lat,s.lon],[t.lat,t.lon]], {
      color, weight: e.eff ? 3 : 2.2, opacity: .85,
      dashArray: e.type === 'sector' ? '7,5' : null
    }).addTo(edgeLayer);
    if (e.km !== null) line.bindTooltip(e.km + ' km', { permanent:true, direction:'center', className:'dist-tooltip' });
  });

  nodes.forEach(d => {
    const isNear = nearestIds.has(d.id);
    const shortName = d.name.length > 18 ? d.name.slice(0,16) + '…' : d.name;
    const html = `<div class="cm-wrap">${isNear ? '<div class="cm-ring"></div>' : ''}<div class="cm-core${isNear?' nearest':''}">${Icon(resolveCompanyIcon(d.emoji))}</div><div class="cm-label${d.demo?' cm-demo':''}">${shortName}${d.demo?' · demo':''}</div></div>`;
    const icon = L.divIcon({ className:'company-marker', html, iconSize:[36,54], iconAnchor:[18,18] });
    const marker = L.marker([d.lat, d.lon], { icon, riseOnHover:true }).addTo(markerLayer);

    marker.on('mouseover', () => {
      document.getElementById('tt-name').textContent   = d.name + (d.demo ? ' (Demo)' : '');
      document.getElementById('tt-loc').textContent    = (d.il||'—')+' / '+(d.ilce||'—');
      document.getElementById('tt-sector').textContent = d.sector||'—';
      document.getElementById('tt-date').textContent   = d.date||'—';
      document.getElementById('tt-tags').innerHTML = (d.inputs||[]).slice(0,3).map(t=>`<span class="tt-tag in">${t}</span>`).join('')+(d.outputs||[]).slice(0,3).map(t=>`<span class="tt-tag out">${t}</span>`).join('');
      tooltip.classList.add('show');
    });
    marker.on('mousemove', e => {
      const wrap = document.getElementById('graph-wrap').getBoundingClientRect();
      let x = e.originalEvent.clientX - wrap.left + 16, y = e.originalEvent.clientY - wrap.top - 10;
      if (x + 270 > wrap.width) x -= 280;
      tooltip.style.left = x+'px'; tooltip.style.top = y+'px';
    });
    marker.on('mouseout', () => tooltip.classList.remove('show'));
    marker.on('click', () => { location.href = 'company-detail.html?id=' + d.id; });
  });
}

init();
window.addEventListener('focus', async () => {
  allCompanies = await Companies.getAll();
  updateStats(); populateFilters(); renderCards(); buildGraph();
});
