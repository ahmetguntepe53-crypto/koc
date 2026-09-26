// Deneme sınavları (TYT/AYT) — istemci tarafı: resmî ders/soru düzeni, net hesabı, formun alan ön seçimi ve rapor
// modelinin "Denemeler" bölümü (buildDenemeler; reportModel.js > buildReport çağırır, ekran ve PDF aynı sonucu kullanır).
// Düzen server/src/practiceExams.js > PRACTICE_EXAM_LAYOUT ile İÇERİK olarak aynı tutulmalı (iki ayrı paket): form
// sınırları adım adım uygular, sunucu yine de her sınırı kendisi doğrular.
// Bu dosya yalnızca studentField.js'i içe aktarır — rapor modeli Node'da (sunucu testlerinde) de çalışır; subjects.js'teki
// SVG ikonları buraya girmemeli.
//
// Deneme neti GERÇEK sınav netidir (Net = D − Y/4, ders başına resmî soru sayısıyla sınırlı) — ödevlerin net oranıyla
// karıştırılmaz: ekranda "TYT 78,5 net" gibi net olarak gösterilir. Puan, sıralama ya da "tahmini net" üretilmez.
import { FIELD_AYT, isField } from "./studentField.js";

// ÖSYM kitapçık sırası ve soru sayıları. TYT 120: Türkçe 40 · Sosyal Bilimler 20 · Temel Matematik 40 · Fen 20.
// AYT 160: Edebiyat–Sosyal Bilimler-1 40 · Sosyal Bilimler-2 40 · Matematik 40 · Fen Bilimleri 40.
// AYT Felsefe Grubu (Felsefe + Mantık + Psikoloji + Sosyoloji) kitapçıkta tek 12 soruluk blok → "Felsefe" adıyla TEK
// ders (ödev listesindeki Mantık/Psikoloji/Sosyoloji ayrımı denemede yok); ekranda "Felsefe Grubu" yazılır.
const L = (subject, max, group) => ({ subject, max, group });
export const DENEME_LAYOUT = {
  TYT: [
    L("Türkçe", 40, "Türkçe"),
    L("Tarih", 5, "Sosyal Bilimler"), L("Coğrafya", 5, "Sosyal Bilimler"), L("Felsefe", 5, "Sosyal Bilimler"), L("Din Kültürü ve Ahlak Bilgisi", 5, "Sosyal Bilimler"),
    L("Matematik", 30, "Temel Matematik"), L("Geometri", 10, "Temel Matematik"),
    L("Fizik", 7, "Fen Bilimleri"), L("Kimya", 7, "Fen Bilimleri"), L("Biyoloji", 6, "Fen Bilimleri"),
  ],
  AYT: [
    L("Edebiyat", 24, "Edebiyat–Sosyal Bilimler-1"), L("Tarih-1", 10, "Edebiyat–Sosyal Bilimler-1"), L("Coğrafya-1", 6, "Edebiyat–Sosyal Bilimler-1"),
    L("Tarih-2", 11, "Sosyal Bilimler-2"), L("Coğrafya-2", 11, "Sosyal Bilimler-2"), L("Felsefe", 12, "Sosyal Bilimler-2"), L("Din Kültürü ve Ahlak Bilgisi", 6, "Sosyal Bilimler-2"),
    L("Matematik", 30, "Matematik"), L("Geometri", 10, "Matematik"),
    L("Fizik", 14, "Fen Bilimleri"), L("Kimya", 13, "Fen Bilimleri"), L("Biyoloji", 13, "Fen Bilimleri"),
  ],
};
export const DENEME_EXAMS = ["TYT", "AYT"];
export const DENEME_TOTAL = { TYT: 120, AYT: 160 };
const ORDER = Object.fromEntries(DENEME_EXAMS.map((e) => [e, new Map(DENEME_LAYOUT[e].map((x, i) => [x.subject, i]))]));

export function denemeMax(examType, subject) {
  return DENEME_LAYOUT[examType]?.find((x) => x.subject === subject)?.max ?? null;
}
// Ekrandaki ders adı: AYT Felsefe → "Felsefe Grubu"; short: tablolarda "Din Kültürü".
export function denemeLabel(examType, subject, { short = false } = {}) {
  if (examType === "AYT" && subject === "Felsefe") return "Felsefe Grubu";
  if (short && subject === "Din Kültürü ve Ahlak Bilgisi") return "Din Kültürü";
  return subject;
}
export const denemeNet = (D, Y) => D - Y / 4;

