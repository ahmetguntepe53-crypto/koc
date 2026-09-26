// Otomatik değerlendirme botunun OLGU SÖZLEŞMESİ — her olgu anahtarı (key) için alanlar ve örnek olgular.
// Kalıp bankaları (src/narrative/phrases/*.js) bu alanları kullanır; testler her kalıbı bu örneklerle çalıştırır.
//
// Alan türleri: sayılar HAM (biçimlenmemiş) gelir; biçimlemek için kalıp yardımcıları kullanılır (h.pct, h.int, h.dec...).
//   ders   : "TYT Matematik" (sınav türüyle birlikte; ARKASINA EK YAPIŞTIRILMAZ → "TYT Matematik dersinde")
//   konu   : "Mutlak Değer" (tırnakla yazılır: h.q(f.konu) → "'Mutlak Değer'"; ek yapıştırılmaz → "'Mutlak Değer' konusunda")
//   ay     : { ad: "Eylül", de: "Eylül'de", den: "Eylül'den", e: "Eylül'e", ayinda: "Eylül ayında", ayi: "Eylül ayı" }
//   oran/NO/pct alanları 0–100 arası yüzde puanıdır (h.pct(36) → "%36"); delta alanları puan farkıdır (h.signed(6) → "+6").
// Bölümler: ozet · guclu · gelisim (alan/kanit/oneri) · koc · konusma · dikkat

const AY = (ad, de, den, e) => ({ ad, de, den, e, ayinda: `${ad} ayında`, ayi: `${ad} ayı` });
export const MONTH_FORMS = [
  AY("Ocak", "Ocak'ta", "Ocak'tan", "Ocak'a"), AY("Şubat", "Şubat'ta", "Şubat'tan", "Şubat'a"), AY("Mart", "Mart'ta", "Mart'tan", "Mart'a"),
  AY("Nisan", "Nisan'da", "Nisan'dan", "Nisan'a"), AY("Mayıs", "Mayıs'ta", "Mayıs'tan", "Mayıs'a"), AY("Haziran", "Haziran'da", "Haziran'dan", "Haziran'a"),
  AY("Temmuz", "Temmuz'da", "Temmuz'dan", "Temmuz'a"), AY("Ağustos", "Ağustos'ta", "Ağustos'tan", "Ağustos'a"), AY("Eylül", "Eylül'de", "Eylül'den", "Eylül'e"),
  AY("Ekim", "Ekim'de", "Ekim'den", "Ekim'e"), AY("Kasım", "Kasım'da", "Kasım'dan", "Kasım'a"), AY("Aralık", "Aralık'ta", "Aralık'tan", "Aralık'a"),
];
const EYLUL = MONTH_FORMS[8], EKIM = MONTH_FORMS[9], KASIM = MONTH_FORMS[10], AGUSTOS = MONTH_FORMS[7];

