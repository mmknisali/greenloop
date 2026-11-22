applyIcons();
let allCompanies = [];
let networkEdges = [];
let matchesAvailable = false;
const bestMatches = new Map();

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

async function init() {
  await refreshNetwork();
}

async function refreshNetwork() {
  const [companies, result] = await Promise.all([Companies.getAll(), Matches.network()]);
  allCompanies = companies;
  matchesAvailable = Array.isArray(result.data?.edges);
  const edges = matchesAvailable ? result.data.edges : [];
  indexMatches(edges);
  updateStats();
  populateFilters();
  renderCards();
  const signature = JSON.stringify([companies.map(c => c.id), edges.map(e => [e.fromId, e.toId, e.score])]);
  if (signature !== graphSignature) {
    graphSignature = signature;
    buildGraph();
  }
}

function indexMatches(edges) {
  const companies = new Map(allCompanies.map(c => [c.id, c]));
  bestMatches.clear();
  networkEdges = [];
  for (const edge of edges) {
    const from = companies.get(edge.fromId);
    const to = companies.get(edge.toId);
    if (!from || !to) continue;
    const reasons = Array.isArray(edge.reasons) ? edge.reasons : [];
    const km = Number.isFinite(reasons[0]?.km) ? reasons[0].km : null;
    networkEdges.push({ ...edge, km });
    for (const [company, partner, role] of [[from, to, 'alıcı'], [to, from, 'sağlayıcı']]) {
      if (!bestMatches.has(company.id) || edge.score > bestMatches.get(company.id).score) {
        bestMatches.set(company.id, { score: edge.score, reasons, km, partner, role });
      }
    }
  }
}

