// Deneme sınavları (TYT/AYT) — sunucu tarafının tek kaynağı: resmî ders/soru düzeni, gelen kaydın doğrulanması ve yanıt
// biçimi. Rotalar (routes/practiceExams.js), rapor ucu (routes/stats.js > full-report) ve aylık özet (monthlySummary.js)
// hepsi buradan okur. İstemcideki src/practiceExams.js ile İÇERİK olarak aynı tutulmalı (iki ayrı paket, paylaşılan
// modül yok): istemci formu aynı sınırlarla adım adım girer, sunucu yine de her sınırı kendisi doğrular.
import { assert } from "./validators.js";
import { EXAM_TYPES } from "./subjects.js";

// ÖSYM kitapçık sırası ve resmî soru sayıları. TYT 120 soru: Türkçe 40 · Sosyal 20 · Temel Matematik 40 · Fen 20.
// AYT 160 soru: Edebiyat–Sosyal-1 40 · Sosyal-2 40 · Matematik 40 · Fen 40. AYT'de Felsefe Grubu (Felsefe + Mantık +
// Psikoloji + Sosyoloji) kitapçıkta tek 12 soruluk blok, karnede de tek sayı — bu yüzden "Felsefe" adıyla TEK satır
// (ödev ders listesindeki Mantık/Psikoloji/Sosyoloji ayrımı denemede yok). Liste değişirse migration gerekmez.
export const PRACTICE_EXAM_LAYOUT = {
  TYT: [
    ["Türkçe", 40],
    ["Tarih", 5], ["Coğrafya", 5], ["Felsefe", 5], ["Din Kültürü ve Ahlak Bilgisi", 5],
    ["Matematik", 30], ["Geometri", 10],
    ["Fizik", 7], ["Kimya", 7], ["Biyoloji", 6],
  ],
  AYT: [
    ["Edebiyat", 24], ["Tarih-1", 10], ["Coğrafya-1", 6],
    ["Tarih-2", 11], ["Coğrafya-2", 11], ["Felsefe", 12], ["Din Kültürü ve Ahlak Bilgisi", 6],
    ["Matematik", 30], ["Geometri", 10],
    ["Fizik", 14], ["Kimya", 13], ["Biyoloji", 13],
  ],
};
const MAX = Object.fromEntries(Object.entries(PRACTICE_EXAM_LAYOUT).map(([e, list]) => [e, new Map(list)]));
const ORDER = Object.fromEntries(Object.entries(PRACTICE_EXAM_LAYOUT).map(([e, list]) => [e, new Map(list.map(([s], i) => [s, i]))]));

// Dersin denemedeki soru sayısı; o sınav türünde yoksa null.
export function practiceExamMax(examType, subject) {
  return MAX[examType]?.get(subject) ?? null;
}

export const PRACTICE_EXAM_NAME_MAX = 80;
// Makul en eski tarih — yanlış yazılmış bir yılın (ör. 1026) trende "ilk deneme" diye girmesin.
const MIN_DATE = new Date("2020-01-01T00:00:00.000Z");
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