// Formun AYT ön seçimi: öğrencinin alanının AYT dersleri (Mantık/Psikoloji/Sosyoloji → Felsefe Grubu). Alan bilinmiyorsa
// ya da DİL ise (AYT yerine YDT; yine de girmek isteyebilir) bütün AYT dersleri — öğrenci girmediklerini boş bırakır.
export function aytSubjectsForField(field) {
  const all = DENEME_LAYOUT.AYT.map((x) => x.subject);
  if (!isField(field) || !FIELD_AYT[field].length) return all;
  const want = new Set(FIELD_AYT[field].map((s) => (["Mantık", "Psikoloji", "Sosyoloji"].includes(s) ? "Felsefe" : s)));
  return all.filter((s) => want.has(s));
}

// ---------------------------------------------------------------- rapor modeli
const DAY = 864e5;
const TR_OFFSET = 3 * 3600e3;
const dayOf = (d) => Math.floor((new Date(d).getTime() + TR_OFFSET) / DAY); // reportModel.js > trDay ile aynı
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

// Sunucu kaydı (full-report > practiceExams) → model denemesi. Bilinmeyen ders (düzen dışı) ve boş satır atlanır.
function toExam(e) {
  const subjects = (e.results || [])
    .filter((r) => ORDER[e.examType]?.has(r.subject))
    .map((r) => {
      const D = r.correct || 0, Y = r.wrong || 0, B = r.blank || 0;
      const max = denemeMax(e.examType, r.subject);
      return { subject: r.subject, label: denemeLabel(e.examType, r.subject), max, D, Y, B, Q: D + Y + B, net: denemeNet(D, Y) };
    })
    .filter((s) => s.Q > 0)
    .sort((a, b) => ORDER[e.examType].get(a.subject) - ORDER[e.examType].get(b.subject));
  const sum = (k) => subjects.reduce((s, x) => s + x[k], 0);
  return {
    id: e.id, examType: e.examType, date: e.date, day: dayOf(e.date), name: e.name || null,
    byStudent: !!e.byStudent, canEdit: !!e.canEdit, createdAt: e.createdAt || null,
    subjects, D: sum("D"), Y: sum("Y"), B: sum("B"), Q: sum("Q"), max: sum("max"), net: denemeNet(sum("D"), sum("Y")),
  };
}

// Seri eğilimi: son 2 denemenin ortalaması ile ondan önceki en fazla 3 denemenin ortalaması. En az 3 deneme gerekir;
// eşik: toplam nette 3 net, derste dersin sorusunun %5'i (en az 1 net). Tek denemelik sıçrama "yükseliş" sayılmaz.
function seriesTrend(vals, thr) {
  if (vals.length < 3) return { enough: false, dir: null, delta: null };
  const delta = mean(vals.slice(-2)) - mean(vals.slice(-5, -2));
  return { enough: true, dir: delta >= thr ? "up" : delta <= -thr ? "down" : "flat", delta };
}
export const TOTAL_TREND_NET = 3;
const subjectThr = (max) => Math.max(1, 0.05 * max);