function matchSummary(id) {
  const match = bestMatches.get(id);
  if (!match) return `<p class="match-summary">${matchesAvailable ? 'Ağda eşleşme yok.' : 'Eşleşme bilgisi yüklenemedi.'}</p>`;
  const reasons = match.reasons.map(({ tag, from, to }) => {
    const reason = from && to && from !== to ? `${from} → ${to}` : from || to || tag;
    return `<li>${escapeHtml(reason)}</li>`;
  }).join('');
  return `<div class="match-summary">
    <strong>En iyi eşleşme: ${escapeHtml(match.score)} puan</strong>
    <p>${escapeHtml(match.partner.name)} (${match.role})${match.km === null ? '' : ` · ${match.km} km`}</p>
    ${reasons ? `<ul aria-label="Eşleşme nedenleri">${reasons}</ul>` : ''}
  </div>`;
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
  const sector = sEl.value, city = cEl.value;
  sEl.replaceChildren(new Option('Tüm Sektörler', ''), ...sectors.map(s => new Option(s, s)));
  cEl.replaceChildren(new Option('Tüm Şehirler', ''), ...cities.map(c => new Option(c, c)));
  if (sectors.includes(sector)) sEl.value = sector;
  if (cities.includes(city)) cEl.value = city;
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
    <a class="member-card" href="${escapeHtml(companyDetailUrl(c.id))}">
      <div class="mc-top"><div class="mc-avatar">${Icon(resolveCompanyIcon(c.icon))}</div><div><div class="mc-name">${escapeHtml(c.name)}${c.isDemo?' <span class="mc-demo">DEMO</span>':''}</div><div class="mc-loc">${Icon('pin')} ${escapeHtml(c.il||'—')} / ${escapeHtml(c.ilce||'—')}</div></div></div>
      <div><span class="mc-sector">${escapeHtml(c.sector||'Sektör')}</span></div>
      <div class="mc-tags">${(c.inputs||[]).slice(0,2).map(t=>`<span class="mc-tag in">${Icon('component')} ${escapeHtml(t)}</span>`).join('')}${(c.outputs||[]).slice(0,2).map(t=>`<span class="mc-tag out">${Icon('recycle')} ${escapeHtml(t)}</span>`).join('')}</div>
      ${matchSummary(c.id)}
      <div class="mc-footer"><div class="mc-emission">%${escapeHtml(c.emission||0)} <span class="mc-emission-label">emisyon azaltımı</span></div><div class="mc-date">${escapeHtml(c.date)}</div></div>
    </a>`).join('');
}

const filters = document.querySelector('.filters');
filters.addEventListener('input', renderCards);
filters.addEventListener('submit', event => event.preventDefault());

const tabs = [...document.querySelectorAll('.tab-btn')];
function selectTab(tab) {
  tabs.forEach(btn => {
    const active = btn === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active);
    btn.tabIndex = active ? 0 : -1;
    document.getElementById(btn.getAttribute('aria-controls')).classList.toggle('active', active);
  });
  if (tab.dataset.tab !== 'graph') hideTooltip();
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    const key = event.key;
    let next;
    if (key === 'Home') next = tabs[0];
    else if (key === 'End') next = tabs.at(-1);
    else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      next = tabs[(index + (key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    } else return;
    event.preventDefault();
    selectTab(next);
    next.focus();
  });
});

const INIT_CENTER = [39.05, 35.4];
const INIT_ZOOM   = 6;
const graphWrap = document.getElementById('graph-wrap');
const graphMap = document.getElementById('graph-map');
const tooltip = document.getElementById('g-tooltip');
const provinceGroups = new Map();
const graphLines = [];
let map, edgeLayer, markerLayer, tooltipMarker, graphSignature = '';

function initMap() {
  if (typeof L === 'undefined') {
    document.getElementById('graph-status').textContent = 'Harita yüklenemedi. Şirketler sekmesinden ağı inceleyebilirsiniz.';
    return;
  }
  graphMap.hidden = false;
  map = L.map(graphMap, { zoomControl:false, trackResize:false, minZoom:5, maxZoom:12 }).setView(INIT_CENTER, INIT_ZOOM);
  // A graph tab becoming visible also resizes its container; never measure it while hidden.
  new ResizeObserver(() => {
    if (graphMap.clientWidth && graphMap.clientHeight) map.invalidateSize();
  }).observe(graphMap);

  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanlar',
    className:'graph-basemap'
  });
  const mapNote = document.getElementById('graph-map-note');
  let loadedTile = false;
  tiles.on('loading', () => { loadedTile = false; });
  tiles.on('tileload', () => {
    loadedTile = true;
    mapNote.hidden = true;
  });
  tiles.on('load', () => { mapNote.hidden = loadedTile; });
  tiles.addTo(map);

  edgeLayer = L.layerGroup().addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  ['graph-tip', 'graph-legend', 'graph-controls'].forEach(id => { document.getElementById(id).hidden = false; });
  document.getElementById('gc-in').onclick    = () => map.zoomIn();
  document.getElementById('gc-out').onclick   = () => map.zoomOut();
  document.getElementById('gc-reset').onclick = () => map.setView(INIT_CENTER, INIT_ZOOM);
  map.on('click', hideTooltip);
  map.on('zoomend', positionGraph);
  map.on('moveend', positionTooltip);
  graphWrap.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideTooltip();
  });
}

function positionGraph() {
  const zoom = map.getZoom();
  for (const { center, markers } of provinceGroups.values()) {
    if (markers.length < 2) continue;
    // Spread in screen pixels, then reproject at each zoom so the markers stay apart.
    const origin = map.project(center, zoom);
    const radius = 58 / (2 * Math.sin(Math.PI / markers.length));
    markers.forEach((marker, index) => {
      const angle = index * 2 * Math.PI / markers.length - Math.PI / 2;
      const point = origin.add([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      marker.setLatLng(map.unproject(point, zoom));
    });
  }
  graphLines.forEach(({ line, from, to }) => {
    line.setLatLngs([from.getLatLng(), to.getLatLng()]);
    line.getTooltip()?.setLatLng(line.getCenter());
  });
  positionTooltip();
}

function buildGraph() {
  if (!map) return;
  hideTooltip();
  edgeLayer.clearLayers();
  markerLayer.clearLayers();
  provinceGroups.clear();
  graphLines.length = 0;

  document.getElementById('graph-empty').hidden = allCompanies.length > 0;
  document.getElementById('graph-status').textContent = 'Ağda henüz şirket yok.';
  const minKm = networkEdges.reduce((km, e) => Math.min(km, e.km ?? Infinity), Infinity);
  const nearestIds = new Set(networkEdges.filter(e => e.km === minKm).flatMap(e => [e.fromId, e.toId]));
  const markersById = new Map();

  allCompanies.forEach(d => {
    const province = Object.hasOwn(IL_COORDS, d.il) ? d.il : '';
    if (!provinceGroups.has(province)) {
      const coords = IL_COORDS[province];
      provinceGroups.set(province, { center: coords ? [coords.lat, coords.lon] : INIT_CENTER, markers: [] });
    }
    const group = provinceGroups.get(province);
    const isNear = nearestIds.has(d.id);
    const shortName = d.name.length > 18 ? d.name.slice(0,16) + '…' : d.name;
    const html = `<div class="cm-wrap">${isNear ? '<div class="cm-ring"></div>' : ''}<div class="cm-core${isNear?' nearest':''}">${Icon(resolveCompanyIcon(d.icon))}</div><div class="cm-label${d.isDemo?' cm-demo':''}">${escapeHtml(shortName)}${d.isDemo?' · demo':''}</div></div>`;
    const icon = L.divIcon({ className:'company-marker', html, iconSize:[36,54], iconAnchor:[18,18] });
    const marker = L.marker(group.center, { icon, riseOnHover:true }).addTo(markerLayer);
    group.markers.push(marker);
    markersById.set(d.id, marker);

    const element = marker.getElement();
    element.setAttribute('role', 'link');
    element.setAttribute('aria-label', d.name + (d.isDemo ? ' (Demo)' : ''));
    element.addEventListener('focus', () => showTooltip(marker, d));
    element.addEventListener('blur', () => { if (tooltipMarker === marker) hideTooltip(); });
    const openDetail = () => { location.href = companyDetailUrl(d.id); };
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter') openDetail();
    });
    marker.on('mouseover', () => showTooltip(marker, d));
    marker.on('mouseout', () => {
      if (tooltipMarker === marker && element !== document.activeElement) hideTooltip();
    });
    marker.on('click', openDetail);
  });

  const suppliers = new Map();
  networkEdges.forEach(e => {
    (e.reasons || []).forEach(r => {
      const key = e.toId + '|' + r.to;
      if (!suppliers.has(key)) suppliers.set(key, []);
      suppliers.get(key).push(e);
    });
  });
  const efficientEdges = new Set();
  suppliers.forEach(list => {
    if (list.length < 2) return;
    list.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    efficientEdges.add(list[0]);
  });

  networkEdges.forEach(e => {
    const from = markersById.get(e.fromId), to = markersById.get(e.toId);
    const eff = efficientEdges.has(e);
    const line = L.polyline([from.getLatLng(), to.getLatLng()], {
      color: eff ? '#f9c74f' : '#52b788', weight: eff ? 3 : 2.2, opacity: .85
    }).addTo(edgeLayer);
    if (e.km !== null) line.bindTooltip(`${e.km} km`, { permanent:true, direction:'center', className:'dist-tooltip' });
    graphLines.push({ line, from, to });
  });
  positionGraph();
}

function showTooltip(marker, company) {
  hideTooltip();
  tooltipMarker = marker;
  document.getElementById('tt-name').textContent = company.name + (company.isDemo ? ' (Demo)' : '');
  document.getElementById('tt-loc').textContent = (company.il||'—')+' / '+(company.ilce||'—');
  document.getElementById('tt-sector').textContent = company.sector||'—';
  document.getElementById('tt-date').textContent = company.date||'—';
  document.getElementById('tt-tags').innerHTML = (company.inputs||[]).slice(0,3).map(t=>`<span class="tt-tag in">${escapeHtml(t)}</span>`).join('')+(company.outputs||[]).slice(0,3).map(t=>`<span class="tt-tag out">${escapeHtml(t)}</span>`).join('');
  document.getElementById('tt-match').innerHTML = matchSummary(company.id);
  tooltip.classList.add('show');
  marker.getElement().setAttribute('aria-describedby', tooltip.id);
  positionTooltip();
}

function hideTooltip() {
  tooltipMarker?.getElement()?.removeAttribute('aria-describedby');
  tooltipMarker = null;
  tooltip.classList.remove('show');
}

function positionTooltip() {
  if (!tooltipMarker) return;
  const { x, y } = map.latLngToContainerPoint(tooltipMarker.getLatLng());
  const { offsetWidth: width, offsetHeight: height } = tooltip;
  const { clientWidth, clientHeight } = graphWrap;
  const left = x + width + 30 > clientWidth ? x - width - 22 : x + 22;
  tooltip.style.left = `${Math.max(8, Math.min(left, clientWidth - width - 8))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(y - 12, clientHeight - height - 8))}px`;
}

initMap();
init();
let lastNetworkRefresh = 0;
window.addEventListener('focus', () => {
  if (Date.now() - lastNetworkRefresh < 30000) return;
  lastNetworkRefresh = Date.now();
  refreshNetwork();
});
