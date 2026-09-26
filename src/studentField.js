// Öğrencinin YKS alanı (User.field): SAY · EA · SOZ · DIL, null = bilinmiyor. Kodlar ve doğrulama
// server/src/subjects.js > STUDENT_FIELDS / normalizeField ile İÇERİK olarak aynı tutulmalı (iki ayrı paket).
// Bu dosya bilerek hiçbir şey import etmez: rapor modeli (reportModel.js — Node'da sunucu testleri de çalıştırır),
// admin ekranı ve koç ekranı aynı listeyi buradan alır; subjects.js'e konsaydı SVG ikonları da peşinden gelirdi.

export const STUDENT_FIELDS = ["SAY", "EA", "SOZ", "DIL"];
// Kısa ad (rozet, seçim çipi) ve tam ad (rapor başlığı, açıklamalar). Kodlardaki Ö/İ veritabanında sadeleşmiş durur.
export const FIELD_SHORT = { SAY: "SAY", EA: "EA", SOZ: "SÖZ", DIL: "DİL" };
export const FIELD_LABELS = { SAY: "Sayısal", EA: "Eşit Ağırlık", SOZ: "Sözel", DIL: "Dil" };
export const FIELD_OPTIONS = STUDENT_FIELDS.map((f) => ({ value: f, label: `${FIELD_LABELS[f]} (${FIELD_SHORT[f]})` }));

// Alanın AYT dersleri — rapor bu dersleri, kaydı olmasa bile her zaman izler (bkz. reportModel.js). DİL öğrencisi
// AYT'ye değil YDT'ye (yabancı dil testi) girer; uygulamada YDT dersi olmadığı için listesi boş.
export const FIELD_AYT = {
  SAY: ["Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji"],
  EA: ["Matematik", "Geometri", "Edebiyat", "Tarih-1", "Coğrafya-1"],
  SOZ: ["Edebiyat", "Tarih-1", "Coğrafya-1", "Tarih-2", "Coğrafya-2", "Felsefe", "Mantık", "Psikoloji", "Sosyoloji", "Din Kültürü ve Ahlak Bilgisi"],
  DIL: [],
};

export const isField = (v) => STUDENT_FIELDS.includes(v);

// Toplu içe aktarmada yapıştırılan metin: kod ("SÖZ", "DİL"), tam ad ("Eşit Ağırlık"), eski ad ("TM") ya da "YDT".
// Boş → null; tanınmayan → undefined (önizlemede "alan geçersiz" gösterilir, sunucu da reddeder).
const ALIASES = {
  say: "SAY", sayisal: "SAY",
  ea: "EA", esitagirlik: "EA", tm: "EA",
  soz: "SOZ", sozel: "SOZ",
  dil: "DIL", yabancidil: "DIL", ydt: "DIL",
};
const FOLD = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
export function normalizeField(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const key = value.toLocaleLowerCase("tr-TR").replace(/[çğıöşüâîû]/g, (c) => FOLD[c] || c).replace(/[^a-z0-9]/g, "");
  if (!key) return null;
  return ALIASES[key];
}