// Türkiye takvim günü (UTC+3, yaz saati yok) — UTC gece yarısı Date olarak.
function trDayOf(d) {
  const t = new Date(new Date(d).getTime() + TR_OFFSET_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

// "YYYY-MM-DD" → o günün UTC gece yarısı (planEntries.js > parseDateOnly ile aynı saklama). Tam bir an (ISO) gelirse
// Türkiye takvimindeki günü alınır. Geçersiz → null.
function parseDateOnly(value) {
  if (typeof value !== "string" || !value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    // 2026-02-31 gibi taşan tarihler reddedilir (Date.UTC sessizce 3 Mart'a çevirirdi).
    return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : trDayOf(d);
}

// Gelen gövdeyi doğrular → { examType, date, name, results }. Kurallar:
//  • examType TYT | AYT; tarih geçerli, bugünden (TR) ileri değil;
//  • her ders o sınav türünün deneme listesinde, en fazla bir kez; D, Y, B 0 ya da daha büyük tam sayı (boş → 0);
//  • D + Y + B ≤ dersin resmî soru sayısı (ör. TYT Matematik 30) — fazlası yazım hatasıdır, deneme netini bozar;
//  • hiç girilmemiş ders (0/0/0) kaydedilmez; en az bir ders dolu olmalı.
export function validatePracticeExam(body, now = new Date()) {
  const { examType, date, name, results } = body || {};
  assert(EXAM_TYPES.includes(examType), "Geçersiz sınav türü");
  const day = parseDateOnly(date);
  assert(day && day >= MIN_DATE, "Geçerli bir tarih gir");
  assert(day <= trDayOf(now), "Deneme tarihi bugünden ileri olamaz");
  let cleanName = null;
  if (name != null && name !== "") {
    assert(typeof name === "string", "Geçersiz deneme adı");
    cleanName = name.trim() || null;
    assert(!cleanName || cleanName.length <= PRACTICE_EXAM_NAME_MAX, `Deneme adı en fazla ${PRACTICE_EXAM_NAME_MAX} karakter olabilir`);
  }
  const layout = PRACTICE_EXAM_LAYOUT[examType];
  assert(Array.isArray(results) && results.length > 0 && results.length <= layout.length, "Ders sonuçlarını gir");
  const seen = new Set();
  const out = [];
  for (const r of results) {
    assert(r && typeof r === "object" && typeof r.subject === "string", "Geçersiz ders sonucu");
    const max = practiceExamMax(examType, r.subject);
    assert(max != null, `${examType} denemesinde olmayan bir ders girilmiş`);
    assert(!seen.has(r.subject), "Aynı ders iki kez girilmiş");
    seen.add(r.subject);
    const [c, w, b] = [r.correct, r.wrong, r.blank].map((n) => (n == null ? 0 : n));
    assert([c, w, b].every((n) => Number.isInteger(n) && n >= 0), "Doğru/yanlış/boş sayıları 0 ya da daha büyük birer tam sayı olmalı");
    assert(c + w + b <= max, `${r.subject} dersinde en fazla ${max} soru var (girilen ${c + w + b})`);
    if (c + w + b === 0) continue;
    out.push({ subject: r.subject, correct: c, wrong: w, blank: b });
  }
  assert(out.length > 0, "En az bir dersin sonucunu gir");
  out.sort((a, b) => ORDER[examType].get(a.subject) - ORDER[examType].get(b.subject));
  return { examType, date: day, name: cleanName, results: out };
}

// Yanıt biçimi (liste, tekil, full-report aynı). byStudent: kaydı öğrencinin kendisi mi girdi. canEdit görüntüleyene
// göre: öğrenci yalnızca KENDİ girdiğini, koç (çağıran rota koçun kendi öğrencisi olduğunu doğrulamıştır) hepsini
// düzenleyebilir; admin yalnızca okur. Giren kişinin kimliği/adı dönmez — öğrenciye koçun hesap kimliği gerekmez.
export function serializePracticeExam(e, { role, userId } = {}) {
  const byStudent = !!e.createdById && e.createdById === e.studentId;
  const order = ORDER[e.examType];
  const results = [...(e.results || [])]
    .sort((a, b) => (order?.get(a.subject) ?? 99) - (order?.get(b.subject) ?? 99))
    .map((r) => ({ subject: r.subject, correct: r.correct, wrong: r.wrong, blank: r.blank }));
  return {
    id: e.id,
    examType: e.examType,
    date: e.date,
    name: e.name ?? null,
    byStudent,
    canEdit: role === "TEACHER" || (role === "STUDENT" && byStudent && e.studentId === userId),
    createdAt: e.createdAt,
    results,
  };
}

// Denemenin toplam neti (D − Y/4) ve soru sayısı — aylık özet için.
export function practiceExamTotals(results) {
  let c = 0, w = 0, b = 0;
  for (const r of results || []) { c += r.correct; w += r.wrong; b += r.blank; }
  return { correct: c, wrong: w, blank: b, net: c - w / 4 };
}
