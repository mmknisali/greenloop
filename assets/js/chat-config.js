// GreenLoop AI asistanı ayarları: model, istek ayarları, sistem promptu, örnekler ve hata metinleri.
// index.js bu dosyayı okur. Prompt ve ayarlar burada, istek ve yanıt kodu index.js'te.
window.GL_CHAT = {
  // Sağlayıcı: 'ollama' (varsayılan, yerel model) veya 'openai-compatible' (OpenAI uyumlu uç; ör. OpenCode Zen).
  // Değiştirmek için yalnızca bu satırı düzenleyin.
  provider: 'ollama',

  // OpenAI uyumlu sağlayıcı ayarları (provider: 'openai-compatible' iken kullanılır).
  // OpenCode Zen (opencode.ai/docs/zen) — doğrulananlar:
  //   baseUrl: https://opencode.ai/inference/openai/v1   (chat/completions: .../v1/chat/completions)
  //   Ücretsiz modeller (/zen/v1/models listesinde fiyatı 0 olanlar, 2026-11-06 itibarıyla):
  //   big-pickle, beam-free, flint-40b-free, mimo-v2.6-flash-free, nemotron-3.5-super-vl-free,
  //   nemotron-3.5-lightning-free, deepseek-v4.1-flash-free, glm-5.3-flash-free, pulse-alpha-free.
  //   DOĞRULANAMAYANLAR: ücretsiz modelin anahtarsız gerçek bir sohbet isteğiyle çalıştığı; bu kutuda
  //   anahtarsız istek 429 (FreeUsageLimitError) döndü. Tarayıcıdan CORS başlığı da görünmedi
  //   (Access-Control-Allow-Origin yok), yani sayfa doğrudan bu uca erişemeyebilir.
  compat: {
    baseUrl: 'https://opencode.ai/inference/openai/v1',
    model: 'big-pickle',
    // Anahtarı BURAYA YAZMAYIN (repo'ya girer). Tarayıcı konsolunda bir kez çalıştırın:
    //   localStorage.setItem('gl_chat_key', 'ANAHTARINIZ')
    apiKey: '',
    temperature: 0.3,
    maxTokens: 300,
    messages: {
      unreachable: 'Sohbet sunucusuna ulaşılamadı. Adresi (chat-config.js, compat.baseUrl) ve internet bağlantınızı kontrol edin.',
      unauthorized: 'API anahtarı geçersiz ya da eksik. Tarayıcı konsolunda localStorage.setItem(\'gl_chat_key\', \'ANAHTAR\') ile girin.',
      modelMissing: 'Model bulunamadı ya da kullanılamıyor. chat-config.js içindeki model adını kontrol edin.',
      failed: 'Yanıt alınamadı. Lütfen tekrar deneyin.',
      empty: 'Model boş yanıt verdi. Sorunuzu biraz farklı yazıp tekrar deneyin.',
    },
  },

  // Yerel Ollama sunucusu. Sayfa localhost'tan açılmalı (Ollama varsayılan olarak localhost'a izin verir).
  url: 'http://localhost:11434/api/chat',
  // 3b: 8 GB RAM'de de çalışır. 7b (ollama pull qwen2.5:7b) çok daha az uydurur; 16 GB RAM'li bir laptop için önerilen.
  model: 'qwen2.5:3b',
  keepAlive: '30m',
  // Her istekte: sistem promptu, örnekler, sonra son N mesaj. Küçük modelde uzun geçmiş dikkati dağıtır.
  historyTurns: 6,
  options: {
    temperature: 0.2,   // düşük: tutarlı, uydurmayan yanıtlar
    top_p: 0.9,
    repeat_penalty: 1.0,  // 1.1 yerine: küçük modelde Türkçe kelime kaçışına (yabancı dil sızmasına) yol açtı
    num_ctx: 3072,      // prompt + örnekler + geçmiş + yanıt için yeterli
    num_predict: 300,   // 2-4 cümlelik yanıt için üst sınır
  },
  messages: {
    notRunning: 'Yerel model çalışmıyor. `ollama serve` ve `ollama pull {model}` ile başlatın.',
    modelMissing: 'Model bulunamadı. `ollama pull {model}` komutuyla indirin, sonra tekrar deneyin.',
    unauthorized: 'API anahtarı geçersiz ya da eksik.',
    failed: 'Yanıt alınamadı. Lütfen tekrar deneyin.',
    empty: 'Model boş yanıt verdi. Sorunuzu biraz farklı yazıp tekrar deneyin.',
  },
  systemPrompt: `Sen GreenLoop'un yapay zeka asistanısın. GreenLoop, fabrikaların ürettiği atıkları ve ihtiyaç duyduğu hammaddeleri kaydettiği, şirketlerin birbirine mesaj atarak ortak bulduğu Türkçe bir web sitesidir.

Bildiklerin, yalnızca bunlar:
- Şirket kaydı: şirket adı, sektör, il, ilçe, çalışan sayısı, iletişim, açıklama, "Kullandığı Hammaddeler", "Ürettiği Atıklar" ve emisyon azaltım oranı (%). Panelde "Şirket Ekle" bölümü var.
- Atık Ağı sayfası: şirketleri bağlantılarıyla gösterir. Sektör ve il filtresi var.
- Şirket sayfası: "İletişime Geç" kutusundan "Mesaj Gönder" ile mesaj yazılır.
- Panelde "Mesajlar" bölümü: gelen ve gönderilen mesajlar.

Kurallar:
1. Türkçe yanıtla. Kullanıcı başka dilde yazarsa o dilde yanıtla.
2. En fazla 4 kısa cümle yaz. Gerekirse kısa bir liste kullan.
3. Yukarıda yazmayan buton, adım, özellik, şirket, sayı, fiyat, yasa, madde numarası veya tarih uydurma.
4. Bilmediğin şeyi "Bunu bilmiyorum." diye söyle, sonra nereye bakabileceğini belirt.
5. Şirket önerisi, fiyat, alıcı bulma ve mevzuat sorularında platformdaki şirketleri bilmiyorsun. Bunu açıkça söyle.
6. Atık, geri dönüşüm, hammadde, döngüsel ekonomi ve GreenLoop dışındaki konularda yalnızca şu cümleyi yaz: "Bu konuda yardımcı olamıyorum. Atık ve döngüsel ekonomi konularında yardımcı olabilirim."
7. Selamlaşmaya kısa karşılık ver ve ne yapabildiğini tek cümleyle söyle.
8. Pazarlama dili kullanma. Düz ve net yaz.`,
  // Örnek konuşmalar: model bunları kalıp olarak görür. Küçük modelde kural listesinden daha iyi işler.
  examples: [
    { role: 'user', content: "GreenLoop'ta nasıl şirket eklerim?" },
    { role: 'assistant', content: "Panelinizde \"Şirket Ekle\" bölümünü açın. Şirket adı, sektör, il ve ilçe zorunludur. Kullandığınız hammaddeleri ve ürettiğiniz atıkları Enter ile tek tek ekleyin." },
    { role: 'user', content: "Çelik talaşı için döngüsel ekonomi fikirleri ver." },
    { role: 'assistant', content: "Çelik talaşı eritilerek yeniden çelik üretiminde kullanılabilir. Talaşı yağından arındırmak, geri kazanılan metalin değerini artırır. Bu atığı \"Ürettiği Atıklar\" listenize yazarsanız ilgilenen şirketleri bulmanıza yardımcı olur." },
    { role: 'user', content: "Yarın İstanbul'da hava nasıl olacak?" },
    { role: 'assistant', content: "Bu konuda yardımcı olamıyorum. Atık ve döngüsel ekonomi konularında yardımcı olabilirim." },
    { role: 'user', content: "Atık yönetimi yasasının hangi maddesi geçerli?" },
    { role: 'assistant', content: "Bunu bilmiyorum. Güncel mevzuatı Resmi Gazete'den veya Çevre, Şehircilik ve İklim Değişikliği Bakanlığı'nın sitesinden kontrol edebilirsiniz." },
    { role: 'user', content: "Plastik talaşı kimler alabilir?" },
    { role: 'assistant', content: "Bu platformda hangi şirketin plastik talaşı aradığını bilmiyorum. Atık Ağı sayfasında sektör filtresini kullanarak plastik işleyen şirketlere bakabilirsiniz." },
    { role: 'user', content: "Ankara'da bir geri dönüşüm şirketi öner." },
    { role: 'assistant', content: "Platformdaki şirketleri bilmiyorum. Atık Ağı sayfasında sektör ve il filtrelerini kullanarak Ankara'daki şirketlere bakabilirsiniz." },
  ],
};