// section: hangi bölümde kullanıldığı; fields: alan → açıklama ("?" ile bitenler null olabilir); samples: en az 2 örnek.
export const CATALOG = {
  // ---------------------------------------------------------------- ÖZET (her kalıp TEK cümle döner)
  "ozet.acilis": {
    section: "ozet", doc: "Ayın genel açılış cümlesi: ödev teslimi, çözülen soru, aktif gün.",
    fields: { ay: "ay nesnesi", V: "vadesi gelen ödev sayısı", teslim: "teslim edilen ödev", teslimPct: "teslim yüzdesi", eleAlinanPct: "teslim+pas yüzdesi", Q: "toplam çözülen soru", aktifGun: "aktif gün", gunSayisi: "aydaki gün (payda)", kayit: "kayıt sayısı" },
    samples: [
      { ay: EKIM, V: 18, teslim: 16, teslimPct: 88.9, eleAlinanPct: 94.4, Q: 1240, aktifGun: 19, gunSayisi: 31, kayit: 24 },
      { ay: EYLUL, V: 6, teslim: 3, teslimPct: 50, eleAlinanPct: 66.7, Q: 310, aktifGun: 6, gunSayisi: 30, kayit: 5 },
    ],
  },
  "ozet.acilisAz": {
    section: "ozet", doc: "Veri azken açılış: rapor oluşuyor, kayıt sayısı düşük.",
    fields: { ay: "ay nesnesi", kayit: "kayıt sayısı", Q: "soru" },
    samples: [{ ay: EYLUL, kayit: 2, Q: 45 }, { ay: EKIM, kayit: 0, Q: 0 }],
  },
  "ozet.guclu": {
    section: "ozet", doc: "En güçlü alanı tek cümleyle anmak.",
    fields: { ders: "ders", NO: "net oranı", pTilde: "okul ödevlerinde medyan yüzdelik?" },
    samples: [{ ders: "TYT Türkçe", NO: 78.2, pTilde: 91 }, { ders: "TYT Biyoloji", NO: 71.4, pTilde: null }],
  },
  "ozet.odak": {
    section: "ozet", doc: "Ana odak dersi (en çok kazanım fırsatı) ve varsa ilk konu.",
    fields: { ders: "ders", NO: "net oranı", konu: "en düşük konu?" },
    samples: [{ ders: "TYT Matematik", NO: 36.1, konu: "Problemler" }, { ders: "AYT Fizik", NO: 28.4, konu: null }],
  },
  "ozet.yukselis": {
    section: "ozet", doc: "Ay içinde (son 4 hafta / önceki 4 hafta) anlamlı yükselen ders.",
    fields: { ders: "ders", a: "önceki 4 hafta net oranı", b: "son 4 hafta net oranı" },
    samples: [{ ders: "TYT Tarih", a: 53.2, b: 61.4 }, { ders: "AYT Matematik", a: 18.9, b: 27.5 }],
  },
  "ozet.dusus": {
    section: "ozet", doc: "Ay içinde anlamlı düşen ders (nötr, suçlamadan).",
    fields: { ders: "ders", a: "önceki 4 hafta", b: "son 4 hafta" },
    samples: [{ ders: "TYT Fizik", a: 48.1, b: 36.2 }, { ders: "TYT Geometri", a: 60, b: 49.5 }],
  },
  "ozet.hacim": {
    section: "ozet", doc: "Çözülen soru sayısının önceki aya göre değişimi.",
    fields: { Q: "bu ay soru", oncekiQ: "önceki ay soru", degisimPct: "yüzde değişim (+/-)", onceki: "önceki ay nesnesi" },
    samples: [{ Q: 1240, oncekiQ: 980, degisimPct: 26.5, onceki: EYLUL }, { Q: 700, oncekiQ: 1100, degisimPct: -36.4, onceki: EKIM }],
  },
  "ozet.durumIyi": { section: "ozet", doc: "Genel durum yolunda.", fields: {}, samples: [{}] },
  "ozet.durumTakip": {
    section: "ozet", doc: "Takip gerektiren durum; neden kısa ifade listesi.",
    fields: { nedenler: "kısa neden ifadeleri dizisi (ör. 'TYT Biyoloji: konu pası')" },
    samples: [{ nedenler: ["TYT Biyoloji: konu pası"] }, { nedenler: ["zaman sıkıntısı", "TYT Fizik düşüşte"] }],
  },
  "ozet.durumMudahale": {
    section: "ozet", doc: "Müdahale gerektiren durum.",
    fields: { nedenler: "kısa neden ifadeleri dizisi (ör. '3 sessiz ödev (14 gün)', '8 gündür kayıt yok')" },
    samples: [{ nedenler: ["3 sessiz ödev (14 gün)"] }, { nedenler: ["8 gündür kayıt yok", "ele alınan %45"] }],
  },
  "ozet.seyir": {
    section: "ozet", doc: "Birkaç aylık genel gidiş (TYT ya da AYT net oranı, aydan aya).",
    fields: { sinav: "'TYT' | 'AYT'", ilk: "{ ay, NO } ilk ay", son: "{ ay, NO } bu ay", yon: "'up' | 'down' | 'flat' | 'zigzag'", aySayisi: "kaç ay", degerler: "NO dizisi (eskiden yeniye)" },
    samples: [
      { sinav: "TYT", ilk: { ay: AGUSTOS, NO: 52.3 }, son: { ay: EKIM, NO: 63.1 }, yon: "up", aySayisi: 3, degerler: [52.3, 58, 63.1] },
      { sinav: "TYT", ilk: { ay: EYLUL, NO: 61 }, son: { ay: KASIM, NO: 59.4 }, yon: "flat", aySayisi: 3, degerler: [61, 60.2, 59.4] },
      { sinav: "AYT", ilk: { ay: EYLUL, NO: 40 }, son: { ay: KASIM, NO: 31 }, yon: "down", aySayisi: 3, degerler: [40, 35, 31] },
      { sinav: "TYT", ilk: { ay: EYLUL, NO: 55 }, son: { ay: KASIM, NO: 57 }, yon: "zigzag", aySayisi: 3, degerler: [55, 49, 57] },
    ],
  },
  "ozet.ritim": {
    section: "ozet", doc: "Çalışma ritmi: en çok çalışılan günler ve hafta sonu payı.",
    fields: { gunler: "en yoğun 1–2 gün adı dizisi (ör. ['Salı','Perşembe'])", haftaSonuPay: "hafta sonu soru payı %", aktifGun: "aktif gün" },
    samples: [{ gunler: ["Salı", "Perşembe"], haftaSonuPay: 8, aktifGun: 17 }, { gunler: ["Pazar"], haftaSonuPay: 55, aktifGun: 9 }],
  },
  "ozet.deneme": {
    section: "ozet", doc: "Ayın son deneme sınavı (toplam GERÇEK net) ve aynı türün bir önceki denemesine göre değişim. Puan/sıralama tahmini yok.",
    fields: {
      sinav: "'TYT' | 'AYT'", net: "son denemenin toplam neti (ham; 0,25'in katı)", tarih: "tarih metni (ör. '14 Eki')", ad: "yayın/deneme adı (serbest metin, tırnakla yazılır; ek yapıştırılmaz)?",
      fark: "bir önceki denemeye göre net farkı (+/−; 0 = aynı)? — null ise bu türün ilk denemesi", oncekiNet: "bir önceki denemenin neti?", sayi: "bu ay bu türde girilen deneme sayısı", soru: "denemede girilen derslerin toplam sorusu (TYT 120)",
    },
    samples: [
      { sinav: "TYT", net: 78.5, tarih: "14 Eki", ad: "Kurgu Yayınları TYT-4", fark: 4.25, oncekiNet: 74.25, sayi: 3, soru: 120 },
      { sinav: "AYT", net: 41.75, tarih: "2 Kas", ad: null, fark: -2.5, oncekiNet: 44.25, sayi: 1, soru: 80 },
      { sinav: "TYT", net: 62, tarih: "20 Eyl", ad: null, fark: null, oncekiNet: null, sayi: 1, soru: 120 },
      { sinav: "TYT", net: 70, tarih: "5 Eki", ad: "Okul Denemesi", fark: 0, oncekiNet: 70, sayi: 2, soru: 120 },
    ],
  },

  // ---------------------------------------------------------------- GÜÇLÜ YÖNLER (her kalıp TEK madde cümlesi)
  "guclu.ders": {
    section: "guclu", doc: "Güçlü etiketli ders.",
    fields: { ders: "ders", NO: "net oranı", n: "kayıt", Q: "soru", pTilde: "okul medyan yüzdelik?" },
    samples: [{ ders: "TYT Türkçe", NO: 78.2, n: 16, Q: 428, pTilde: 91 }, { ders: "TYT Biyoloji", NO: 71.4, n: 5, Q: 150, pTilde: null }],
  },
  "guclu.yukselis": {
    section: "guclu", doc: "Son 4 haftada anlamlı yükselen ders.",
    fields: { ders: "ders", a: "önceki", b: "şimdiki", delta: "puan farkı" },
    samples: [{ ders: "TYT Tarih", a: 53.2, b: 61.4, delta: 8.2 }, { ders: "AYT Kimya", a: 30, b: 41, delta: 11 }],
  },
  "guclu.etiket": {
    section: "guclu", doc: "Ders etiketi yükseldi (Odak→Yolunda, Yolunda→Güçlü...).",
    fields: { ders: "ders", eski: "eski etiket adı", yeni: "yeni etiket adı" },
    samples: [{ ders: "TYT Tarih", eski: "Yolunda", yeni: "Güçlü" }, { ders: "TYT Matematik", eski: "Odak", yeni: "Yolunda" }],
  },
  "guclu.okul": {
    section: "guclu", doc: "Okul ödevlerinde üst çeyrek (aynı ödevi çözenlere göre).",
    fields: { ders: "ders", pTilde: "medyan yüzdelik", n: "karşılaştırılan ödev sayısı" },
    samples: [{ ders: "TYT Türkçe", pTilde: 91, n: 8 }, { ders: "TYT Biyoloji", pTilde: 77, n: 3 }],
  },
  "guclu.acikKapaniyor": {
    section: "guclu", doc: "Okul medyanıyla arasındaki fark kapanıyor.",
    fields: { ders: "ders", f0: "önceki fark (puan, negatif)", f1: "şimdiki fark", kapanan: "kapanan puan" },
    samples: [{ ders: "TYT Matematik", f0: -14, f1: -4, kapanan: 10 }, { ders: "TYT Fizik", f0: -6, f1: 3, kapanan: 9 }],
  },
  "guclu.zamaninda": {
    section: "guclu", doc: "Ödevleri zamanında teslim (son 28 gün).",
    fields: { zamaninda: "zamanında teslim", V: "vadesi gelen" },
    samples: [{ zamaninda: 17, V: 18 }, { zamaninda: 9, V: 10 }],
  },
  "guclu.seri": {
    section: "guclu", doc: "Haftalık düzen serisi (sessiz ödev yok + haftada ≥3 aktif gün).",
    fields: { seri: "hafta", enUzun: "en uzun seri" },
    samples: [{ seri: 4, enUzun: 6 }, { seri: 8, enUzun: 8 }],
  },
  "guclu.serbest": {
    section: "guclu", doc: "Ödev dışı serbest çalışma inisiyatifi.",
    fields: { serbestSoru: "serbest çalışma soru", pay: "toplam içindeki pay %" },
    samples: [{ serbestSoru: 328, pay: 28 }, { serbestSoru: 150, pay: 41 }],
  },
  "guclu.rekor": {
    section: "guclu", doc: "Son 7 günde kişisel rekor (bir kayıtta en yüksek net oranı).",
    fields: { ders: "ders", Q: "soru", net: "net", oran: "net oranı", gun: "tarih metni (ör. '18 Kas')" },
    samples: [{ ders: "TYT Türkçe", Q: 40, net: 36.5, oran: 91.3, gun: "18 Kas" }, { ders: "TYT Kimya", Q: 25, net: 19.75, oran: 79, gun: "3 Eki" }],
  },
  "guclu.isabet": {
    section: "guclu", doc: "İşaretlediği sorularda yüksek isabet (sağlam profil).",
    fields: { ders: "ders", isabet: "isabet %", Q: "soru" },
    samples: [{ ders: "TYT Biyoloji", isabet: 88, Q: 150 }, { ders: "AYT Edebiyat", isabet: 82.5, Q: 96 }],
  },
  "guclu.konular": {
    section: "guclu", doc: "Pekişmiş konular (bir derste).",
    fields: { ders: "ders", konular: "konu adları dizisi (1–3)", oranlar: "aynı sırada net oranları" },
    samples: [{ ders: "TYT Türkçe", konular: ["Paragrafta Anlam", "Sözcükte Anlam"], oranlar: [84, 79] }, { ders: "TYT Kimya", konular: ["Atom ve Yapısı"], oranlar: [72] }],
  },
  "guclu.pastanDonus": {
    section: "guclu", doc: "Pas geçtiği ödevlere geri dönüp teslim etmesi (dürüstlük + takip).",
    fields: { sayi: "pastan dönüş sayısı", V: "vadesi gelen ödev" },
    samples: [{ sayi: 2, V: 18 }, { sayi: 1, V: 9 }],
  },
  "guclu.aktifGun": {
    section: "guclu", doc: "Düzenli çalışma günü sayısı.",
    fields: { aktifGun: "aktif gün", gunSayisi: "aydaki gün" },
    samples: [{ aktifGun: 22, gunSayisi: 31 }, { aktifGun: 18, gunSayisi: 30 }],
  },
  "guclu.seyirYukselis": {
    section: "guclu", doc: "Aydan aya (birkaç ay boyunca) yükselen net oranı — sınav geneli ya da ders.",
    fields: { konu: "'TYT' / 'AYT' ya da ders adı", ilk: "{ ay, NO }", son: "{ ay, NO }", delta: "puan farkı", aySayisi: "kaç ay" },
    samples: [
      { konu: "TYT", ilk: { ay: AGUSTOS, NO: 52.3 }, son: { ay: EKIM, NO: 63.1 }, delta: 10.8, aySayisi: 3 },
      { konu: "TYT Matematik", ilk: { ay: EYLUL, NO: 28 }, son: { ay: KASIM, NO: 41 }, delta: 13, aySayisi: 3 },
    ],
  },
  "guclu.seyirDuzen": {
    section: "guclu", doc: "Teslim oranı önceki aya göre belirgin arttı.",
    fields: { once: "{ ay, pct }", simdi: "{ ay, pct }" },
    samples: [{ once: { ay: EYLUL, pct: 62 }, simdi: { ay: EKIM, pct: 88 } }, { once: { ay: EKIM, pct: 70 }, simdi: { ay: KASIM, pct: 95 } }],
  },
  "guclu.enIyiAy": {
    section: "guclu", doc: "Bu ay, izlenen aylar içinde en yüksek net oranı.",
    fields: { sinav: "'TYT' | 'AYT'", ay: "ay nesnesi", NO: "net oranı", aySayisi: "karşılaştırılan ay sayısı" },
    samples: [{ sinav: "TYT", ay: EKIM, NO: 64.2, aySayisi: 4 }, { sinav: "AYT", ay: KASIM, NO: 38, aySayisi: 3 }],
  },
  "guclu.deneme": {
    section: "guclu", doc: "Deneme sınavlarında belirgin yükseliş (son üç deneme düşmeden, toplam ≥ 4 net) ya da kişisel rekor (en az 3 deneme içinde en yüksek). Gerçek net.",
    fields: {
      sinav: "'TYT' | 'AYT'", tip: "'yukselis' | 'rekor'", net: "son denemenin neti", ilkNet: "yükselişin ilk denemesinin neti (yalnız yukselis)?",
      artis: "net artışı (yukselis: son − ilk; rekor: son − önceki en iyi)", sayi: "yukselis: 3 · rekor: karşılaştırılan deneme sayısı (son dahil)",
      oncekiEnIyi: "önceki en iyi net (yalnız rekor)?", degerler: "yükselişteki netler, eskiden yeniye (yalnız yukselis)?",
    },
    samples: [
      { sinav: "TYT", tip: "yukselis", net: 81.25, ilkNet: 72.5, artis: 8.75, sayi: 3, oncekiEnIyi: null, degerler: [72.5, 76, 81.25] },
      { sinav: "AYT", tip: "rekor", net: 48.5, ilkNet: null, artis: 3.25, sayi: 5, oncekiEnIyi: 45.25, degerler: null },
    ],
  },

  // ---------------------------------------------------------------- GELİŞİM ALANLARI (alan / kanit / oneri ayrı bankalar)
  // alan: kısa başlık (3–7 kelime); kanit: sayılarla tek cümle; oneri: somut, küçük bir adım (koç diliyle, "öğrenci").
  "gelisim.odakDers": {
    section: "gelisim", doc: "Odak ders: en çok net kazanım fırsatı; en düşük konular ve haftalık hedef.",
    fields: { ders: "ders", NO: "net oranı", n: "kayıt", Q: "soru", pTilde: "okul medyan yüzdelik?", hedefQ: "haftalık soru hedefi", konular: "[{ ad, oran }] (0–3)" },
    samples: [
      { ders: "TYT Matematik", NO: 36.1, n: 6, Q: 175, pTilde: 14, hedefQ: 60, konular: [{ ad: "Problemler", oran: 35 }, { ad: "Kümeler", oran: 36 }] },
      { ders: "AYT Fizik", NO: 28.4, n: 4, Q: 120, pTilde: null, hedefQ: 40, konular: [] },
    ],
  },
  "gelisim.yanlis": {
    section: "gelisim", doc: "Yanlış ağırlıklı profil: isabet düşük, boş az.",
    fields: { ders: "ders", isabet: "isabet %", bos: "boş %", gotur: "yanlışların götürdüğü net", Y: "yanlış sayısı", onda: "her 10 işaretten yaklaşık kaçı yanlış" },
    samples: [{ ders: "TYT Fizik", isabet: 40, bos: 11, gotur: 9.25, Y: 37, onda: 6 }, { ders: "TYT Kimya", isabet: 58, bos: 12, gotur: 4.5, Y: 18, onda: 4 }],
  },
  "gelisim.bos": {
    section: "gelisim", doc: "Konu eksiği profili: boş oranı yüksek, isabet orta/düşük.",
    fields: { ders: "ders", bos: "boş %", isabet: "isabet %", konu: "en çok zorlanılan konu" },
    samples: [{ ders: "TYT Matematik", bos: 29, isabet: 60, konu: "Problemler" }, { ders: "AYT Matematik", bos: 34, isabet: 55, konu: "Limit" }],
  },
  "gelisim.temkinli": {
    section: "gelisim", doc: "Temkinli profil: isabet yüksek ama çok boş.",
    fields: { ders: "ders", isabet: "isabet %", bos: "boş %" },
    samples: [{ ders: "TYT Geometri", isabet: 81, bos: 26 }, { ders: "TYT Biyoloji", isabet: 77, bos: 22 }],
  },
  "gelisim.dusus": {
    section: "gelisim", doc: "Son 4 haftada anlamlı düşüş (okul genelinde görülmüyor).",
    fields: { ders: "ders", a: "önceki", b: "şimdiki", delta: "puan farkı (negatif)", okulVerisi: "okul karşılaştırması var mı", konu: "temel konu" },
    samples: [{ ders: "TYT Fizik", a: 48, b: 36, delta: -12, okulVerisi: true, konu: "Elektrik" }, { ders: "TYT Geometri", a: 60, b: 50, delta: -10, okulVerisi: false, konu: "Dörtgenler" }],
  },
  "gelisim.okulAlt": {
    section: "gelisim", doc: "Aynı okul ödevlerinde çoğunlukla alt çeyrek.",
    fields: { ders: "ders", fark: "okul medyanına ortalama uzaklık (puan)", k: "alt çeyrek ödev", n: "karşılaştırılan ödev", ogretmen: "branş öğretmeni?", konu: "ilk konu" },
    samples: [{ ders: "TYT Matematik", fark: 23, k: 6, n: 6, ogretmen: "Kerem Yalın", konu: "Problemler" }, { ders: "AYT Kimya", fark: 15, k: 2, n: 3, ogretmen: null, konu: "Gazlar" }],
  },
  "gelisim.konuPasi": {
    section: "gelisim", doc: "'Konuyu bilmiyorum' gerekçesiyle pas (konu anlatımı eksik).",
    fields: { ders: "ders", konular: "konu adları (1–3)", sayi: "son 28 günde bu dersteki KONU pası", ogretmen: "ödevi veren?", okulOrani: "okul genelinde KONU pas oranı %?" },
    samples: [{ ders: "TYT Fizik", konular: ["Elektrik"], sayi: 2, ogretmen: "Selin Ova", okulOrani: 34 }, { ders: "TYT Kimya", konular: ["Gazlar", "Karışımlar"], sayi: 2, ogretmen: null, okulOrani: null }],
  },
  "gelisim.kaynak": {
    section: "gelisim", doc: "Kaynak kitap eksik olduğu için pas.",
    fields: { ders: "ders", kitap: "kitap adı", sayi: "pas sayısı", ogretmen: "branş öğretmeni?" },
    samples: [{ ders: "TYT Kimya", kitap: "Kimya Soru Bankası", sayi: 1, ogretmen: "Umut Tan" }, { ders: "AYT Fizik", kitap: "Fizik 2 Fasikül", sayi: 3, ogretmen: null }],
  },
  "gelisim.sessiz": {
    section: "gelisim", doc: "Süresi geçmiş ama ne teslim ne pas (sessiz) ödevler.",
    fields: { sayi: "sessiz ödev", enEski: "en eskisi kaç gün önce", hatirlatma: "hatırlatma gönderildi mi", ornekler: "[{ ders, konu, soru? }] (1–3)" },
    samples: [
      { sayi: 4, enEski: 26, hatirlatma: false, ornekler: [{ ders: "TYT Matematik", konu: "Problemler", soru: 25 }, { ders: "TYT Biyoloji", konu: "Kalıtım", soru: 30 }] },
      { sayi: 1, enEski: 3, hatirlatma: true, ornekler: [{ ders: "TYT Tarih", konu: "Türk İnkılabı", soru: null }] },
    ],
  },
  "gelisim.duzen": {
    section: "gelisim", doc: "Ödev düzeni düşük (ele alınan < %70).",
    fields: { V: "vadesi gelen", sessiz: "sessiz", eleAlinan: "ele alınan %", teslim: "teslim %", okulTeslim: "okul ödevi teslim %?", kisiselTeslim: "kişisel ödev teslim %?" },
    samples: [{ V: 12, sessiz: 5, eleAlinan: 58, teslim: 50, okulTeslim: 55, kisiselTeslim: 33 }, { V: 8, sessiz: 3, eleAlinan: 62.5, teslim: 62.5, okulTeslim: null, kisiselTeslim: null }],
  },
  "gelisim.zaman": {
    section: "gelisim", doc: "Zaman sıkıntısı: 'zaman yetmedi' pasları ya da geç teslimler.",
    fields: { zamanPasi: "14 günde zaman pası", gecOrani: "geç teslim oranı %", soru: "örnek ödev soru sayısı", gunluk: "3 güne bölünce günlük soru" },
    samples: [{ zamanPasi: 2, gecOrani: 20, soru: 60, gunluk: 20 }, { zamanPasi: 0, gecOrani: 45, soru: 30, gunluk: 10 }],
  },
  "gelisim.sonGun": {
    section: "gelisim", doc: "Çok günlük ödevleri son güne bırakma alışkanlığı.",
    fields: { oran: "son gün teslim oranı %", sayi: "son gün teslim", toplam: "çok günlük ödev" },
    samples: [{ oran: 67, sayi: 6, toplam: 9 }, { oran: 80, sayi: 4, toplam: 5 }],
  },
  "gelisim.kismi": {
    section: "gelisim", doc: "Beklenen sorudan az giriş (kısmi teslim).",
    fields: { sayi: "kısmi giriş", toplam: "beklenen sorusu bilinen ödev", ornek: "{ ders, Q, beklenen }" },
    samples: [{ sayi: 2, toplam: 6, ornek: { ders: "TYT Matematik", Q: 18, beklenen: 30 } }, { sayi: 3, toplam: 4, ornek: { ders: "TYT Fizik", Q: 10, beklenen: 20 } }],
  },
  "gelisim.numara": {
    section: "gelisim", doc: "Yanlış/boş soru numaraları girilmiyor (tekrar listesi oluşmuyor).",
    fields: { oran: "numara girilen kayıt %", sayi: "yanlış/boşu olan kayıt" },
    samples: [{ oran: 12, sayi: 17 }, { oran: 0, sayi: 6 }],
  },
  "gelisim.tekrar": {
    section: "gelisim", doc: "Uzun süredir dönülmeyen, düşük kalmış konu (unutma riski).",
    fields: { ders: "ders", konu: "konu", gun: "son çalışmadan beri gün", oran: "o konudaki net oranı", soru: "o konudaki soru" },
    samples: [{ ders: "TYT Matematik", konu: "Sayılar", gun: 63, oran: 25, soru: 40 }, { ders: "TYT Fizik", konu: "Basınç", gun: 24, oran: 41, soru: 30 }],
  },
  "gelisim.denge": {
    section: "gelisim", doc: "TYT/AYT dengesizliği (12. sınıf): küçük tarafın payı < %25. DİL alanında üretilmez (AYT yerine YDT).",
    fields: {
      kucuk: "'TYT' | 'AYT'", oran: "küçük tarafın payı %", toplam: "toplam soru", kucukSoru: "küçük tarafın sorusu", hedef: "bu hafta eklenecek soru",
      alan: "öğrencinin YKS alanının adı ('Sayısal' / 'Eşit Ağırlık' / 'Sözel'; ek yapıştırılmaz)?",
    },
    samples: [
      { kucuk: "AYT", oran: 9, toplam: 1167, kucukSoru: 100, hedef: 70, alan: null },
      { kucuk: "TYT", oran: 18, toplam: 640, kucukSoru: 115, hedef: 40, alan: null },
      { kucuk: "AYT", oran: 14, toplam: 820, kucukSoru: 115, hedef: 50, alan: "Eşit Ağırlık" },
      { kucuk: "TYT", oran: 21, toplam: 900, kucukSoru: 189, hedef: 60, alan: "Sayısal" },
    ],
  },
  "gelisim.kapsam": {
    section: "gelisim", doc: "Okulda işlenmiş ama öğrencinin hiç kaydı olmayan konular.",
    fields: { ders: "ders", sayi: "konu sayısı", konular: "konu adları (1–3)" },
    samples: [{ ders: "TYT Kimya", sayi: 2, konular: ["Asitler, Bazlar ve Tuzlar", "Karışımlar"] }, { ders: "AYT Matematik", sayi: 4, konular: ["Logaritma", "Diziler", "Limit"] }],
  },
  "gelisim.serbestYok": {
    section: "gelisim", doc: "3 haftadır ödev dışı kayıt yok (ödevler düzenli).",
    fields: { teslim: "teslim %", odakDers: "odak ders?" },
    samples: [{ teslim: 92, odakDers: "TYT Matematik" }, { teslim: 85, odakDers: null }],
  },
  "gelisim.serbestDagilim": {
    section: "gelisim", doc: "Serbest çalışma güçlü derslere yığılıyor, odak ders ihmal.",
    fields: { gucluPay: "güçlü derslere giden pay %", odakPay: "odak derse giden pay %", gucluDers: "ders", odakDers: "ders", serbestSoru: "serbest soru" },
    samples: [{ gucluPay: 100, odakPay: 0, gucluDers: "TYT Türkçe", odakDers: "AYT Matematik", serbestSoru: 328 }, { gucluPay: 72, odakPay: 6, gucluDers: "TYT Biyoloji", odakDers: "TYT Fizik", serbestSoru: 180 }],
  },
  "gelisim.ihmal": {
    section: "gelisim", doc: "Güçlü ders uzun süredir çalışılmıyor (bakım).",
    fields: { ders: "ders", gun: "son kayıttan beri gün", NO: "net oranı" },
    samples: [{ ders: "TYT Türkçe", gun: 24, NO: 77 }, { ders: "TYT Biyoloji", gun: 35, NO: 72 }],
  },
  "gelisim.surekliOdak": {
    section: "gelisim", doc: "Birkaç aydır üst üste Odak kalan ders (kalıcı sorun).",
    fields: { ders: "ders", aySayisi: "kaç aydır", aylar: "ay nesneleri (eskiden yeniye)", NO: "bu ayki net oranı", konular: "konu adları (0–3)", ogretmen: "branş öğretmeni?" },
    samples: [
      { ders: "TYT Matematik", aySayisi: 3, aylar: [AGUSTOS, EYLUL, EKIM], NO: 36, konular: ["Problemler", "Kümeler"], ogretmen: "Kerem Yalın" },
      { ders: "AYT Fizik", aySayisi: 2, aylar: [EYLUL, EKIM], NO: 29, konular: [], ogretmen: null },
    ],
  },
  "gelisim.seyirDusus": {
    section: "gelisim", doc: "Aydan aya düşen net oranı (sınav geneli ya da ders).",
    fields: { konu: "'TYT' / 'AYT' ya da ders adı", ilk: "{ ay, NO }", son: "{ ay, NO }", delta: "puan farkı (negatif)", aySayisi: "kaç ay" },
    samples: [
      { konu: "AYT", ilk: { ay: EYLUL, NO: 40 }, son: { ay: KASIM, NO: 31 }, delta: -9, aySayisi: 3 },
      { konu: "TYT Geometri", ilk: { ay: EYLUL, NO: 61 }, son: { ay: EKIM, NO: 50 }, delta: -11, aySayisi: 2 },
    ],
  },
  "gelisim.denemeDers": {
    section: "gelisim", doc: "Denemelerde en çok net kaçan ders: son (en fazla 3) denemede, dersin soru sayısına göre ortalama kaçan net (soru − net) en büyük olan; en az 2 denemede girilmiş. Gerçek net; fırsat diliyle.",
    fields: {
      ders: "ders ('TYT Matematik', 'AYT Felsefe Grubu'; ek yapıştırılmaz)", soru: "dersin denemedeki soru sayısı", deneme: "hesaba giren deneme sayısı (2–3)",
      ortNet: "ortalama net", kayip: "ortalama kaçan net (soru − net)", sonNet: "son denemedeki net", yanlisPay: "kaçan netin yanlışlardan gelen payı %",
      yanlisKaybi: "yanlışlardan kaçan ortalama net (1,25·Y)", bosKaybi: "boş ya da girilmeyen sorulardan kaçan ortalama net",
    },
    samples: [
      { ders: "TYT Matematik", soru: 30, deneme: 3, ortNet: 12.5, kayip: 17.5, sonNet: 14.25, yanlisPay: 31, yanlisKaybi: 5.42, bosKaybi: 12.08 },
      { ders: "AYT Fizik", soru: 14, deneme: 2, ortNet: 4.75, kayip: 9.25, sonNet: 5.5, yanlisPay: 64, yanlisKaybi: 5.9, bosKaybi: 3.35 },
    ],
  },

  // ---------------------------------------------------------------- KOÇA ÖNERİLER (her kalıp TEK eylem cümlesi, koça hitap)
  "koc.kisiselOdev": {
    section: "koc", doc: "Belirli konulara kişisel ödev ver.",
    fields: { ders: "ders", konular: "konu adları (1–3)", soru: "önerilen set büyüklüğü metni (ör. '20–30')" },
    samples: [{ ders: "TYT Matematik", konular: ["Problemler", "Kümeler"], soru: "20–30" }, { ders: "AYT Fizik", konular: ["Atışlar"], soru: "15–20" }],
  },
  "koc.brans": {
    section: "koc", doc: "Branş öğretmeniyle görüş / etüt ayarla.",
    fields: { ders: "ders", ogretmen: "öğretmen adı?", konular: "konu adları (0–3)" },
    samples: [{ ders: "TYT Fizik", ogretmen: "Selin Ova", konular: ["Elektrik"] }, { ders: "TYT Kimya", ogretmen: null, konular: [] }],
  },
  "koc.yonetim": {
    section: "koc", doc: "Kaynak kitap eksiğini okul yönetimine ilet.",
    fields: { kitap: "kitap", ders: "ders" },
    samples: [{ kitap: "Kimya Soru Bankası", ders: "TYT Kimya" }, { kitap: "Fizik 2 Fasikül", ders: "AYT Fizik" }],
  },
  "koc.yuk": { section: "koc", doc: "Haftalık ödev yükünü birlikte gözden geçir / gün gün plan.", fields: {}, samples: [{}] },
  "koc.araKontrol": { section: "koc", doc: "Çok günlük ödevlerin ortasına ara kontrol noktası koy.", fields: {}, samples: [{}] },
  "koc.hedef": {
    section: "koc", doc: "Bir derse haftalık soru hedefi koy.",
    fields: { ders: "ders", hedefQ: "haftalık soru" },
    samples: [{ ders: "TYT Matematik", hedefQ: 60 }, { ders: "AYT Kimya", hedefQ: 40 }],
  },
  "koc.numara": { section: "koc", doc: "Yanlış/boş soru numaralarını girmesini iste, bir kez birlikte göster.", fields: {}, samples: [{}] },
  "koc.tekrar": {
    section: "koc", doc: "Unutulmaya yüz tutmuş konuya kısa tekrar ödevi.",
    fields: { ders: "ders", konu: "konu" },
    samples: [{ ders: "TYT Matematik", konu: "Sayılar" }, { ders: "TYT Fizik", konu: "Basınç" }],
  },
  "koc.takdir": {
    section: "koc", doc: "Somut bir başarıyı takdir et.",
    fields: { neyi: "takdir edilecek şeyin kısa ifadesi (belirtme durumunda, ör. 'TYT Tarih dersindeki yükselişi')" },
    samples: [{ neyi: "TYT Tarih dersindeki yükselişi" }, { neyi: "18 ödevin 17 tanesini zamanında teslim etmesini" }],
  },
  "koc.zorluk": {
    section: "koc", doc: "Güçlü derste zorluğu artır (yeni nesil / daha zor kaynak).",
    fields: { ders: "ders" },
    samples: [{ ders: "TYT Türkçe" }, { ders: "TYT Biyoloji" }],
  },
  "koc.denge": {
    section: "koc", doc: "Kişisel ödevlerin bir kısmını küçük kalan tarafa (TYT/AYT) kaydır.",
    fields: { kucuk: "'TYT' | 'AYT'", hedef: "bu hafta soru" },
    samples: [{ kucuk: "AYT", hedef: 70 }, { kucuk: "TYT", hedef: 40 }],
  },
  "koc.serbest": {
    section: "koc", doc: "Serbest çalışmayı odak derse yönlendir.",
    fields: { odakDers: "ders?" },
    samples: [{ odakDers: "TYT Matematik" }, { odakDers: null }],
  },
  "koc.birebir": {
    section: "koc", doc: "Bu hafta birebir ulaş (uzun sessizlik).",
    fields: { gun: "kaç gündür kayıt yok" },
    samples: [{ gun: 9 }, { gun: 14 }],
  },
  "koc.eskalasyon": {
    section: "koc", doc: "Aylardır süren odak ders için planı değiştir: branş öğretmeni + (gerekirse) veliyle ortak plan.",
    fields: { ders: "ders", aySayisi: "kaç aydır", ogretmen: "öğretmen?" },
    samples: [{ ders: "TYT Matematik", aySayisi: 3, ogretmen: "Kerem Yalın" }, { ders: "AYT Fizik", aySayisi: 4, ogretmen: null }],
  },

  // ---------------------------------------------------------------- ÖĞRENCİYLE KONUŞMA (her kalıp TEK cümle; koça yol gösterir)
  "konusma.acilis": {
    section: "konusma", doc: "Görüşmeyi olumlu bir şeyle aç.",
    fields: { olumlu: "belirtme durumunda kısa ifade (ör. 'TYT Türkçe dersindeki istikrarını')" },
    samples: [{ olumlu: "TYT Türkçe dersindeki istikrarını" }, { olumlu: "4 haftadır süren düzen serisini" }],
  },
  "konusma.soruSessiz": { section: "konusma", doc: "Sessiz kalan ödevlerin nedenini açık uçlu sor.", fields: { sayi: "sessiz ödev" }, samples: [{ sayi: 3 }, { sayi: 1 }] },
  "konusma.soruOdak": {
    section: "konusma", doc: "Odak dersteki zorlanmayı sor.",
    fields: { ders: "ders", konu: "konu?" },
    samples: [{ ders: "TYT Matematik", konu: "Problemler" }, { ders: "AYT Fizik", konu: null }],
  },
  "konusma.soruZaman": { section: "konusma", doc: "Haftalık zaman/yük dağılımını sor.", fields: {}, samples: [{}] },
  "konusma.soruKonuPasi": {
    section: "konusma", doc: "'Konuyu bilmiyorum' dediği konuyu nerede kaybettiğini sor.",
    fields: { ders: "ders", konu: "konu" },
    samples: [{ ders: "TYT Fizik", konu: "Elektrik" }, { ders: "TYT Kimya", konu: "Gazlar" }],
  },
  "konusma.soruDusus": { section: "konusma", doc: "Düşüşün nedenini (yeni konu mu, yük mü) sor.", fields: { ders: "ders" }, samples: [{ ders: "TYT Fizik" }, { ders: "TYT Geometri" }] },
  "konusma.soruGenel": { section: "konusma", doc: "Genel, açık uçlu bir soru (ne iyi gitti, ne zorladı).", fields: {}, samples: [{}] },
  "konusma.hedef": {
    section: "konusma", doc: "Birlikte tek bir ölçülebilir hedef koy.",
    fields: { ders: "ders?", hedefQ: "haftalık soru?", gun: "haftalık aktif gün hedefi" },
    samples: [{ ders: "TYT Matematik", hedefQ: 60, gun: 4 }, { ders: null, hedefQ: null, gun: 5 }],
  },
  "konusma.kapanis": { section: "konusma", doc: "Görüşmeyi cesaret verici bir cümleyle kapat / bir sonraki kontrolü belirle.", fields: {}, samples: [{}] },

  // ---------------------------------------------------------------- DİKKAT (her kalıp TEK cümle; nötr, suçlamasız)
  "dikkat.giris": { section: "dikkat", doc: "Uygulamaya uzun süredir giriş yok.", fields: { gun: "gün" }, samples: [{ gun: 6 }, { gun: 12 }] },
  "dikkat.kayit": { section: "dikkat", doc: "Uzun süredir kayıt yok.", fields: { gun: "gün" }, samples: [{ gun: 8 }, { gun: 15 }] },
  "dikkat.sessizSeri": { section: "dikkat", doc: "Son 14 günde birden çok sessiz ödev.", fields: { sayi: "sessiz ödev" }, samples: [{ sayi: 3 }, { sayi: 2 }] },
  "dikkat.sertDusus": { section: "dikkat", doc: "Bir derste sert düşüş (≥10 puan).", fields: { ders: "ders", delta: "puan (negatif)" }, samples: [{ ders: "TYT Fizik", delta: -12 }, { ders: "AYT Kimya", delta: -15.5 }] },
  "dikkat.aktivite": { section: "dikkat", doc: "Ay boyunca çok az aktif gün.", fields: { aktifGun: "aktif gün", gunSayisi: "gün" }, samples: [{ aktifGun: 5, gunSayisi: 31 }, { aktifGun: 8, gunSayisi: 30 }] },
  "dikkat.veri": {
    section: "dikkat", doc: "Veriler yaklaşık (kısmi girişler ya da serbest çalışma ödevden çok yüksek).",
    fields: { kismiOran: "kısmi/fazla giriş oranı %?", serbestFark: "serbest − ödev net oranı farkı (puan)?" },
    samples: [{ kismiOran: 35, serbestFark: null }, { kismiOran: null, serbestFark: 26 }],
  },
  "dikkat.takipDisi": { section: "dikkat", doc: "Okul ödevi gelen ama hiç kaydı olmayan AYT dersleri.", fields: { dersler: "ders adları (1–3)" }, samples: [{ dersler: ["AYT Tarih-1"] }, { dersler: ["AYT Coğrafya-1", "AYT Felsefe"] }] },
  "dikkat.hacimDusus": {
    section: "dikkat", doc: "Çözülen soru önceki aya göre sert düştü (≥%30).",
    fields: { onceki: "{ ay, Q }", simdi: "{ ay, Q }", degisimPct: "yüzde (negatif)" },
    samples: [{ onceki: { ay: EYLUL, Q: 1200 }, simdi: { ay: EKIM, Q: 700 }, degisimPct: -41.7 }, { onceki: { ay: EKIM, Q: 900 }, simdi: { ay: KASIM, Q: 600 }, degisimPct: -33.3 }],
  },
};

export const SECTIONS = ["ozet", "guclu", "gelisim", "koc", "konusma", "dikkat"];
export const keysOf = (section) => Object.keys(CATALOG).filter((k) => CATALOG[k].section === section);
