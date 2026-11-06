const API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '/api' : '/greenloop/api';

async function _req(path, opts = {}) {
    const res = await fetch(API + path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    return res.json();
}
const _get  = p       => _req(p, { method: 'GET' });
const _post = (p, d)  => _req(p, { method: 'POST',   body: JSON.stringify(d) });
const _del  = p       => _req(p, { method: 'DELETE' });

const Auth = {
    getCurrent: async () => {
        const r = await _get('/auth.php?action=me');
        return r.ok ? r.user : null;
    },
    register: d => _post('/auth.php?action=register', d),
    loginWithCredentials: (email, password) => _post('/auth.php?action=login', { email, password }),
    logout: () => _post('/auth.php?action=logout', {}),
};

/* Jüri / demo sunumları için örnek şirket verisi.
   Gerçek veritabanı boş ya da az doluyken atık ağını dolu göstermek için
   Companies.getAll() sonucuna eklenir. Her kayıt demo:true taşır, böylece
   arayüzde "Demo" etiketiyle gerçek kayıtlardan ayırt edilebilir. Gösterge
   panelindeki "benim şirketlerim" (getByUser) bundan etkilenmez. */
const DEMO_COMPANIES = [
  { id:'demo-1',  demo:true, name:'Anadolu Geri Dönüşüm A.Ş.',   sector:'Geri Dönüşüm', il:'İstanbul',      ilce:'Tuzla',        inputs:['Plastik Atık','Metal Hurda'],                outputs:['Granül Plastik','Metal İngot'],       emission:34, size:'120-250', date:'2025', desc:'Kentsel plastik ve metal atıkları işleyerek ikincil hammadde üretir.', emoji:'recycle' },
  { id:'demo-2',  demo:true, name:'Marmara Tekstil Grubu',        sector:'Tekstil',       il:'Bursa',         ilce:'Nilüfer',       inputs:['Pamuk','Granül Plastik'],                    outputs:['Tekstil Atığı','Boya Çamuru'],        emission:22, size:'250-500', date:'2025', desc:'Örme kumaş üretimi yapan entegre tekstil tesisi.',                     emoji:'thread' },
  { id:'demo-3',  demo:true, name:'Ege Kağıt ve Karton',          sector:'Kağıt',         il:'İzmir',         ilce:'Bornova',       inputs:['Kağıt/Karton Atık'],                          outputs:['Geri Dönüştürülmüş Karton','Kağıt Çamuru'], emission:28, size:'50-120', date:'2024', desc:'Atık kağıttan oluklu mukavva üretimi.',                              emoji:'package' },
  { id:'demo-4',  demo:true, name:'Konya Tarım Ürünleri',         sector:'Gıda',          il:'Konya',         ilce:'Selçuklu',      inputs:['Su','Gübre'],                                 outputs:['Organik Atık','Saman'],               emission:18, size:'50-120', date:'2024', desc:'Tahıl işleme ve paketleme tesisi.',                                  emoji:'wheat' },
  { id:'demo-5',  demo:true, name:'Kayseri Mobilya San.',         sector:'Mobilya',       il:'Kayseri',       ilce:'Melikgazi',     inputs:['Saman','Ahşap Talaşı'],                       outputs:['Ahşap Talaşı','Mobilya Atığı'],       emission:15, size:'20-50',  date:'2023', desc:'Ahşap mobilya üretimi ve yüzey işleme.',                             emoji:'construction' },
  { id:'demo-6',  demo:true, name:'Adana Cam Sanayi',             sector:'Cam',           il:'Adana',         ilce:'Seyhan',        inputs:['Cam Kırığı'],                                 outputs:['Cam Kırığı','Cam Tozu'],              emission:26, size:'120-250', date:'2024', desc:'Ambalaj camı üretimi ve cam geri dönüşümü.',                          emoji:'flask' },
  { id:'demo-7',  demo:true, name:'Denizli Tekstil Boyahanesi',   sector:'Tekstil',       il:'Denizli',       ilce:'Merkezefendi',  inputs:['Tekstil Atığı'],                              outputs:['Boya Çamuru','Atık Su'],              emission:20, size:'50-120', date:'2023', desc:'Kumaş boyama ve terbiye tesisi.',                                    emoji:'thread' },
  { id:'demo-8',  demo:true, name:'Kocaeli Petrokimya',           sector:'Kimya',         il:'Kocaeli',       ilce:'Gebze',         inputs:['Kullanılmış Yağ'],                             outputs:['Plastik Atık','Kimyasal Çamur'],      emission:30, size:'250-500', date:'2024', desc:'Polimer ve petrokimya ara ürün üretimi.',                            emoji:'flask' },
  { id:'demo-9',  demo:true, name:'Antalya Seracılık Kooperatifi',sector:'Tarım',         il:'Antalya',       ilce:'Kumluca',       inputs:['Organik Atık','Kül'],                         outputs:['Sebze Atığı','Bitki Sapı'],           emission:12, size:'20-50',  date:'2023', desc:'Örtü altı sebze üretimi kooperatifi.',                                emoji:'leaf' },
  { id:'demo-10', demo:true, name:'Mersin Liman Lojistik',        sector:'Lojistik',      il:'Mersin',        ilce:'Akdeniz',       inputs:['Ahşap Palet'],                                 outputs:['Ahşap Palet Atığı','Plastik Ambalaj'],emission:16, size:'50-120', date:'2024', desc:'Liman ardı depolama ve dağıtım hizmetleri.',                          emoji:'truck' },
  { id:'demo-11', demo:true, name:'Sakarya Otomotiv Yan Sanayi',  sector:'Otomotiv',      il:'Sakarya',       ilce:'Erenler',       inputs:['Metal Hurda','Plastik Atık'],                 outputs:['Metal Talaşı','Lastik Atığı'],        emission:24, size:'250-500', date:'2024', desc:'Otomotiv yedek parça ve enjeksiyon üretimi.',                        emoji:'component' },
  { id:'demo-12', demo:true, name:'Manisa Elektronik Geri Kazanım',sector:'Elektronik',   il:'Manisa',        ilce:'Yunusemre',     inputs:['Elektronik Atık'],                             outputs:['Devre Kartı Hurdası','Plastik Atık'], emission:33, size:'50-120', date:'2025', desc:'E-atık toplama ve değerli metal geri kazanımı.',                     emoji:'battery' },
  { id:'demo-13', demo:true, name:'Eskişehir Seramik San.',       sector:'Seramik',       il:'Eskişehir',     ilce:'Odunpazarı',    inputs:['Cam Tozu','Kül'],                              outputs:['Seramik Atığı','Kil Çamuru'],         emission:19, size:'50-120', date:'2023', desc:'Yer ve duvar seramiği üretimi.',                                      emoji:'brick' },
  { id:'demo-14', demo:true, name:'Trabzon Çay ve Gıda',          sector:'Gıda',          il:'Trabzon',       ilce:'Akçaabat',      inputs:['Su'],                                          outputs:['Çay Posası','Organik Atık'],          emission:14, size:'20-50',  date:'2023', desc:'Çay işleme ve paketleme fabrikası.',                                  emoji:'coffee' },
  { id:'demo-15', demo:true, name:'Şanlıurfa Tekstil Fabrikası',  sector:'Tekstil',       il:'Şanlıurfa',     ilce:'Haliliye',      inputs:['Pamuk'],                                      outputs:['Tekstil Atığı','Pamuk Sapı'],         emission:21, size:'120-250', date:'2024', desc:'İplik ve dokuma üretimi.',                                            emoji:'thread' },
  { id:'demo-16', demo:true, name:'Malatya Kayısı İşleme',        sector:'Gıda',          il:'Malatya',       ilce:'Yeşilyurt',     inputs:['Su'],                                          outputs:['Kayısı Çekirdeği','Organik Atık'],    emission:17, size:'20-50',  date:'2023', desc:'Kuru kayısı işleme ve paketleme.',                                    emoji:'wheat' },
  { id:'demo-17', demo:true, name:'Samsun Kimya Endüstrisi',      sector:'Kimya',         il:'Samsun',        ilce:'İlkadım',       inputs:['Kimyasal Çamur'],                              outputs:['Kullanılmış Yağ','Asit Atığı'],       emission:27, size:'120-250', date:'2024', desc:'Endüstriyel kimyasal üretim tesisi.',                                emoji:'barrel' },
  { id:'demo-18', demo:true, name:'Diyarbakır Enerji Santrali',   sector:'Enerji',        il:'Diyarbakır',    ilce:'Kayapınar',     inputs:['Çay Posası','Ahşap Talaşı','Pamuk Sapı'],     outputs:['Kül','Isı Enerjisi'],                 emission:40, size:'250-500', date:'2025', desc:'Biyokütle atıklarından enerji üretimi.',                             emoji:'energy' },
  { id:'demo-19', demo:true, name:'Kahramanmaraş Metal İşleme',   sector:'Metal',         il:'Kahramanmaraş', ilce:'Onikişubat',    inputs:['Metal Talaşı','Metal İngot'],                 outputs:['Metal Hurda','Metal Tozu'],           emission:23, size:'50-120', date:'2024', desc:'Metal döküm ve talaşlı imalat.',                                      emoji:'factory' },
  { id:'demo-20', demo:true, name:'Gaziantep Plastik Geri Dönüşüm',sector:'Plastik',      il:'Gaziantep',     ilce:'Şahinbey',      inputs:['Plastik Ambalaj','Lastik Atığı'],             outputs:['Granül Plastik','Plastik Atık'],      emission:31, size:'50-120', date:'2025', desc:'Ambalaj ve lastik atığından granül plastik üretimi.',                emoji:'recycle' }
];

const Companies = {
    getAll:   async () => { const r = await _get('/companies.php?action=all');  return (r.ok ? r.data : []).concat(DEMO_COMPANIES); },
    getById:  async id => {
        if (!id) return null;
        const demo = DEMO_COMPANIES.find(c => c.id === id);
        if (demo) return demo;
        const r = await _get(`/companies.php?action=get&id=${encodeURIComponent(id)}`);
        return r.ok ? r.data : null;
    },
    getByUser:async () => { const r = await _get('/companies.php?action=mine'); return r.ok ? r.data : []; },
    add:      d  => _post('/companies.php?action=add', d),
    delete:   id => _del(`/companies.php?action=delete&id=${encodeURIComponent(id)}`),
};

const Messages = {
    send:                 d    => _post('/messages.php?action=send', d),
    getThreadsForCompany: async () => { const r = await _get('/messages.php?action=threads'); return r.ok ? r.data : []; },
    getSentThreads:       async () => { const r = await _get('/messages.php?action=sent');    return r.ok ? r.data : []; },
    getThreadMsgs:        async key => { const r = await _get(`/messages.php?action=thread&key=${encodeURIComponent(key)}`); return r.ok ? r.data : []; },
    getConversation:      async cid => { const r = await _get(`/messages.php?action=conversation&company_id=${encodeURIComponent(cid)}`); return r.ok ? r.data : []; },
    markRead:             id   => _get(`/messages.php?action=read&id=${encodeURIComponent(id)}`),
    reply:                d    => _post('/messages.php?action=reply', d),
    deleteThread:         d    => _post('/messages.php?action=delete_thread', d),
    pollNew:              (since, companyId = '', userId = '') => {
        let url = `/messages.php?action=poll&since=${encodeURIComponent(since)}`;
        if (companyId) url += `&company_id=${encodeURIComponent(companyId)}`;
        if (userId)    url += `&user_id=${encodeURIComponent(userId)}`;
        return _get(url);
    },
};

const TR_ILLER = [
  {il:"Adana",ilceler:["Aladağ","Ceyhan","Çukurova","Feke","İmamoğlu","Karaisalı","Karataş","Kozan","Pozantı","Saimbeyli","Sarıçam","Seyhan","Tufanbeyli","Yumurtalık","Yüreğir"]},
  {il:"Adıyaman",ilceler:["Besni","Çelikhan","Gerger","Gölbaşı","Kahta","Merkez","Samsat","Sincik","Tut"]},
  {il:"Afyonkarahisar",ilceler:["Başmakçı","Bayat","Bolvadin","Çay","Çobanlar","Dazkırı","Dinar","Emirdağ","Evciler","Hocalar","İhsaniye","İscehisar","Kızılören","Merkez","Sandıklı","Sinanpaşa","Sultandağı","Şuhut"]},
  {il:"Ağrı",ilceler:["Diyadin","Doğubayazıt","Eleşkirt","Hamur","Merkez","Patnos","Taşlıçay","Tutak"]},
  {il:"Amasya",ilceler:["Göynücek","Gümüşhacıköy","Hamamözü","Merkez","Merzifon","Suluova","Taşova"]},
  {il:"Ankara",ilceler:["Altındağ","Ayaş","Bala","Beypazarı","Çamlıdere","Çankaya","Çubuk","Elmadağ","Etimesgut","Evren","Gölbaşı","Güdül","Haymana","Kahramankazan","Kalecik","Keçiören","Kızılcahamam","Mamak","Nallıhan","Polatlı","Pursaklar","Sincan","Şereflikoçhisar","Yenimahalle"]},
  {il:"Antalya",ilceler:["Akseki","Aksu","Alanya","Demre","Döşemealtı","Elmalı","Finike","Gazipaşa","Gündoğmuş","İbradı","Kaş","Kemer","Kepez","Konyaaltı","Korkuteli","Kumluca","Manavgat","Muratpaşa","Serik"]},
  {il:"Ardahan",ilceler:["Çıldır","Damal","Göle","Hanak","Merkez","Posof"]},
  {il:"Artvin",ilceler:["Ardanuç","Arhavi","Borçka","Hopa","Kemalpaşa","Merkez","Murgul","Şavşat","Yusufeli"]},
  {il:"Aydın",ilceler:["Bozdoğan","Buharkent","Çine","Didim","Efeler","Germencik","İncirliova","Karacasu","Karpuzlu","Koçarlı","Köşk","Kuşadası","Kuyucak","Merkez","Nazilli","Söke","Sultanhisar","Yenipazar"]},
  {il:"Balıkesir",ilceler:["Altıeylül","Ayvalık","Balya","Bandırma","Bigadiç","Burhaniye","Dursunbey","Edremit","Erdek","Gömeç","Gönen","Havran","İvrindi","Karesi","Kepsut","Manyas","Marmara","Merkez","Savaştepe","Sındırgı","Susurluk"]},
  {il:"Bartın",ilceler:["Amasra","Kurucaşile","Merkez","Ulus"]},
  {il:"Batman",ilceler:["Beşiri","Gercüş","Hasankeyf","Kozluk","Merkez","Sason"]},
  {il:"Bayburt",ilceler:["Aydıntepe","Demirözü","Merkez"]},
  {il:"Bilecik",ilceler:["Bozüyük","Gölpazarı","İnhisar","Merkez","Osmaneli","Pazaryeri","Söğüt","Yenipazar"]},
  {il:"Bingöl",ilceler:["Adaklı","Genç","Karlıova","Kiğı","Merkez","Solhan","Yayladere","Yedisu"]},
  {il:"Bitlis",ilceler:["Adilcevaz","Ahlat","Güroymak","Hizan","Merkez","Mutki","Tatvan"]},
  {il:"Bolu",ilceler:["Dörtdivan","Gerede","Göynük","Kıbrıscık","Mengen","Merkez","Mudurnu","Seben","Yeniçağa"]},
  {il:"Burdur",ilceler:["Ağlasun","Altınyayla","Bucak","Çavdır","Çeltikçi","Gölhisar","Karamanlı","Kemer","Merkez","Tefenni","Yeşilova"]},
  {il:"Bursa",ilceler:["Büyükorhan","Gemlik","Gürsu","Harmancık","İnegöl","İznik","Karacabey","Keles","Kestel","Mudanya","Mustafakemalpaşa","Nilüfer","Orhaneli","Orhangazi","Osmangazi","Yıldırım","Yenişehir"]},
  {il:"Çanakkale",ilceler:["Ayvacık","Bayramiç","Biga","Bozcaada","Çan","Eceabat","Ezine","Gelibolu","Gökçeada","Lapseki","Merkez","Yenice"]},
  {il:"Çankırı",ilceler:["Atkaracalar","Bayramören","Çerkeş","Eldivan","Ilgaz","Korgun","Kurşunlu","Merkez","Orta","Şabanözü","Yapraklı"]},
  {il:"Çorum",ilceler:["Alaca","Bayat","Boğazkale","Dodurga","İskilip","Kargı","Laçin","Mecitözü","Merkez","Oğuzlar","Ortaköy","Osmancık","Sungurlu","Uğurludağ"]},
  {il:"Denizli",ilceler:["Acıpayam","Babadağ","Baklan","Bekilli","Beyağaç","Bozkurt","Buldan","Çal","Çameli","Çardak","Çivril","Güney","Honaz","Kale","Merkez","Merkezefendi","Pamukkale","Sarayköy","Serinhisar","Tavas"]},
  {il:"Diyarbakır",ilceler:["Bağlar","Bismil","Çermik","Çınar","Çüngüş","Dicle","Eğil","Ergani","Hani","Hazro","Kayapınar","Kocaköy","Kulp","Lice","Merkez","Silvan","Sur","Yenişehir"]},
  {il:"Düzce",ilceler:["Akçakoca","Cumayeri","Çilimli","Gölyaka","Gümüşova","Kaynaşlı","Merkez","Yığılca"]},
  {il:"Edirne",ilceler:["Enez","Havsa","İpsala","Keşan","Lalapaşa","Meriç","Merkez","Süloğlu","Uzunköprü"]},
  {il:"Elazığ",ilceler:["Ağın","Alacakaya","Arıcak","Baskil","Karakoçan","Keban","Kovancılar","Maden","Merkez","Palu","Sivrice"]},
  {il:"Erzincan",ilceler:["Çayırlı","İliç","Kemah","Kemaliye","Merkez","Otlukbeli","Refahiye","Tercan","Üzümlü"]},
  {il:"Erzurum",ilceler:["Aşkale","Aziziye","Çat","Hınıs","Horasan","İspir","Karaçoban","Karayazı","Köprüköy","Merkez","Narman","Oltu","Olur","Palandöken","Pasinler","Pazaryolu","Şenkaya","Tekman","Tortum","Uzundere","Yakutiye"]},
  {il:"Eskişehir",ilceler:["Alpu","Beylikova","Çifteler","Günyüzü","Han","İnönü","Mahmudiye","Mihalgazi","Mihalıççık","Odunpazarı","Sarıcakaya","Seyitgazi","Sivrihisar","Tepebaşı"]},
  {il:"Gaziantep",ilceler:["Araban","İslahiye","Karkamış","Nizip","Nurdağı","Oğuzeli","Şahinbey","Şehitkamil","Yavuzeli"]},
  {il:"Giresun",ilceler:["Alucra","Bulancak","Çamoluk","Çanakçı","Dereli","Doğankent","Espiye","Eynesil","Görele","Güce","Keşap","Merkez","Piraziz","Şebinkarahisar","Tirebolu","Yağlıdere"]},
  {il:"Gümüşhane",ilceler:["Kelkit","Köse","Kürtün","Merkez","Şiran","Torul"]},
  {il:"Hakkari",ilceler:["Çukurca","Derecik","Merkez","Şemdinli","Yüksekova"]},
  {il:"Hatay",ilceler:["Altınözü","Antakya","Arsuz","Belen","Defne","Dörtyol","Erzin","Hassa","İskenderun","Kırıkhan","Kumlu","Merkez","Payas","Reyhanlı","Samandağ","Yayladağı"]},
  {il:"Iğdır",ilceler:["Aralık","Karakoyunlu","Merkez","Tuzluca"]},
  {il:"Isparta",ilceler:["Aksu","Atabey","Eğirdir","Gelendost","Gönen","Keçiborlu","Merkez","Senirkent","Sütçüler","Şarkikaraağaç","Uluborlu","Yalvaç","Yenişarbademli"]},
  {il:"İstanbul",ilceler:["Adalar","Arnavutköy","Ataşehir","Avcılar","Bağcılar","Bahçelievler","Bakırköy","Başakşehir","Bayrampaşa","Beşiktaş","Beykoz","Beylikdüzü","Beyoğlu","Büyükçekmece","Çatalca","Çekmeköy","Esenler","Esenyurt","Eyüpsultan","Fatih","Gaziosmanpaşa","Güngören","Kadıköy","Kağıthane","Kartal","Küçükçekmece","Maltepe","Pendik","Sancaktepe","Sarıyer","Silivri","Sultanbeyli","Sultangazi","Şile","Şişli","Tuzla","Ümraniye","Üsküdar","Zeytinburnu"]},
  {il:"İzmir",ilceler:["Aliağa","Balçova","Bayındır","Bayraklı","Bergama","Beydağ","Bornova","Buca","Çeşme","Çiğli","Dikili","Foça","Gaziemir","Güzelbahçe","Karabağlar","Karaburun","Karşıyaka","Kemalpaşa","Kınık","Kiraz","Konak","Menderes","Menemen","Narlıdere","Ödemiş","Seferihisar","Selçuk","Tire","Torbalı","Urla"]},
  {il:"Kahramanmaraş",ilceler:["Afşin","Andırın","Çağlayancerit","Dulkadiroğlu","Ekinözü","Elbistan","Göksun","Nurhak","Onikişubat","Pazarcık","Türkoğlu"]},
  {il:"Karabük",ilceler:["Eflani","Eskipazar","Merkez","Ovacık","Safranbolu","Yenice"]},
  {il:"Karaman",ilceler:["Ayrancı","Başyayla","Ermenek","Kazımkarabekir","Merkez","Sarıveliler"]},
  {il:"Kars",ilceler:["Akyaka","Arpaçay","Digor","Kağızman","Merkez","Sarıkamış","Selim","Susuz"]},
  {il:"Kastamonu",ilceler:["Abana","Ağlı","Araç","Azdavay","Bozkurt","Çatalzeytin","Cide","Daday","Devrekani","Doğanyurt","Hanönü","İhsangazi","İnebolu","Küre","Merkez","Pınarbaşı","Seydiler","Şenpazar","Taşköprü","Tosya"]},
  {il:"Kayseri",ilceler:["Akkışla","Bünyan","Develi","Felahiye","Hacılar","İncesu","Kocasinan","Melikgazi","Özvatan","Pınarbaşı","Sarıoğlan","Sarız","Talas","Tomarza","Yahyalı","Yeşilhisar"]},
  {il:"Kırıkkale",ilceler:["Bahşili","Balışeyh","Çelebi","Delice","Karakeçili","Keskin","Merkez","Sulakyurt","Yahşihan"]},
  {il:"Kırklareli",ilceler:["Babaeski","Demirköy","Kofçaz","Lüleburgaz","Merkez","Pehlivanköy","Pınarhisar","Vize"]},
  {il:"Kırşehir",ilceler:["Akçakent","Akpınar","Boztepe","Çiçekdağı","Kaman","Merkez","Mucur"]},
  {il:"Kilis",ilceler:["Elbeyli","Merkez","Musabeyli","Polateli"]},
  {il:"Kocaeli",ilceler:["Başiskele","Çayırova","Darıca","Derince","Dilovası","Gebze","Gölcük","İzmit","Kandıra","Karamürsel","Kartepe","Körfez"]},
  {il:"Konya",ilceler:["Ahırlı","Akören","Akşehir","Altınekin","Beyşehir","Bozkır","Cihanbeyli","Çeltik","Çumra","Derbent","Derebucak","Doğanhisar","Emirgazi","Ereğli","Güneysınır","Hadim","Halkapınar","Hüyük","Ilgın","Kadınhanı","Karapınar","Karatay","Kulu","Meram","Sarayönü","Selçuklu","Seydişehir","Taşkent","Tuzlukçu","Yalıhüyük","Yunak"]},
  {il:"Kütahya",ilceler:["Altıntaş","Aslanapa","Çavdarhisar","Domaniç","Dumlupınar","Emet","Gediz","Hisarcık","Merkez","Pazarlar","Simav","Şaphane","Tavşanlı"]},
  {il:"Malatya",ilceler:["Akçadağ","Arapgir","Arguvan","Battalgazi","Darende","Doğanyol","Doğanşehir","Hekimhan","Kale","Kuluncak","Merkez","Pütürge","Yazıhan","Yeşilyurt"]},
  {il:"Manisa",ilceler:["Ahmetli","Akhisar","Alaşehir","Demirci","Gölmarmara","Gördes","Kırkağaç","Köprübaşı","Kula","Merkez","Salihli","Sarıgöl","Saruhanlı","Selendi","Soma","Şehzadeler","Turgutlu","Yunusemre"]},
  {il:"Mardin",ilceler:["Artuklu","Dargeçit","Derik","Kızıltepe","Mazıdağı","Merkez","Midyat","Nusaybin","Ömerli","Savur","Yeşilli"]},
  {il:"Mersin",ilceler:["Akdeniz","Anamur","Aydıncık","Bozyazı","Çamlıyayla","Erdemli","Gülnar","Mezitli","Mut","Silifke","Tarsus","Toroslar","Yenişehir"]},
  {il:"Muğla",ilceler:["Bodrum","Dalaman","Datça","Fethiye","Kavaklıdere","Köyceğiz","Marmaris","Menteşe","Milas","Ortaca","Seydikemer","Ula","Yatağan"]},
  {il:"Muş",ilceler:["Bulanık","Hasköy","Korkut","Malazgirt","Merkez","Varto"]},
  {il:"Nevşehir",ilceler:["Acıgöl","Avanos","Derinkuyu","Gülşehir","Hacıbektaş","Kozaklı","Merkez","Ürgüp"]},
  {il:"Niğde",ilceler:["Altunhisar","Bor","Çamardı","Çiftlik","Merkez","Ulukışla"]},
  {il:"Ordu",ilceler:["Akkuş","Altınordu","Aybastı","Çamaş","Çatalpınar","Çaybaşı","Fatsa","Gölköy","Gülyalı","Gürgentepe","İkizce","Kabadüz","Kabataş","Korgan","Kumru","Mesudiye","Perşembe","Ulubey","Ünye"]},
  {il:"Osmaniye",ilceler:["Bahçe","Düziçi","Hasanbeyli","Kadirli","Merkez","Sumbas","Toprakkale"]},
  {il:"Rize",ilceler:["Ardeşen","Çamlıhemşin","Çayeli","Derepazarı","Fındıklı","Güneysu","Hemşin","İkizdere","İyidere","Kalkandere","Merkez","Pazar"]},
  {il:"Sakarya",ilceler:["Adapazarı","Akyazı","Arifiye","Erenler","Ferizli","Geyve","Hendek","Karapürçek","Karasu","Kaynarca","Kocaali","Pamukova","Sapanca","Serdivan","Söğütlü","Taraklı"]},
  {il:"Samsun",ilceler:["Alaçam","Asarcık","Atakum","Ayvacık","Bafra","Canik","Çarşamba","Havza","İlkadım","Kavak","Ladik","Salıpazarı","Tekkeköy","Terme","Vezirköprü","Yakakent"]},
  {il:"Siirt",ilceler:["Baykan","Eruh","Kurtalan","Merkez","Pervari","Şirvan","Tillo"]},
  {il:"Sinop",ilceler:["Ayancık","Boyabat","Dikmen","Durağan","Erfelek","Gerze","Merkez","Saraydüzü","Türkeli"]},
  {il:"Sivas",ilceler:["Akıncılar","Altınyayla","Divriği","Doğanşar","Gemerek","Gölova","Gürun","Hafik","İmranlı","Kangal","Koyulhisar","Merkez","Suşehri","Şarkışla","Ulaş","Yıldızeli","Zara"]},
  {il:"Şanlıurfa",ilceler:["Akçakale","Birecik","Bozova","Ceylanpınar","Eyyübiye","Halfeti","Haliliye","Harran","Hilvan","Karaköprü","Merkez","Siverek","Suruç","Viranşehir"]},
  {il:"Şırnak",ilceler:["Beytüşşebap","Cizre","Güçlükonak","İdil","Merkez","Silopi","Uludere"]},
  {il:"Tekirdağ",ilceler:["Çerkezköy","Çorlu","Ergene","Hayrabolu","Kapaklı","Malkara","Marmaraereğlisi","Merkez","Muratlı","Saray","Süleymanpaşa","Şarköy"]},
  {il:"Tokat",ilceler:["Almus","Artova","Başçiftlik","Erbaa","Merkez","Niksar","Pazar","Reşadiye","Sulusaray","Turhal","Yeşilyurt","Zile"]},
  {il:"Trabzon",ilceler:["Akçaabat","Araklı","Arsin","Beşikdüzü","Çarşıbaşı","Çaykara","Dernekpazarı","Düzköy","Hayrat","Köprübaşı","Maçka","Merkez","Of","Ortahisar","Sürmene","Şalpazarı","Tonya","Vakfıkebir","Yomra"]},
  {il:"Tunceli",ilceler:["Çemişgezek","Hozat","Mazgirt","Merkez","Nazimiye","Ovacık","Pertek","Pülümür"]},
  {il:"Uşak",ilceler:["Banaz","Eşme","Karahallı","Merkez","Sivaslı","Ulubey"]},
  {il:"Van",ilceler:["Bahçesaray","Başkale","Çaldıran","Çatak","Edremit","Erciş","Gevaş","Gürpınar","İpekyolu","Merkez","Muradiye","Özalp","Saray","Tuşba"]},
  {il:"Yalova",ilceler:["Altınova","Armutlu","Çınarcık","Çiftlikköy","Merkez","Termal"]},
  {il:"Yozgat",ilceler:["Akdağmadeni","Aydıncık","Boğazlıyan","Çandır","Çayıralan","Çekerek","Kadışehri","Merkez","Saraykent","Sarıkaya","Şefaatli","Sorgun","Yenifakılı","Yerköy"]},
  {il:"Zonguldak",ilceler:["Alaplı","Çaycuma","Devrek","Ereğli","Gökçebey","Kilimli","Kozlu","Merkez"]}
];

function populateIlSelect(ilSelectId, ilceSelectId) {
    const ilSel  = document.getElementById(ilSelectId);
    const ilceSel = document.getElementById(ilceSelectId);
    if (!ilSel) return;
    ilSel.innerHTML = '<option value="">İl seçin...</option>'
        + TR_ILLER.map(i => `<option value="${i.il}">${i.il}</option>`).join('');
    ilSel.onchange = () => {
        const found = TR_ILLER.find(i => i.il === ilSel.value);
        if (ilceSel) {
            ilceSel.innerHTML = '<option value="">İlçe seçin...</option>'
                + (found ? found.ilceler.map(ilce => `<option value="${ilce}">${ilce}</option>`).join('') : '');
            ilceSel.disabled = !found;
        }
    };
    if (ilceSel) ilceSel.disabled = true;
}