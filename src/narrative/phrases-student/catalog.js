// Öğrenci sürümünün OLGU SÖZLEŞMESİ — "Ayın değerlendirmesi" (buildNarrative(raw, { audience: "student" })).
//
// Öğrenci, koçla AYNI olguları görür (../catalog.js; alanlar ve örnekler oradan gelir) — şu farklarla:
//  • Koça özel olgular hiç gösterilmez: genel durum (ozet.durum* — "müdahale / takip et" çipi), dikkat bölümü (veri
//    notları, giriş/kayıt uyarıları), koça öneriler ve görüşme metni. Başka öğrencinin adı hiçbir olguda yoktur.
//  • Okul karşılaştırması yalnızca olumluysa anılır: "alt çeyrek" olgusu (gelisim.okulAlt) öğrenciye gösterilmez,
//    gelisim.odakDers'in pTilde alanı (50'nin altında olabilir) öğrenci kalıplarında kullanılmaz.
//  • Öğrenciye özel iki bölüm: özetin cesaretlendirici kapanışı (ozet.tesvik) ve "Bu hafta yapabileceklerin"
//    (sonrakiAdimlar → adim.* olguları, aşağıda).
// ../catalog.js'e yeni bir ozet/guclu/gelisim olgusu eklenince öğrenci kalıbı da yazılmalı: test
// (test/narrativeStudentPhrases.test.js) buradaki her anahtarın öğrenci bankasını arar; eksik kalıplı olgu çalışma anında
// sessizce atlanır.
import { CATALOG } from "../catalog.js";

export const STUDENT_EXCLUDED = new Set(["ozet.durumIyi", "ozet.durumTakip", "ozet.durumMudahale", "gelisim.okulAlt"]);

const shared = Object.fromEntries(
  Object.entries(CATALOG).filter(([k, v]) => ["ozet", "guclu", "gelisim"].includes(v.section) && !STUDENT_EXCLUDED.has(k)),
);

export const STUDENT_CATALOG = {
  ...shared,

  // ---------------------------------------------------------------- ÖZET (öğrenciye özel)
  "ozet.tesvik": {
    section: "ozet", doc: "Özetin cesaretlendirici kapanışı / az veride davet (olgu yok).",
    fields: {}, samples: [{}],
  },

  // ---------------------------------------------------------------- BU HAFTA YAPABİLECEKLERİN (her kalıp TEK eylem cümlesi, "sen" dili)
  "adim.konu": {
    section: "adim", doc: "Bir konudan belirli sayıda soru (odak ders, boş/konu eksiği, düşüş, kapsam).",
    fields: { ders: "ders", konu: "konu adı (tırnakla; ek yapıştırılmaz)", soru: "soru sayısı (ör. 15)" },
    samples: [{ ders: "TYT Matematik", konu: "Problemler", soru: 15 }, { ders: "AYT Kimya", konu: "Asitler, Bazlar ve Tuzlar", soru: 10 }],
  },
  "adim.hedef": {
    section: "adim", doc: "Bir derse haftalık soru hedefi (konu bilinmiyorsa).",
    fields: { ders: "ders", hedefQ: "haftalık soru" },
    samples: [{ ders: "TYT Matematik", hedefQ: 60 }, { ders: "AYT Fizik", hedefQ: 20 }],
  },
  "adim.tekrar": {
    section: "adim", doc: "Uzun süredir dönülmeyen konuya kısa tekrar.",
    fields: { ders: "ders", konu: "konu" },
    samples: [{ ders: "TYT Matematik", konu: "Sayılar" }, { ders: "TYT Fizik", konu: "Basınç" }],
  },
  "adim.sonuc": {
    section: "adim", doc: "Sonucu girilmemiş (süresi geçmiş) ödevleri kapat: sonuç gir ya da nedenini seçip pas geç.",
    fields: { sayi: "açık ödev sayısı (≥ 1)" },
    samples: [{ sayi: 3 }, { sayi: 1 }],
  },
  "adim.numara": { section: "adim", doc: "Yanlış/boş soru numaralarını girme alışkanlığı.", fields: {}, samples: [{}] },
  "adim.gun": {
    section: "adim", doc: "Haftalık aktif gün hedefi.",
    fields: { gun: "gün (3–6)" },
    samples: [{ gun: 4 }, { gun: 6 }],
  },
  "adim.denemeAnaliz": {
    section: "adim", doc: "Denemede en çok net kaçan bölümün analizi.",
    fields: { ders: "ders ('TYT Matematik')" },
    samples: [{ ders: "TYT Matematik" }, { ders: "AYT Fizik" }],
  },
  "adim.denge": {
    section: "adim", doc: "Küçük kalan tarafa (TYT/AYT) bu hafta soru ekle.",
    fields: { kucuk: "'TYT' | 'AYT'", hedef: "bu hafta soru" },
    samples: [{ kucuk: "AYT", hedef: 70 }, { kucuk: "TYT", hedef: 40 }],
  },
  "adim.serbest": {
    section: "adim", doc: "Ödev dışı serbest çalışma (varsa odak derse).",
    fields: { ders: "odak ders?" },
    samples: [{ ders: "TYT Matematik" }, { ders: null }],
  },
  "adim.bolme": { section: "adim", doc: "Çok günlük ödevleri güne bölme / erken başlama.", fields: {}, samples: [{}] },
  "adim.brans": {
    section: "adim", doc: "Branş öğretmeninden destek (konu eksiği, kalıcı odak ders).",
    fields: { ders: "ders", ogretmen: "branş öğretmeni adı?", konu: "konu?" },
    samples: [{ ders: "TYT Fizik", ogretmen: "Selin Ova", konu: "Elektrik" }, { ders: "AYT Matematik", ogretmen: null, konu: null }],
  },
  "adim.kaynak": {
    section: "adim", doc: "Eksik kaynak kitabı koça bildir / başka kaynakla ilerle.",
    fields: { kitap: "kitap adı", ders: "ders" },
    samples: [{ kitap: "Kimya Soru Bankası", ders: "TYT Kimya" }, { kitap: "Fizik 2 Fasikül", ders: "AYT Fizik" }],
  },
  "adim.genel": { section: "adim", doc: "Genel küçük adım (yedek).", fields: {}, samples: [{}] },
};