function statsFor(examType, history, inWin) {
  const list = history.filter(inWin);
  const last = list.length ? list[list.length - 1] : null;
  const lastIdx = last ? history.indexOf(last) : -1;
  const upTo = lastIdx >= 0 ? history.slice(0, lastIdx + 1) : [];
  const prev = lastIdx > 0 ? history[lastIdx - 1] : null;
  const best = list.length ? list.reduce((a, b) => (b.net >= a.net ? b : a)) : null;
  const last3 = list.slice(-3);
  // Kişisel rekor: pencerenin son denemesi, o güne kadarki (en az 3) denemenin hepsinden yüksek.
  const earlier = upTo.slice(0, -1);
  const record = last && upTo.length >= 3 && earlier.every((e) => last.net > e.net)
    ? { net: last.net, prevBest: Math.max(...earlier.map((e) => e.net)), count: upTo.length } : null;
  // Belirgin yükseliş: son denemeyle biten üç denemede (tarih sırasıyla) her adım düşmeden (−0,5 nete kadar tolerans)
  // toplam en az 4 net artış.
  const tail = upTo.slice(-3);
  const rise = tail.length === 3 && tail[1].net - tail[0].net >= -0.5 && tail[2].net - tail[1].net >= -0.5 && tail[2].net - tail[0].net >= 4
    ? { from: tail[0], to: tail[2], delta: tail[2].net - tail[0].net, values: tail.map((e) => e.net) } : null;

  // Ders ders (penceredeki denemeler): son / ortalama / en iyi net ve soruya göre kaçan net.
  const bySubject = [];
  for (const { subject, max } of DENEME_LAYOUT[examType]) {
    const rows = list.map((e) => e.subjects.find((s) => s.subject === subject)).filter(Boolean);
    if (!rows.length) continue;
    const nets = rows.map((r) => r.net);
    const avgNet = mean(nets);
    bySubject.push({
      subject, label: denemeLabel(examType, subject), shortLabel: denemeLabel(examType, subject, { short: true }), key: `${examType}|${subject}`,
      max, n: rows.length, lastNet: nets[nets.length - 1], avgNet, bestNet: Math.max(...nets), avgLost: max - avgNet,
      trend: seriesTrend(nets, subjectThr(max)),
    });
  }

  // En çok net kaçan ders: son (en fazla) 3 denemede, dersin soru sayısına göre ortalama kaçan net (soru − net) en
  // büyük olan. En az 2 denemede girilmiş olmalı (tek denemelik sonuç kanıt sayılmaz). Kaçan net = yanlıştan 1,25·Y +
  // boştan (B + girilmeyen soru) — "hangi derste kaç net kaybediyorsun" sorusunun cevabı.
  let lossTop = null;
  for (const { subject, max } of DENEME_LAYOUT[examType]) {
    const rows = last3.map((e) => e.subjects.find((s) => s.subject === subject)).filter(Boolean);
    if (rows.length < 2) continue;
    const avgNet = mean(rows.map((r) => r.net));
    const lost = max - avgNet;
    const wrongPart = mean(rows.map((r) => 1.25 * r.Y));
    const cand = {
      subject, label: denemeLabel(examType, subject), key: `${examType}|${subject}`, max, n: rows.length, avgNet, avgLost: lost,
      lastNet: rows[rows.length - 1].net, wrongLost: wrongPart, blankLost: lost - wrongPart,
      wrongShare: lost > 0 ? (wrongPart / lost) * 100 : 0,
    };
    if (lost > 0 && (!lossTop || lost > lossTop.avgLost + 1e-9 || (Math.abs(lost - lossTop.avgLost) <= 1e-9 && max > lossTop.max))) lossTop = cand;
  }

  return {
    examType, history, list, n: list.length, last, prev,
    deltaVsPrev: last && prev ? last.net - prev.net : null,
    best, avgLast3: last3.length ? mean(last3.map((e) => e.net)) : null, avgCount: last3.length,
    trend: seriesTrend(list.map((e) => e.net), TOTAL_TREND_NET),
    record, rise, bySubject, lossTop,
    // Grafik ölçeği: kitapçık toplamı (TYT 120) ya da AYT'de girilen derslerin en geniş toplamı.
    scaleMax: examType === "TYT" ? DENEME_TOTAL.TYT : Math.max(10, ...history.map((e) => e.max)),
  };
}

// raw.practiceExams → { TYT, AYT, all, count, latestType }. İstatistikler (son, en iyi, ortalamalar, ders tablosu, kaçan
// net) seçili pencerenin [start, end] denemelerinden; history (trend grafiği) asOf'a kadarki TÜM denemeler — geçmiş bir ay
// raporunda sonraki denemeler görünmez. Eski sunucu yanıtında alan yoksa boş.
export function buildDenemeler(raw, { start = -Infinity, end = Infinity, asOf = Infinity } = {}) {
  const exams = (Array.isArray(raw) ? raw : [])
    .filter((e) => DENEME_EXAMS.includes(e.examType))
    .map(toExam)
    .filter((e) => e.subjects.length && e.day <= asOf)
    .sort((a, b) => a.day - b.day || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  const inWin = (e) => e.day >= start && e.day <= end;
  const out = {};
  for (const ex of DENEME_EXAMS) out[ex] = statsFor(ex, exams.filter((e) => e.examType === ex), inWin);
  const latest = exams[exams.length - 1];
  out.all = exams.length;
  out.count = out.TYT.n + out.AYT.n;
  out.latestType = latest ? latest.examType : "TYT";
  return out;
}
