// Gelişim raporu modeli — ekran (ReportScreen), PDF (reportPdf.js) ve testler AYNI saf fonksiyonu kullanır:
// buildReport(sunucu yanıtı, { window, now }) → rapor modeli. Hiçbir yan etkisi yok, hiçbir şey saklamaz.
// Şartname: rapor tasarım çalışması (2026-09-26). Özet kurallar:
//  • Ders anahtarı (examType, subject). Kayıt = teslim edilmiş ödev (tarih completedAt) ya da serbest çalışma (studyDate).
//  • Net = D − Y/4. Kayıt net oranı r = Net/Q. Net oranı NO = Σw·r / Σw, w = min(Q, 40) — tek bir 200 soruluk set
//    dersi belirleyemesin. Etiket ve sıralama küçültülmüş oranla (adjNO), ekranda her zaman ham NO.
//  • Tüm gün/hafta sınırları Türkiye saati (UTC+3); hafta Pazartesi–Pazar.
//  • Asgari örneklemin altında etiket/öneri üretilmez ("Veri az").
//  • Ödev neti deneme neti değildir; puan, sıralama ya da "tahmini net" hiçbir yerde üretilmez.
import { TOPICS_BY_EXAM } from "./topics.js";

export const DAY = 24 * 60 * 60 * 1000;
const TR_OFFSET = 3 * 60 * 60 * 1000;
const EXAMS = ["TYT", "AYT"];
const TYT_SUBJECTS = ["Türkçe", "Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"];

// YKS test soru sayıları — YALNIZCA öncelik sıralamasında kullanılır, "tahmini net" olarak hiçbir yerde gösterilmez.
// AYT Felsefe grubunun 12 sorusu uygulamada dört ayrı derse bölündüğü için her birine 3 düşer.
const YKS_Q = {
  TYT: { Türkçe: 40, Matematik: 30, Geometri: 10, Fizik: 7, Kimya: 7, Biyoloji: 6, Tarih: 5, Coğrafya: 5, Felsefe: 5, "Din Kültürü ve Ahlak Bilgisi": 5 },
  AYT: {
    Matematik: 30, Geometri: 10, Edebiyat: 24, Fizik: 14, Kimya: 13, Biyoloji: 13, "Tarih-1": 10, "Coğrafya-1": 6, "Tarih-2": 11,
    "Coğrafya-2": 11, Felsefe: 3, Mantık: 3, Psikoloji: 3, Sosyoloji: 3, "Din Kültürü ve Ahlak Bilgisi": 6,
  },
};
export const yksWeight = (examType, subject) => YKS_Q[examType]?.[subject] ?? 5;

// ---------------------------------------------------------------- zaman (TR günü = UTC+3 takvim günü)
export const trDay = (d) => Math.floor((new Date(d).getTime() + TR_OFFSET) / DAY);
export const dayDate = (day) => new Date(day * DAY); // o TR gününün UTC gece yarısı (yalnızca tarih alanları okunur)
export const weekOf = (day) => Math.floor((day + 3) / 7); // 1970-01-01 Perşembe → Pazartesi başlangıçlı hafta no
export const weekStart = (week) => week * 7 - 3;

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
export function fmtDay(day, { year = false, short = true } = {}) {
  const d = dayDate(day);
  const m = (short ? MONTHS_SHORT : MONTHS)[d.getUTCMonth()];
  return `${d.getUTCDate()} ${m}${year ? ` ${d.getUTCFullYear()}` : ""}`;
}
export function fmtRange(a, b) {
  const da = dayDate(a), db = dayDate(b);
  if (da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth()) {
    return `${da.getUTCDate()}–${db.getUTCDate()} ${MONTHS[db.getUTCMonth()]} ${db.getUTCFullYear()}`;
  }
  return `${fmtDay(a, { short: false, year: da.getUTCFullYear() !== db.getUTCFullYear() })} – ${fmtDay(b, { short: false, year: true })}`;
}
export function isoWeekNo(week) {
  const thu = dayDate(weekStart(week) + 3);
  const yearStart = Date.UTC(thu.getUTCFullYear(), 0, 1);
  return Math.floor((thu.getTime() - yearStart) / DAY / 7) + 1;
}

// ---------------------------------------------------------------- biçim (ondalık virgül, binlik nokta, yüzde önde)
const MINUS = "−";
export function fmtInt(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return Math.round(v).toLocaleString("tr-TR").replace("-", MINUS);
}
export function fmtDec(v, d = 1) {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", MINUS);
}
// Net gibi değerler: gereksiz sıfır yok (12,75 · 38 · 6,25).
export function fmtNet(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace("-", MINUS);
}
export function fmtPct(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const r = Math.round(v);
  return r < 0 ? `${MINUS}%${Math.abs(r)}` : `%${r}`;
}
export function fmtSigned(v, unit = "") {
  if (v == null || Number.isNaN(v)) return "—";
  const r = Math.round(v);
  return `${r > 0 ? "+" : r < 0 ? MINUS : ""}${Math.abs(r)}${unit}`;
}
// Yüzde değişimi: "+%18" / "−%12" (yüzde işareti önde).
export function fmtSignedPct(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const r = Math.round(v);
  return `${r > 0 ? "+" : r < 0 ? MINUS : ""}%${Math.abs(r)}`;
}
const round10 = (v) => Math.round(v / 10) * 10;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
export function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const firstSentence = (t) => {
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  return m ? m[1] : t;
};
const plural = (n, word) => `${fmtInt(n)} ${word}`;

// ---------------------------------------------------------------- konu anahtarı ve kanonik eşleşme
const FOLD = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
export function fold(s) {
  return String(s || "").toLocaleLowerCase("tr-TR").replace(/[çğıöşüâîû]/g, (c) => FOLD[c] || c)
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
const STOP = new Set(["ve", "ile", "de", "da", "bir", "icin", "test", "konu", "bolum", "unite", "osym", "tipi", "sorular", "soru", "tekrar"]);
const stem = (w) => w.slice(0, 6);
function stems(s) {
  return new Set(fold(s).split(" ").filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w)).map(stem));
}
// "1. Bölüm: Gerçek Sayılar - 1 (Temel Kavramlar)" → ana: "Gerçek Sayılar", baş: "Gerçek Sayılar", parantez: "Temel Kavramlar".
// "Sinir Sistemi: Nöron, İmpuls" → baş: "Sinir Sistemi".
export function topicParts(raw) {
  let s = String(raw || "");
  const parens = [];
  s = s.replace(/\(([^)]*)\)?/g, (_, x) => { parens.push(x); return " "; });
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^\d+\s*\.\s*(bölüm|bolum|ünite|unite)\s*[:\-–]?\s*/iu, "");
  s = s.replace(/\s*[-–]\s*\d+\s*$/u, "").trim();
  const head = s.split(":")[0].trim();
  return { main: s, head, paren: parens.join(" ").trim() };
}
// Sabit takma adlar (ör. "tek-çift" → Sayılar). Koçun düzenleyebildiği bir tablo ilk sürümde yok.
const ALIASES = [
  ["TYT", "Matematik", "tek cift", "Sayılar"], ["TYT", "Matematik", "ardisik", "Sayılar"], ["TYT", "Matematik", "asal", "Sayılar"],
  ["TYT", "Matematik", "faktoriyel", "Sayılar"], ["TYT", "Matematik", "gercek sayi", "Sayılar"], ["TYT", "Matematik", "ebob", "OBEB-OKEK"],
  ["TYT", "Matematik", "ekok", "OBEB-OKEK"], ["TYT", "Matematik", "yuzde", "Problemler"], ["TYT", "Matematik", "kar zarar", "Problemler"],
  ["TYT", "Matematik", "karisim", "Problemler"], ["TYT", "Matematik", "isci", "Problemler"], ["TYT", "Matematik", "havuz", "Problemler"],
  ["TYT", "Matematik", "yas problem", "Problemler"], ["TYT", "Matematik", "hareket problem", "Problemler"], ["TYT", "Matematik", "ikinci dereceden denklem", "2. Dereceden Denklemler"],
  ["TYT", "Matematik", "birinci dereceden", "Denklem Çözme"], ["TYT", "Türkçe", "paragraf", "Paragrafta Anlam"],
  ["AYT", "Matematik", "tek cift", "Temel Kavramlar"], ["AYT", "Matematik", "ardisik", "Temel Kavramlar"], ["AYT", "Matematik", "asal", "Temel Kavramlar"],
  ["AYT", "Matematik", "faktoriyel", "Temel Kavramlar"], ["AYT", "Matematik", "obeb", "EBOB-EKOK"], ["AYT", "Matematik", "okek", "EBOB-EKOK"],
  ["AYT", "Matematik", "ikinci dereceden denklem", "2. Dereceden Denklemler"], ["AYT", "Matematik", "ikinci dereceden esitsiz", "2. Dereceden Eşitsizlikler"],
  ["AYT", "Matematik", "permutasyon", "Permütasyon ve Kombinasyon"], ["AYT", "Matematik", "kombinasyon", "Permütasyon ve Kombinasyon"],
  ["AYT", "Matematik", "olasilik", "Binom ve Olasılık"], ["AYT", "Matematik", "binom", "Binom ve Olasılık"], ["AYT", "Matematik", "sureklilik", "Limit"],
  ["AYT", "Matematik", "turevin", "Türev"], ["AYT", "Matematik", "integralin", "İntegral"],
];
const canonCache = new Map();
function canonList(examType, subject) {
  const k = `${examType}|${subject}`;
  if (!canonCache.has(k)) {
    canonCache.set(k, (TOPICS_BY_EXAM[examType]?.[subject] || []).map((name) => ({ name, norm: fold(name), stems: stems(name) })));
  }
  return canonCache.get(k);
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}
const matchCache = new Map();
// → { key, name, approx, unmatched } — key kanonik adsa dersin müfredat listesindedir.
export function matchTopic(examType, subject, raw) {
  const ck = `${examType}|${subject}|${raw}`;
  if (matchCache.has(ck)) return matchCache.get(ck);
  const list = canonList(examType, subject);
  const { main, head, paren } = topicParts(raw);
  let res = null;
  for (const text of [head, main, paren]) {
    const t = fold(text);
    if (!t) continue;
    const exact = list.find((c) => c.norm === t);
    if (exact) { res = { key: exact.name, name: exact.name, approx: text !== head && text !== main, unmatched: false }; break; }
    const ts = stems(text);
    let best = null;
    for (const c of list) {
      if (!c.stems.size) continue;
      const contained = [...c.stems].every((x) => ts.has(x));
      const j = jaccard(ts, c.stems);
      if (!contained && j < 0.5) continue;
      const score = contained ? Math.max(j, 0.5) : j;
      if (!best || score > best.score || (score === best.score && c.stems.size > best.c.stems.size)) best = { c, score };
    }
    if (!best) {
      const alias = ALIASES.find(([e, s, frag, target]) => e === examType && s === subject && ` ${t} `.includes(` ${frag}`) && list.some((c) => c.name === target));
      if (alias) best = { c: list.find((c) => c.name === alias[3]), score: 0.5 };
    }
    if (best) { res = { key: best.c.name, name: best.c.name, approx: true, unmatched: false }; break; }
  }
  if (!res) {
    const title = (head || main || String(raw || "")).trim() || "Konu yok";
    res = { key: `~${fold(title)}`, name: title, approx: true, unmatched: true };
  }
  matchCache.set(ck, res);
  return res;
}

// ---------------------------------------------------------------- toplama
export function aggregate(recs) {
  let n = 0, Q = 0, D = 0, Y = 0, B = 0, sw = 0, swr = 0;
  const weeks = new Set();
  for (const r of recs) {
    n += 1; Q += r.Q; D += r.D; Y += r.Y; B += r.B;
    weeks.add(r.week);
    if (r.w) { sw += r.w; swr += r.w * r.r; }
  }
  const NO = sw ? swr / sw : null;
  let s2 = 0;
  if (sw) for (const r of recs) if (r.w) s2 += r.w * r.w * (r.r - NO) ** 2;
  return {
    n, Q, D, Y, B,
    net: D - Y / 4,
    NO, sw,
    SE: sw ? Math.max(4, Math.sqrt(s2) / sw) : null,
    weeks: weeks.size,
    accuracy: D + Y ? (D / (D + Y)) * 100 : null,
    blankRate: Q ? (B / Q) * 100 : null,
    wrongRate: Q ? (Y / Q) * 100 : null,
    lost: 1.25 * Y + B,
    lostWrong: 1.25 * Y,
    lostBlank: B,
    gotur: Y / 4,
  };
}
const enoughForLabel = (a) => a.n >= 3 && a.Q >= 60 && a.weeks >= 2;
const enoughForTrend = (a) => a.n >= 3 && a.Q >= 60;
const enoughForProfile = (a) => a.Q >= 60 && a.D + a.Y >= 30;

// ---------------------------------------------------------------- etiketler
export const LABELS = { strong: "Güçlü", ok: "Yolunda", focus: "Odak", few: "Veri az" };
const LEVEL = { focus: 0, ok: 1, strong: 2 };
const LEVEL_NAME = ["focus", "ok", "strong"];
export const PROFILES = {
  cautious: { name: "Temkinli", rx: "Boş kalan soruların konusuna dön; iki şıkka indirebildiğin soruyu işaretlemek ortalamada kazandırır." },
  gap: { name: "Konu eksiği", rx: "Boşların çoğu 'çözemedim' demek. En çok boş bıraktığın konuya konu anlatımıyla dön, sonra kolay sorularla başla." },
  wrong: { name: "Yanlış ağırlıklı", rx: "Yanlış yaptığın soruları çözümüne bakarak yeniden çöz; hata türünü yaz: bilgi / dikkat / işlem." },
  solid: { name: "Sağlam", rx: "İşaretlediğin sorular büyük ölçüde doğru ve az boş var. Zorluk seviyesini artırabilirsin." },
  balanced: { name: "Dengeli", rx: "Yanlış ve boş dengeli. Yanlış defteri tut ve boş kalan konuları haftalık tekrara ekle." },
};
function profileOf(a) {
  if (!enoughForProfile(a)) return null;
  const acc = a.D / (a.D + a.Y);
  const b = a.B / a.Q;
  if (b >= 0.2 && acc >= 0.75) return "cautious";
  if (b >= 0.2) return "gap";
  if (acc < 0.65) return "wrong";
  if (acc >= 0.8) return "solid";
  return "balanced";
}

// ---------------------------------------------------------------- pencere
export const WINDOWS = [
  { key: "4w", label: "4 hafta" },
  { key: "8w", label: "8 hafta" },
  { key: "all", label: "Tüm dönem" },
];
export function monthWindowKey(month) {
  return `month:${month}`;
}
function resolveWindow(key, today, firstDay) {
  if (key === "8w") return { key, label: "Son 8 hafta", start: today - 55, end: today, asOf: today, days: 56, prev: { start: today - 111, end: today - 56 }, rolling: true, short: false };
  if (key === "all") {
    const start = Math.min(firstDay ?? today, today);
    return { key, label: "Tüm dönem", start, end: today, asOf: today, days: today - start + 1, prev: null, rolling: true, short: false };
  }
  const m = /^month:(\d{4})-(\d{2})$/.exec(key || "");
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]) - 1;
    const start = Math.floor(Date.UTC(y, mo, 1) / DAY);
    const last = Math.floor(Date.UTC(y, mo + 1, 0) / DAY);
    const end = Math.max(Math.min(last, today), Math.min(start, today));
    const prevStart = Math.floor(Date.UTC(y, mo - 1, 1) / DAY);
    return {
      key, month: `${m[1]}-${m[2]}`, label: `${MONTHS[mo]} ${y}`, start: Math.min(start, end), end, asOf: end, days: end - Math.min(start, end) + 1,
      prev: { start: prevStart, end: start - 1 }, rolling: last >= today && start <= today, short: true, monthEnded: last < today,
    };
  }
  return { key: "4w", label: "Son 4 hafta", start: today - 27, end: today, asOf: today, days: 28, prev: { start: today - 55, end: today - 28 }, rolling: true, short: true };
}

// ---------------------------------------------------------------- ana fonksiyon
export function buildReport(raw, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const today = trDay(now);
  const viewer = raw.viewer === "coach" ? "coach" : "student";
  const student = raw.student || {};
  const grade12 = student.gradeLevel === 12;

  // --- ödevler (alıcı kayıtları)
  const items = (raw.items || []).filter((it) => EXAMS.includes(it.examType)).map((it) => {
    const endDay = trDay(it.endDate);
    const t = matchTopic(it.examType, it.subject, it.topic);
    const x = {
      ...it,
      key: `${it.examType}|${it.subject}`,
      name: `${it.examType} ${it.subject}`,
      endDay,
      endWeek: weekOf(endDay),
      schedDay: trDay(it.scheduledDate),
      doneDay: it.completedAt ? trDay(it.completedAt) : null,
      skipDay: it.skippedAt ? trDay(it.skippedAt) : null,
      topicKey: t.key, topicName: t.name, topicApprox: t.approx, topicUnmatched: t.unmatched,
      isSchool: it.source === "branch",
    };
    // Durumlar: onTime (bitiş günü içinde teslim) · fixed "pastan dönüş" (süresi içinde pas geçilmiş, sonra teslim —
    // teslim sayılır ama gecikme sayılmaz; bu bir düzeltmedir) · late · skip · silent · open.
    x.priorSkipDay = x.completed && it.priorSkippedAt ? trDay(it.priorSkippedAt) : null;
    x.state = x.completed
      ? (x.doneDay <= endDay ? "onTime" : x.priorSkipDay != null && x.priorSkipDay <= endDay ? "fixed" : "late")
      : x.skippedAt ? "skip" : endDay < today ? "silent" : "open";
    x.handled = x.state === "onTime" || x.state === "late" || x.state === "fixed" || x.state === "skip";
    return x;
  });

  // --- kayıtlar: teslim edilmiş ödev + serbest çalışma (çift sayım önlenir)
  const mk = (base) => {
    const Q = base.D + base.Y + base.B;
    const net = base.D - base.Y / 4;
    const day = trDay(base.date);
    const t = matchTopic(base.examType, base.subject, base.topic);
    return {
      ...base, Q, net, r: Q ? (net / Q) * 100 : null, w: Q ? Math.min(Q, 40) : 0, day, week: weekOf(day),
      key: `${base.examType}|${base.subject}`, name: `${base.examType} ${base.subject}`,
      topicKey: t.key, topicName: t.name, topicApprox: t.approx, topicUnmatched: t.unmatched,
    };
  };
  const hwRecords = items.filter((it) => it.completed && it.correct != null && it.completedAt).map((it) => mk({
    kind: it.isSchool ? "school" : "coach", date: it.completedAt, examType: it.examType, subject: it.subject, topic: it.topic,
    sourceBook: it.sourceBook, D: it.correct, Y: it.wrong, B: it.blank, questionNumbers: it.questionNumbers || [], item: it, expected: it.expected,
    note: it.note || null, photos: it.photos ?? null,
  }));
  const hwSig = new Set(hwRecords.map((r) => `${r.day}|${r.key}|${r.D}|${r.Y}|${r.B}`));
  const freeRecords = (raw.sessions || []).filter((s) => EXAMS.includes(s.examType)).map((s) => mk({
    kind: "free", date: s.date, examType: s.examType, subject: s.subject, topic: s.topic, sourceBook: s.sourceBook,
    D: s.correct, Y: s.wrong, B: s.blank, questionNumbers: s.questionNumbers || [], note: s.note || null, id: s.id,
  })).filter((r) => !hwSig.has(`${r.day}|${r.key}|${r.D}|${r.Y}|${r.B}`));
  const records = [...hwRecords, ...freeRecords].sort((a, b) => a.day - b.day || new Date(a.date) - new Date(b.date));

  const firstDay = Math.min(...records.map((r) => r.day), ...items.map((it) => Math.min(it.endDay, it.schedDay)), today);
  const win = resolveWindow(opts.window, today, Number.isFinite(firstDay) ? firstDay : today);
  const asOf = win.asOf;
  const inRange = (day, a, b) => day >= a && day <= b;
  const recsIn = (a, b, filter) => records.filter((r) => inRange(r.day, a, b) && (!filter || filter(r)));

  // --- takip edilen dersler: tüm TYT; AYT'de son 56 günde teslim, serbest çalışma ya da kişisel koç ödevi olan
  const tracked = new Set(TYT_SUBJECTS.map((s) => `TYT|${s}`));
  for (const r of recsIn(asOf - 55, asOf)) tracked.add(r.key);
  for (const it of items) if (!it.isSchool && (inRange(it.endDay, asOf - 55, asOf) || inRange(it.schedDay, asOf - 55, asOf))) tracked.add(it.key);
  const isTracked = (key) => tracked.has(key);

  // --- KONU pası çözüldü mü: sonrasında aynı konuda tamamlanmış ödev ya da ΣQ ≥ 10 serbest çalışma
  const resolvedAfter = (key, topicKey, fromDay, excludeId) => {
    if (items.some((o) => o.id !== excludeId && o.key === key && o.topicKey === topicKey && o.completed && o.doneDay >= fromDay)) return true;
    const q = records.filter((r) => r.key === key && r.topicKey === topicKey && r.day >= fromDay && r.kind === "free").reduce((s, r) => s + r.Q, 0);
    return q >= 10;
  };
  const topicCoveredAfter = (key, topicKey, fromDay) => records.filter((r) => r.key === key && r.topicKey === topicKey && r.day >= fromDay).reduce((s, r) => s + r.Q, 0) >= 10;
  const konuSkips = items.filter((it) => it.state === "skip" && it.skipReason === "KONU").map((it) => ({ ...it, resolved: resolvedAfter(it.key, it.topicKey, it.skipDay, it.id) }));

  // --- okul karşılaştırması yapılabilen teslimler (öğrencinin kendi yüzdeliği hesaplanmış)
  const comparable = hwRecords.filter((r) => r.kind === "school" && r.item.school && r.item.school.pct != null);

  // --- ders listesi
  const subjectKeys = new Set([...records.map((r) => r.key), ...items.map((it) => it.key)]);
  const allSubjects = [...subjectKeys].map((key) => {
    const [examType, subject] = key.split("|");
    return { key, examType, subject, name: `${examType} ${subject}`, weight: yksWeight(examType, subject), tracked: isTracked(key) };
  });

  // --- etiket hesabı: verilen aralığın sonuna göre (hafta hedefleri ve geçmiş haftalar için de aynı fonksiyon)
  function labelsAt(endDay, days, fallbackDays) {
    const out = new Map();
    const examAgg = {};
    for (const e of EXAMS) examAgg[e] = aggregate(recsIn(endDay - days + 1, endDay, (r) => r.examType === e));
    const examAggFb = {};
    if (fallbackDays) for (const e of EXAMS) examAggFb[e] = aggregate(recsIn(endDay - fallbackDays + 1, endDay, (r) => r.examType === e));
    for (const s of allSubjects) {
      let a = aggregate(recsIn(endDay - days + 1, endDay, (r) => r.key === s.key));
      let ex = examAgg[s.examType];
      let from8w = false;
      if (!enoughForLabel(a) && fallbackDays) {
        const b = aggregate(recsIn(endDay - fallbackDays + 1, endDay, (r) => r.key === s.key));
        if (enoughForLabel(b)) { a = b; ex = examAggFb[s.examType]; from8w = true; }
      }
      const comp = comparable.filter((r) => r.key === s.key && inRange(r.day, endDay - 55, endDay));
      const pcts = comp.map((r) => r.item.school.pct);
      const pTilde = pcts.length ? median(pcts) : null;
      const konu = konuSkips.filter((it) => it.key === s.key && !it.resolved && inRange(it.skipDay, endDay - 27, endDay));
      let label = "few", base = "few", adjNO = null, adjusted = 0;
      if (enoughForLabel(a)) {
        adjNO = (a.sw * a.NO + 40 * (ex.NO ?? a.NO)) / (a.sw + 40);
        base = adjNO >= 65 ? "strong" : adjNO < 40 ? "focus" : "ok";
        label = base;
        if (pcts.length >= 3) {
          if (label === "focus" && pTilde >= 60) { label = "ok"; adjusted = 1; }
          else if (label === "ok" && pTilde >= 75) { label = "strong"; adjusted = 1; }
          else if (label === "strong" && pTilde <= 40) { label = "ok"; adjusted = -1; }
          else if (label === "ok" && pTilde <= 25) { label = "focus"; adjusted = -1; }
        }
      }
      let fromKonu = false, konuBadge = false;
      if (konu.length >= 2) {
        if (label === "few" || label === "ok") { label = "focus"; fromKonu = true; }
        else if (label === "strong") konuBadge = true;
      }
      out.set(s.key, {
        agg: a, examNO: ex.NO, label, base, adjNO, adjusted, from8w, pTilde, compCount: pcts.length, comp, konuPass: konu.length, fromKonu, konuBadge,
        priority: label === "focus" ? s.weight * (65 - (adjNO ?? 40)) : null,
      });
    }
    return out;
  }

  const fallback = win.short ? 56 : null;
  // Ay penceresinde etiket tüm ayın verisiyle (karne tablosuyla aynı kayıtlar); kısa pencerede 8 hafta yedeği.
  const labelDays = win.key === "all" ? Math.max(1, asOf - win.start + 1) : win.key === "8w" ? 56 : win.month ? win.days : 28;
  const labelMap = labelsAt(asOf, labelDays, fallback);

  // --- trend (her zaman W1 = son 28 gün, W0 = önceki 28 gün)
  const W1 = [asOf - 27, asOf], W0 = [asOf - 55, asOf - 28];
  function trendOf(filter, compFilter) {
    const a1 = aggregate(recsIn(W1[0], W1[1], filter));
    const a0 = aggregate(recsIn(W0[0], W0[1], filter));
    if (!enoughForTrend(a1) || !enoughForTrend(a0)) return { enough: false, dir: null, n1: a1.n, n0: a0.n, q1: a1.Q, q0: a0.Q };
    const delta = a1.NO - a0.NO;
    const seD = Math.sqrt(a1.SE ** 2 + a0.SE ** 2);
    let dir = delta >= 5 && delta >= 1.28 * seD ? "up" : delta <= -5 && delta <= -1.96 * seD ? "down" : "flat";
    const c1 = comparable.filter((r) => compFilter(r) && inRange(r.day, W1[0], W1[1])).map((r) => r.item.school.median);
    const c0 = comparable.filter((r) => compFilter(r) && inRange(r.day, W0[0], W0[1])).map((r) => r.item.school.median);
    const hasSchool = c1.length >= 2 && c0.length >= 2;
    const ca = hasSchool ? mean(c0) : null, cb = hasSchool ? mean(c1) : null;
    const dS = hasSchool ? cb - ca : null;
    let note = null, coachNote = null, schoolAlsoUp = false, schoolAlsoDown = false, rawDir = dir;
    if (hasSchool && dir === "down" && dS <= delta + 5) { dir = "flat"; schoolAlsoDown = true; note = "konular zorlaştı, okul geneli de düştü"; }
    if (hasSchool && dir === "up" && dS >= delta - 5) { schoolAlsoUp = true; coachNote = "okul geneli de yükseldi"; }
    return { enough: true, dir, rawDir, delta, a: a0.NO, b: a1.NO, seD, hasSchool, ca, cb, dS, note, coachNote, schoolAlsoUp, schoolAlsoDown };
  }

  // --- haftalık seriler
  const curWeek = weekOf(today);
  const activeDaysSet = new Set(records.map((r) => r.day));
  const activeIn = (a, b) => { let n = 0; for (let d = a; d <= b; d++) if (activeDaysSet.has(d)) n += 1; return n; };
  const weekAgg = (week, filter) => aggregate(recsIn(weekStart(week), weekStart(week) + 6, filter));

  // --- ders ayrıntıları
  const W = (r) => inRange(r.day, win.start, win.end);
  const winRecords = records.filter(W);
  const subjects = allSubjects.map((s) => {
    const L = labelMap.get(s.key);
    const recs = winRecords.filter((r) => r.key === s.key);
    const a = aggregate(recs);
    const hw = aggregate(recs.filter((r) => r.kind !== "free"));
    const free = aggregate(recs.filter((r) => r.kind === "free"));
    const trend = trendOf((r) => r.key === s.key, (r) => r.key === s.key);
    const spark = [];
    for (let w = weekOf(asOf) - 7; w <= weekOf(asOf); w++) {
      const wa = weekAgg(w, (r) => r.key === s.key);
      spark.push({ week: w, NO: wa.Q >= 20 ? wa.NO : null, Q: wa.Q });
    }
    const subjRecsAll = records.filter((r) => r.key === s.key && r.day <= asOf);
    const lastDay = subjRecsAll.length ? subjRecsAll[subjRecsAll.length - 1].day : null;
    const silentItems = items.filter((it) => it.key === s.key && it.state === "silent");
    return {
      ...s, ...L, agg: a, labelAgg: L.agg, hw, free, freeShare: a.Q ? (free.Q / a.Q) * 100 : null,
      trend, spark, lastDay, daysSinceLast: lastDay != null ? asOf - lastDay : null,
      openOverdue: silentItems.length,
      profile: profileOf(a),
      records: recs,
    };
  });
  const subjectMap = new Map(subjects.map((s) => [s.key, s]));

  // Etiket gerekçeleri ve okul satırı.
  for (const s of subjects) {
    const L = s;
    const la = s.labelAgg;
    const gap = s.comp.length ? mean(s.comp.map((r) => r.item.school.median - r.r)) : null;
    s.gapToMedian = gap;
    s.participationAvg = s.comp.length ? mean(s.comp.map((r) => r.item.school.participation ?? 0)) : null;
    if (s.compCount >= 2) {
      const p = s.pTilde;
      s.schoolLine = {
        student: p >= 75 ? "Okul ödevlerinde üst çeyrek" : p >= 50 ? "Okul ödevlerinde üst yarı" : `Okul medyanına ${fmtInt(Math.max(0, gap ?? 0))} puan`,
        coach: `P̃ ${fmtInt(p)} · ${plural(s.compCount, "ödev")} · katılım ${fmtPct(s.participationAvg)}`,
      };
    } else s.schoolLine = null;
    const tail8 = L.from8w ? " (8 hf)" : "";
    if (L.label === "few" && !L.fromKonu) {
      const txt = `Veri az (${plural(la.n, "kayıt")} · ${plural(la.Q, "soru")}) — etiket için en az 3 kayıt, 60 soru ve 2 farklı hafta gerekiyor.`;
      s.reason = { student: txt, coach: txt };
    } else {
      const base = la.n ? `Net oranı ${fmtPct(la.NO)} · ${plural(la.n, "kayıt")} · ${plural(la.Q, "soru")}${tail8}` : "Kayıt yok";
      let coach = base, stud = base;
      if (L.adjusted === 1) {
        coach += ` · okul ödevlerinde medyan yüzdelik ${fmtInt(L.pTilde)} → ödevler herkese zor gelmiş, ${LABELS[L.label]}`;
        stud += ` · okul ödevlerinde ${L.pTilde >= 75 ? "üst çeyrek" : "üst yarı"} → ${LABELS[L.label]}`;
      } else if (L.adjusted === -1) {
        coach += ` · okul ödevlerinde medyan yüzdelik ${fmtInt(L.pTilde)} → aynı ödevlerde okul medyanının altında, ${LABELS[L.label]}`;
        stud += ` · aynı ödevlerde okul medyanına ${fmtInt(Math.max(0, gap ?? 0))} puan → ${LABELS[L.label]}`;
      } else if (L.fromKonu) {
        const t = ` · son 28 günde ${L.konuPass} konu pası ('konuyu bilmiyorum') → Odak`;
        coach += t; stud += `${t} (konu eksiği bildirdin)`;
      } else {
        coach += ` → ${LABELS[L.label]}`; stud += ` → ${LABELS[L.label]}`;
      }
      s.reason = { student: stud, coach };
    }
    s.notes = [];
    if (s.freeShare != null && s.freeShare > 70) s.notes.push({ text: "çoğu serbest çalışma", coachOnly: false });
    if (s.free.n >= 2 && s.hw.n >= 2 && s.free.NO - s.hw.NO >= 15) s.notes.push({ text: "serbest çalışma sonuçları ödevlerden belirgin yüksek", coachOnly: true });
    if (s.agg.n === 0 && s.openOverdue > 0) s.notes.push({ text: `Kayıt yok · ${plural(s.openOverdue, "ödev")} açık`, coachOnly: false });
    // Etiket geçişi: son 8 hafta sonu için aynı algoritma (28 gün), en son yükseliş.
    s.transition = null;
  }
  const weekEndLabels = [];
  for (let k = 7; k >= 0; k--) {
    const endDay = Math.min(weekStart(weekOf(asOf) - k) + 6, asOf);
    weekEndLabels.push(labelsAt(endDay, 28, null));
  }
  for (const s of subjects) {
    let prev = null;
    for (const m of weekEndLabels) {
      const l = m.get(s.key)?.label;
      if (!l || l === "few") continue;
      if (prev && LEVEL[l] > LEVEL[prev]) s.transition = { from: prev, to: l };
      if (prev && LEVEL[l] < LEVEL[prev]) s.transition = null;
      prev = l;
    }
    if (s.transition && s.label !== s.transition.to) s.transition = null;
  }

  // --- konu analizi (ders başına)
  function topicTable(recs, subjNO, openKeys) {
    const map = new Map();
    for (const r of recs) {
      const t = map.get(r.topicKey) || { key: r.topicKey, name: r.topicName, approx: r.topicApprox, unmatched: r.topicUnmatched, raws: new Set(), recs: [], books: new Set() };
      t.recs.push(r);
      t.raws.add(r.topic);
      if (r.sourceBook) t.books.add(r.sourceBook);
      map.set(r.topicKey, t);
    }
    return [...map.values()].map((t) => {
      const a = aggregate(t.recs);
      const rStar = a.sw ? (a.sw * a.NO + 20 * (subjNO ?? a.NO)) / (a.sw + 20) : null;
      const lastDay = Math.max(...t.recs.map((r) => r.day));
      let status = a.Q < 20 ? "few" : rStar >= 65 ? "solid" : rStar < 40 ? "review" : "growing";
      if (openKeys?.has(t.key)) status = "open";
      return {
        key: t.key, name: t.name, approx: t.approx, unmatched: t.unmatched, raws: [...t.raws], books: [...t.books],
        n: a.n, Q: a.Q, NO: a.NO, rStar, accuracy: a.accuracy, lastDay, daysSince: asOf - lastDay, status,
      };
    });
  }
  for (const s of subjects) {
    const openItems = items.filter((it) => it.key === s.key && (it.state === "skip" || it.state === "silent") && inRange(it.endDay, win.start, win.end)
      && !topicCoveredAfter(it.key, it.topicKey, it.state === "skip" ? it.skipDay : it.endDay));
    const openKeys = new Set(openItems.filter((it) => it.state === "skip" && it.skipReason === "KONU").map((it) => it.topicKey));
    s.topics = topicTable(s.records, s.agg.NO, openKeys).sort((x, y) => (x.rStar ?? 999) - (y.rStar ?? 999));
    const withData = s.topics.filter((t) => t.Q >= 20);
    const allTopics = topicTable(records.filter((r) => r.key === s.key && r.day <= asOf), aggregate(records.filter((r) => r.key === s.key && r.day <= asOf)).NO, null);
    const recordKeys = new Set(records.filter((r) => r.key === s.key).map((r) => r.topicKey));
    const schoolPast = items.filter((it) => it.key === s.key && it.isSchool && it.endDay < today);
    const schoolNoRecord = [];
    const seen = new Set();
    for (const it of [...schoolPast].reverse()) {
      if (recordKeys.has(it.topicKey) || seen.has(it.topicKey)) continue;
      seen.add(it.topicKey);
      schoolNoRecord.push({ key: it.topicKey, name: it.topicName, approx: it.topicApprox, endDay: it.endDay, teacher: it.teacher, itemId: it.id, state: it.state });
    }
    s.lists = {
      first: withData.filter((t) => t.rStar < 60).sort((x, y) => x.rStar - y.rStar).slice(0, 3),
      solid: withData.filter((t) => t.rStar >= 65).sort((x, y) => y.rStar - x.rStar).slice(0, 3),
      open: openItems.map((it) => ({ key: it.topicKey, name: it.topicName, approx: it.topicApprox, reason: it.skipReason, state: it.state, teacher: it.teacher, isSchool: it.isSchool, itemId: it.id, endDay: it.endDay, expected: it.expected })),
      schoolNoRecord,
      review: allTopics.filter((t) => t.Q >= 20 && t.rStar < 55 && t.daysSince >= 21 && t.daysSince <= 120).sort((x, y) => y.daysSince - x.daysSince),
    };
    s.allTopics = allTopics;
    s.schoolRows = comparable.filter((r) => r.key === s.key).slice(-8).reverse().map(schoolRow);
    s.reviewList = s.records.filter((r) => r.questionNumbers?.length).map((r) => ({ day: r.day, source: r.sourceBook || "Kaynak yok", topic: r.topicName, numbers: r.questionNumbers, D: r.D, Y: r.Y, B: r.B }));
  }
  function schoolRow(r) {
    const sc = r.item.school;
    return {
      day: r.day, name: r.name, subjectKey: r.key, topic: r.topicName, approx: r.topicApprox, mine: r.r, median: sc.median, q1: sc.q1, q3: sc.q3,
      n: sc.n, recipients: sc.recipients, participation: sc.participation, pct: sc.pct, scope: sc.scope, itemId: r.item.id,
      tone: r.r > sc.median ? "green" : r.r < sc.q1 ? "amber" : "neutral",
    };
  }

  // --- ödev düzeni
  // V pencereye endDate'e göre girer (şartname); süresi dolmamış ama erken teslim/pas geçilmiş ödev de sayılır.
  const inV = (it) => isTracked(it.key) && inRange(it.endDay, win.start, win.end) && (it.endDay < today || it.handled);
  const V = items.filter(inV);
  function disc(list) {
    const c = { V: list.length, onTime: 0, fixed: 0, late: 0, skip: 0, silent: 0 };
    for (const it of list) if (c[it.state] != null) c[it.state] += 1;
    c.delivered = c.onTime + c.fixed + c.late;
    c.deliveredPct = c.V ? (c.delivered / c.V) * 100 : null;
    c.handledPct = c.V ? ((c.delivered + c.skip) / c.V) * 100 : null;
    c.label = c.V < 5 ? null : c.handledPct >= 95 && (c.onTime / c.V) * 100 >= 75 ? "great" : c.handledPct >= 80 ? "good" : "needs";
    return c;
  }
  const DISC_LABEL = { great: "Çok düzenli", good: "İyi", needs: "Düzen gerekli" };
  const skipReasons = { KONU: 0, ZAMAN: 0, KAYNAK: 0, DIGER: 0 };
  for (const it of V) if (it.state === "skip" && skipReasons[it.skipReason] != null) skipReasons[it.skipReason] += 1;
  const vTotal = disc(V);
  const dominant = vTotal.skip && vTotal.V && vTotal.skip / vTotal.V >= 0.3 ? Object.entries(skipReasons).sort((a, b) => b[1] - a[1])[0][0] : null;
  const lateItems = V.filter((it) => it.state === "late");
  // Son gün oranı: pastan dönüşler hariç (dürüst pasın düzeltilmesi erteleme sayılmaz).
  const multiDay = V.filter((it) => it.completed && it.state !== "fixed" && it.schedDay < it.endDay);
  const lastDayCount = multiDay.filter((it) => it.doneDay >= it.endDay || (it.reminderAt && new Date(it.completedAt) > new Date(it.reminderAt))).length;
  const reminded = V.filter((it) => it.reminderAt);
  const heatStart = win.key === "all" ? Math.max(win.start, today - 7 * 26 + 1) : win.start;
  const heatmap = [];
  for (let d = weekStart(weekOf(heatStart)); d <= weekStart(weekOf(win.end)) + 6; d++) {
    heatmap.push({ day: d, Q: records.filter((r) => r.day === d).reduce((s2, r) => s2 + r.Q, 0), active: activeDaysSet.has(d), inWindow: d >= win.start && d <= win.end, future: d > today });
  }

  // Haftalık seri: vadesi gelen her ödev ele alınmış (sessiz yok) VE aktif gün ≥ 3. Vadesi gelen ödevi olmayan ve
  // 3 günden az aktif hafta nötrdür. İçinde bulunulan hafta koşulu sağlayınca eklenir, bitmeden seriyi kırmaz.
  const trackedItems = items.filter((it) => isTracked(it.key));
  const weekStatus = (w) => {
    const due = trackedItems.filter((it) => it.endWeek === w && (it.endDay < today || it.handled));
    const silent = due.filter((it) => it.state === "silent").length;
    const active = activeIn(weekStart(w), Math.min(weekStart(w) + 6, today));
    if (!trackedItems.some((it) => it.endWeek === w) && active < 3) return "neutral";
    if (silent === 0 && active >= 3) return "ok";
    return w === curWeek ? "pending" : "fail";
  };
  const startWeek = Math.max(weekOf(Number.isFinite(firstDay) ? firstDay : today), curWeek - 52);
  let streak = 0, longest = 0;
  for (let w = startWeek; w <= curWeek; w++) {
    const st = weekStatus(w);
    if (st === "ok") { streak += 1; longest = Math.max(longest, streak); }
    else if (st === "fail") streak = 0;
  }

  // --- haftalık hedefler (Pazartesi 00:00 TR'deki veriden)
  // G2 hedefi: önceki 3 tam haftanın ortalama sorusunun 1,2 katı, 10'a yuvarlanmış, 30–150; geçmiş yoksa 40.
  function g2Target(key, week) {
    const avg = mean([1, 2, 3].map((k) => weekAgg(week - k, (r) => r.key === key).Q));
    return avg > 0 ? clamp(round10(1.2 * avg), 30, 150) : 40;
  }
  function goalsFor(week) {
    const mon = weekStart(week), sun = mon + 6;
    // Hedef Pazartesi 00:00'daki veriden: hafta içinde sonradan gelen ödev hedefi büyütmez.
    const wItems = trackedItems.filter((it) => it.endWeek === week && it.schedDay <= mon);
    const goals = [];
    if (wItems.length) {
      const done = wItems.filter((it) => it.completed).length, skip = wItems.filter((it) => it.state === "skip").length;
      goals.push({ id: "G1", text: "Bu haftanın ödevlerini kapat", target: wItems.length, progress: done + skip, done, skip, met: done + skip >= wItems.length });
    } else {
      const qBefore = (it) => records.filter((r) => r.key === it.key && r.topicKey === it.topicKey && inRange(r.day, it.endDay, mon - 1)).reduce((q, r) => q + r.Q, 0);
      const cands = trackedItems.filter((it) => it.isSchool && !it.completed && it.endDay < mon && (it.state === "skip" || it.state === "silent") && qBefore(it) < 10);
      const closed = cands.some((it) => records.filter((r) => r.key === it.key && r.topicKey === it.topicKey && inRange(r.day, mon, sun)).reduce((q, r) => q + r.Q, 0) >= 10);
      if (cands.length) goals.push({ id: "G1", makeup: true, text: "Telafi listesinden 1 konu", target: 1, progress: closed ? 1 : 0, met: closed });
    }
    const L = labelsAt(mon - 1, 28, 56);
    const cand = allSubjects.filter((s) => isTracked(s.key)).map((s) => ({ s, l: L.get(s.key) })).filter((x) => x.l.label !== "few" || x.l.fromKonu);
    const focus = cand.filter((x) => x.l.label === "focus").sort((a, b) => b.l.priority - a.l.priority)[0]
      || cand.filter((x) => x.l.label === "ok").sort((a, b) => a.l.adjNO - b.l.adjNO)[0];
    if (focus) {
      const target = g2Target(focus.s.key, week);
      const progress = weekAgg(week, (r) => r.key === focus.s.key).Q;
      goals.push({ id: "G2", text: `${focus.s.name}: ${target} soru`, subjectKey: focus.s.key, subjectName: focus.s.name, target, progress, met: progress >= target });
    }
    const lastActive = activeIn(mon - 7, mon - 1);
    const t3 = clamp(lastActive + 1, 3, 6);
    const p3 = activeIn(mon, Math.min(sun, today));
    goals.push({ id: "G3", text: `Haftada ${t3} gün çalış`, target: t3, progress: p3, met: p3 >= t3 });
    return goals;
  }
  const curGoals = goalsFor(curWeek);

  // --- bu hafta
  const mon = weekStart(curWeek);
  const weekItems = trackedItems.filter((it) => it.endWeek === curWeek);
  const weekHandled = weekItems.filter((it) => it.handled).length;
  const weekQ = recsIn(mon, mon + 6).reduce((s2, r) => s2 + r.Q, 0);
  const weekDots = Array.from({ length: 7 }, (_, i) => ({ day: mon + i, active: activeDaysSet.has(mon + i), today: mon + i === today, future: mon + i > today }));
  const openThisWeek = weekItems.filter((it) => !it.handled).sort((a, b) => (a.expected ?? 999) - (b.expected ?? 999));
  const dow = (today - mon); // 0 = Pazartesi
  const lastWeekItems = trackedItems.filter((it) => it.endWeek === curWeek - 1);
  const lastWeekGoals = goalsFor(curWeek - 1);
  const lastWeekLine = dow <= 1
    ? `Geçen hafta: ${lastWeekItems.filter((it) => it.handled).length}/${lastWeekItems.length} ödev · ${fmtInt(weekAgg(curWeek - 1).Q)} soru · ${lastWeekGoals.filter((g) => g.met).length}/${lastWeekGoals.length} hedef`
    : null;

  // --- KPI'lar (seçili pencere)
  const exams = {};
  for (const e of EXAMS) {
    const a = aggregate(winRecords.filter((r) => r.examType === e));
    exams[e] = { agg: a, trend: trendOf((r) => r.examType === e, (r) => r.examType === e) };
  }
  const winQ = winRecords.reduce((s2, r) => s2 + r.Q, 0);
  const prevQ = win.prev ? recsIn(win.prev.start, win.prev.end).reduce((s2, r) => s2 + r.Q, 0) : null;
  const kpi = {
    questions: { Q: winQ, prevQ, pctDelta: prevQ ? ((winQ - prevQ) / prevQ) * 100 : null },
    delivery: vTotal,
    activeDays: { n: activeIn(win.start, win.end), of: win.end - win.start + 1 },
  };

  // --- net nereden kaçıyor
  const netLoss = subjects.filter((s) => isTracked(s.key) && s.agg.n > 0).map((s) => ({
    key: s.key, name: s.name, examType: s.examType, weight: s.weight, agg: s.agg, profile: s.profile,
  })).sort((a, b) => b.agg.lost - a.agg.lost);

  // --- kapsam ve telafi
  const yks = raw.yksExamDate ? trDay(raw.yksExamDate) : null;
  const daysToYks = yks != null && yks > today ? yks - today : null;
  const weeksLeft = daysToYks != null ? Math.ceil(daysToYks / 7) : null;
  const coverageRows = subjects.filter((s) => isTracked(s.key)).map((s) => {
    const past = items.filter((it) => it.key === s.key && it.isSchool && it.endDay < today);
    const planTopics = new Map();
    for (const it of past) {
      const covered = it.completed || topicCoveredAfter(it.key, it.topicKey, it.schedDay);
      const prev = planTopics.get(it.topicKey);
      planTopics.set(it.topicKey, { name: it.topicName, covered: (prev?.covered || false) || covered });
    }
    const planDone = [...planTopics.values()].filter((t) => t.covered).length;
    const canon = canonList(s.examType, s.subject);
    const studiedQ = new Map();
    for (const r of records.filter((r) => r.key === s.key)) studiedQ.set(r.topicKey, (studiedQ.get(r.topicKey) || 0) + r.Q);
    const taughtKeys = new Set(past.map((it) => it.topicKey));
    const canonical = canon.map((c) => ({ name: c.name, state: (studiedQ.get(c.name) || 0) >= 10 ? "studied" : taughtKeys.has(c.name) ? "taught" : "notYet" }));
    const studied = canonical.filter((c) => c.state === "studied").length;
    const U = canon.length - studied;
    return {
      key: s.key, name: s.name, weight: s.weight,
      planDone, planTotal: planTopics.size, planPct: planTopics.size ? (planDone / planTopics.size) * 100 : null,
      curriculum: canon.length ? { done: studied, total: canon.length } : null,
      canonical, U, tempo: weeksLeft != null && canon.length ? U / Math.max(weeksLeft - 8, 1) : null,
    };
  }).filter((c) => c.planTotal > 0 || (c.curriculum && c.curriculum.done > 0));
  const makeup = items.filter((it) => isTracked(it.key) && it.isSchool && !it.completed && (it.state === "skip" || it.state === "silent")
    && !topicCoveredAfter(it.key, it.topicKey, it.state === "skip" ? it.skipDay : it.endDay))
    .map((it) => ({ itemId: it.id, name: it.name, subjectKey: it.key, topic: it.topicName, approx: it.topicApprox, endDay: it.endDay, state: it.state, reason: it.skipReason, expected: it.expected, canSubmit: today - it.endDay <= 30 }));
  makeup.sort((a, b) => yksWeight(...b.subjectKey.split("|")) - yksWeight(...a.subjectKey.split("|")) || a.endDay - b.endDay);
  const q28 = { TYT: 0, AYT: 0 };
  for (const r of recsIn(asOf - 27, asOf)) q28[r.examType] += r.Q;
  const qSum = q28.TYT + q28.AYT;
  const smallSide = q28.TYT <= q28.AYT ? "TYT" : "AYT";
  const share = {
    tyt: qSum ? (q28.TYT / qSum) * 100 : null, ayt: qSum ? (q28.AYT / qSum) * 100 : null, total: qSum, small: smallSide, smallQ: q28[smallSide],
    flag: grade12 && qSum >= 200 && (q28[smallSide] / qSum) * 100 < 25,
  };
  const unmatchedCount = winRecords.filter((r) => r.topicUnmatched).length;

  // --- koç göstergeleri
  // Geçmiş bir ay raporunda "bugün"e bağlı kurallar (son kayıt, sessiz ödev, durum) ay sonuna göre değerlendirilir.
  const ref = win.rolling ? today : asOf;
  const recsToRef = records.filter((r) => r.day <= ref);
  const lastRecordDay = recsToRef.length ? recsToRef[recsToRef.length - 1].day : null;
  const createdDay = student.createdAt ? trDay(student.createdAt) : firstDay;
  const k = ref - (lastRecordDay ?? createdDay);
  const g = win.rolling && student.lastSeenAt ? today - trDay(student.lastSeenAt) : null;
  const V28 = items.filter((it) => isTracked(it.key) && inRange(it.endDay, asOf - 27, asOf) && (it.endDay < today || it.handled));
  const d28 = disc(V28);
  const d28School = disc(V28.filter((it) => it.isSchool));
  const d28Coach = disc(V28.filter((it) => !it.isSchool));

  // ================================================================ öneri motoru
  const ctx = {
    today, asOf, ref, winRecords, items, records, subjects, subjectMap, konuSkips, comparable, tracked, grade12, weeksLeft, curWeek, goalsFor, g2Target,
    d28, d28School, d28Coach, k, g, createdDay, streak, share, isTracked, recsIn, weekAgg, V28, labelsAt, trendOf,
  };
  const recs = buildRecommendations(ctx);

  // --- etiket çipleri
  const labeled = subjects.filter((s) => isTracked(s.key) && (s.label !== "few"));
  const strongList = labeled.filter((s) => s.label === "strong").sort((a, b) => (b.pTilde ?? -1) - (a.pTilde ?? -1) || b.adjNO - a.adjNO);
  const enoughSubjects = subjects.filter((s) => isTracked(s.key) && s.adjNO != null).sort((a, b) => (b.pTilde ?? b.adjNO) - (a.pTilde ?? a.adjNO));
  const best = strongList.length ? strongList.slice(0, 2) : enoughSubjects.slice(0, 2);
  const focusList = labeled.filter((s) => s.label === "focus").sort((a, b) => b.priority - a.priority);

  // Öncelikli konular: Odak derslerin "Önce bunlar" konuları, öncelik sırasıyla.
  const priorityTopics = [];
  for (const s of focusList) for (const t of s.lists.first) if (priorityTopics.length < 3) priorityTopics.push({ ...t, subjectKey: s.key, subjectName: s.name, examType: s.examType, subject: s.subject });

  // Başlık cümlesi (öğrenci) — ilk uyan kural; öğrenciye olumsuz başlık hiç gösterilmez.
  const celebs = recs.all.filter((r) => r.type === "kutlama" && r.audience.student);
  let headline;
  if (weekItems.length && weekHandled === weekItems.length) headline = "Bu haftanın ödevlerini kapattın!";
  else if (streak >= 2) headline = `${streak} haftadır serin sürüyor`;
  else if (celebs.length) headline = celebs[0].title.student;
  else if (openThisWeek.length) {
    const f = openThisWeek[0];
    headline = `Bu hafta ${plural(openThisWeek.length, "ödevin")} kaldı; en kısası ${f.name}${f.expected ? ` (${f.expected} soru)` : ""}`;
  } else headline = "Bugün 20 soruluk bir setle başla";

  // --- koç paneli
  const silent14 = items.filter((it) => isTracked(it.key) && it.state === "silent" && inRange(it.endDay, ref - 14, ref - 1)).length;
  const reasons = [];
  if (silent14 >= 2) reasons.push(`${silent14} sessiz ödev (14 gün)`);
  if (k >= 7) reasons.push(`${k} gündür kayıt yok`);
  if (d28.V >= 5 && d28.handledPct < 50) reasons.push(`ele alınan ${fmtPct(d28.handledPct)}`);
  let status = reasons.length ? "intervene" : null;
  if (!status) {
    const hi = recs.coachAll.filter((r) => r.type !== "kutlama" && r.priority <= 2);
    if (hi.length) { status = "watch"; reasons.push(...hi.slice(0, 2).map((r) => r.short)); }
    else status = "ok";
  }
  const topCeleb = recs.coachAll.find((r) => r.type === "kutlama");
  const topBlock = recs.coachAll.find((r) => /^R0[1-6]/.test(r.id));
  const topFocus = focusList[0];
  const agenda = [
    topCeleb ? `Açılış: ${topCeleb.title.coach}` : `Açılış: ${d28.V ? `son 28 günde teslim ${fmtPct(d28.deliveredPct)}, ele alınan ${fmtPct(d28.handledPct)}` : "düzenli kayıt girişi için teşekkür edin"}`,
    topBlock ? `Engel: ${topBlock.title.coach}` : "Engel: belirgin bir engel yok — öğrenciye zorlandığı bir şey olup olmadığını sorun.",
    topFocus ? `Odak: ${topFocus.name}${topFocus.lists.first.length ? ` — ${topFocus.lists.first.slice(0, 2).map((t) => t.name).join(" · ")}` : ""}` : "Odak: odak ders yok — güçlü derslerde zorluğu artırmayı konuşun.",
  ];
  const withE = hwRecords.filter((r) => r.expected && inRange(r.day, win.start, win.end));
  const partial = withE.filter((r) => r.Q < 0.8 * r.expected).length;
  const over = withE.filter((r) => r.Q > 1.2 * r.expected).length;
  const winHw = hwRecords.filter((r) => inRange(r.day, win.start, win.end));
  const hwAgg = aggregate(winHw), freeAgg = aggregate(winRecords.filter((r) => r.kind === "free"));
  const photoRate = winHw.length && winHw[0].photos != null ? (winHw.filter((r) => r.photos > 0).length / winHw.length) * 100 : null;
  const untracked = allSubjects.filter((s) => !isTracked(s.key)).map((s) => ({ name: s.name, schoolItems: items.filter((it) => it.key === s.key && it.isSchool).length, records: records.filter((r) => r.key === s.key).length }));
  const freeGap = freeAgg.n >= 2 && hwAgg.n >= 2 ? freeAgg.NO - hwAgg.NO : null;
  const coach = {
    status, statusLabel: { intervene: "Müdahale", watch: "Takip et", ok: "Yolunda" }[status], reasons,
    lastSeenDays: g, lastRecordDays: lastRecordDay != null ? today - lastRecordDay : null,
    silent28: d28.silent, school: d28School, personal: d28Coach,
    afterReminder: { done: reminded.filter((it) => it.completed && new Date(it.completedAt) > new Date(it.reminderAt)).length, total: reminded.length },
    streak,
    agenda,
    personalLoad: d28School.V >= 4 && d28Coach.V >= 4 && d28Coach.deliveredPct <= d28School.deliveredPct - 20,
    notes: [
      ...items.filter((it) => it.note).map((it) => ({ day: it.doneDay, kind: "teslim", name: it.name, topic: it.topicName, text: it.note, itemId: it.id, assignmentId: it.assignmentId })),
      ...items.filter((it) => it.skipNote).map((it) => ({ day: it.skipDay, kind: "pas", name: it.name, topic: it.topicName, text: it.skipNote, itemId: it.id, assignmentId: it.assignmentId })),
    ].sort((a, b) => b.day - a.day).slice(0, 5),
    dataNotes: {
      photoRate, partialRate: withE.length ? (partial / withE.length) * 100 : null, overRate: withE.length ? (over / withE.length) * 100 : null,
      withE: withE.length, freeNO: freeAgg.n >= 2 ? freeAgg.NO : null, hwNO: hwAgg.n >= 2 ? hwAgg.NO : null, freeGap,
      unmatched: unmatchedCount, untracked,
      approx: (withE.length && ((partial + over) / withE.length) * 100 >= 30) || (freeGap != null && Math.abs(freeGap) >= 15),
    },
  };

  // --- ekler için tablolar
  const history = {};
  for (const e of EXAMS) {
    history[e] = items.filter((it) => it.examType === e && it.state !== "open").sort((a, b) => a.endDay - b.endDay).map((it) => {
      const Q = it.correct != null ? it.correct + it.wrong + it.blank : null;
      const net = it.correct != null ? it.correct - it.wrong / 4 : null;
      return { ...it, Q, net, r: Q ? (net / Q) * 100 : null };
    });
  }
  const inProgress = items.filter((it) => it.state === "open").sort((a, b) => a.endDay - b.endDay);

  const totalRecords = winRecords.length;
  return {
    viewer, student: { ...student, grade12 }, generatedAt: now, today, window: win, rangeText: fmtRange(win.start, win.end),
    daysToYks: grade12 ? daysToYks : null, weeksLeft: grade12 ? weeksLeft : null,
    totalRecords, enough: totalRecords >= 3, allRecordCount: records.length,
    exams, kpi, subjects, subjectMap, tracked,
    chips: { strongTitle: strongList.length ? "Güçlü yanların" : "En iyi gidenler", strong: best, focus: focusList.slice(0, 2), focusAll: focusList },
    week: {
      week: curWeek, isoNo: isoWeekNo(curWeek), items: weekItems, handled: weekHandled, done: weekItems.filter((it) => it.completed).length, skip: weekItems.filter((it) => it.state === "skip").length,
      Q: weekQ, dots: weekDots, activeDays: weekDots.filter((d) => d.active).length, goals: curGoals, headline, lastWeekLine, open: openThisWeek,
      allGoalsMet: curGoals.length > 0 && curGoals.every((x) => x.met),
    },
    discipline: {
      total: vTotal, school: disc(V.filter((it) => it.isSchool)), personal: disc(V.filter((it) => !it.isSchool)), label: vTotal.label ? DISC_LABEL[vTotal.label] : null, labelKey: vTotal.label,
      bySubject: subjects.filter((s) => isTracked(s.key)).map((s) => ({ key: s.key, name: s.name, ...disc(V.filter((it) => it.key === s.key)) })).filter((x) => x.V > 0),
      skipReasons, dominant,
      avgDelay: lateItems.length ? mean(lateItems.map((it) => it.doneDay - it.endDay)) : null,
      lastDayRate: multiDay.length ? (lastDayCount / multiDay.length) * 100 : null, multiDay: multiDay.length,
      afterReminder: coach.afterReminder,
      active7: activeIn(today - 6, today), active28: activeIn(today - 27, today),
      heatmap, streak, longest,
      open: items.filter((it) => isTracked(it.key) && (it.state === "silent" || it.state === "open")).sort((a, b) => a.endDay - b.endDay)
        .map((it) => ({ ...it, overdueDays: it.state === "silent" ? today - it.endDay : 0, daysLeft: it.state === "open" ? it.endDay - today : 0 })),
      skips: V.filter((it) => it.state === "skip").sort((a, b) => b.skipDay - a.skipDay),
      weekly: Array.from({ length: 12 }, (_, i) => curWeek - 11 + i).filter((w) => w >= startWeek).map((w) => {
        const due = trackedItems.filter((it) => it.endWeek === w && (it.endDay < today || it.handled));
        const wa = weekAgg(w);
        const goals = goalsFor(w);
        return {
          week: w, isoNo: isoWeekNo(w), start: weekStart(w), handled: due.filter((it) => it.handled).length, total: due.length,
          skip: due.filter((it) => it.state === "skip").length, silent: due.filter((it) => it.state === "silent").length,
          active: activeIn(weekStart(w), Math.min(weekStart(w) + 6, today)), Q: wa.Q, NO: wa.Q >= 20 ? wa.NO : null,
          goalsMet: goals.filter((x) => x.met).length, goalsTotal: goals.length, status: weekStatus(w),
        };
      }),
    },
    trend: Object.fromEntries(EXAMS.map((e) => {
      const weeks = [];
      for (let w = weekOf(asOf) - 11; w <= weekOf(asOf); w++) {
        const wa = weekAgg(w, (r) => r.examType === e);
        weeks.push({ week: w, isoNo: isoWeekNo(w), start: weekStart(w), NO: wa.Q >= 20 ? wa.NO : null, Q: wa.Q, n: wa.n, active: activeIn(weekStart(w), Math.min(weekStart(w) + 6, today)) });
      }
      return [e, { weeks, filled: weeks.filter((x) => x.NO != null).length, trend: exams[e].trend }];
    })),
    subjectWeekly(key) {
      const out = [];
      for (let w = weekOf(asOf) - 11; w <= weekOf(asOf); w++) {
        const wa = weekAgg(w, (r) => r.key === key);
        const sc = comparable.filter((r) => r.key === key && r.week === w).map((r) => r.item.school.median);
        out.push({ week: w, isoNo: isoWeekNo(w), start: weekStart(w), NO: wa.Q >= 20 ? wa.NO : null, Q: wa.Q, n: wa.n, school: sc.length ? mean(sc) : null });
      }
      return out;
    },
    netLoss,
    coverage: { rows: coverageRows, makeup, share, weeksLeft: grade12 ? weeksLeft : null, unmatched: unmatchedCount },
    priorityTopics,
    recs,
    coach,
    achievements: recs.all.filter((r) => r.type === "kutlama").slice(0, 5),
    schoolRows: comparable.filter((r) => inRange(r.day, win.start, win.end)).reverse().map(schoolRow),
    history, inProgress,
    sessions: records.filter((r) => r.kind === "free" && inRange(r.day, win.start, win.end)).reverse(),
    reviewList: subjects.flatMap((s) => s.reviewList.map((x) => ({ ...x, subjectName: s.name }))),
  };
}

// ================================================================ öneriler
// Her öneri: id, tür, öncelik, ders, kanıt satırı, sahibi, öğrenci ve koç metni, eylem. Öneriler her açılışta veriden
// yeniden hesaplanır, hiçbir yerde saklanmaz. Öğrenci ekranı en fazla 3 kart (1 kutlama + 2), koç ekranı en fazla 6.
const TYPE = {
  R00: "veri", R01: "engel", R02: "engel", R03: "engel", R04: "engel", R05: "engel", R06: "engel", R07: "odak", R08: "odak", R09: "odak", R10: "odak",
  R11: "strateji", R12: "strateji", R13: "strateji", R14: "odak", R15: "alışkanlık", R16: "alışkanlık", R17: "veri", R18: "veri", R19: "odak", R20: "bakım", R21: "plan",
};
const PRIORITY = {
  R00: 1, R01: 1, R02: 1, R03: 1, R04: 1, R05: 1, R06: 2, R07: 2, R08: 2, R09: 2, R10: 2, R11: 3, R12: 3, R13: 3, R14: 3, R15: 3, R16: 3, R17: 4, R18: 4, R19: 4, R20: 4, R21: 4,
  K01: 2, K02: 2, K03: 2, K04: 3, K05: 3, K06: 3, K07: 4, K08: 4, K09: 5,
};
const R00_SUPPRESS = new Set(["R07", "R09", "R10", "R11", "R12", "R13", "R14", "R19", "R20", "K01", "K02", "K03", "K04", "K09"]);
const cut = (s, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const hoca = (t) => (t ? `${t} Hoca` : "branş öğretmeni");
const hocaYa = (t) => (t ? `${t} Hoca'ya` : "branş öğretmenine");

function buildRecommendations(c) {
  const out = [];
  const add = (id, o) => {
    const student = o.student ?? null, coach = o.coach ?? null;
    out.push({
      id, type: id.startsWith("K") ? "kutlama" : TYPE[id], priority: PRIORITY[id],
      subjectKey: o.subject?.key || null, subjectName: o.subject?.name || null, weight: o.subject?.weight ?? 0,
      topic: o.topic || null, evidence: o.evidence, evidenceStudent: o.evidenceStudent ?? o.evidence, evidenceCount: o.count ?? 1,
      owner: o.owner || "Koç", ownerName: o.ownerName || null,
      text: { student, coach }, title: { student: student ? firstSentence(student) : null, coach: coach ? firstSentence(coach) : null },
      short: o.short || (coach ? firstSentence(coach) : ""), audience: { student: o.forStudent !== false && !!student, coach: o.forCoach !== false && !!coach },
      action: o.action || null, section: o.section || null, meta: o.meta || null,
    });
  };
  const { today, asOf, ref, items, records, subjects, subjectMap, konuSkips, comparable, grade12, weeksLeft, d28, d28School, d28Coach, isTracked, recsIn } = c;
  const inR = (d, a, b) => d >= a && d <= b;
  const W1 = [asOf - 27, asOf];
  const winAll = recsIn(W1[0], W1[1]);
  const labeledEnough = subjects.filter((s) => s.adjNO != null);

  // R00 — veri az
  const eightWeek = c.labelsAt(asOf, 56, null);
  const anyEnough = [...eightWeek.values()].some((l) => l.label !== "few" && !l.fromKonu) || labeledEnough.length > 0;
  // R00 seçili pencerenin kayıtlarına bakar (rapordaki "toplam kayıt" ile aynı).
  const nRec = c.winRecords.length, qRec = c.winRecords.reduce((s, r) => s + r.Q, 0);
  const r00 = nRec < 3 || !anyEnough;
  if (r00) add("R00", {
    student: `Raporun oluşuyor. Şu an ${plural(nRec, "kaydın")} var. Ödev sonuçlarını doğru/yanlış/boş olarak girdikçe ve ödev dışında çözdüklerini Serbest Çalışma olarak ekledikçe güçlü yanların ve odak alanların burada belirecek.`,
    coach: `Öğrencinin bu dönemde ${plural(nRec, "kaydı")} (${plural(qRec, "soru")}) var. Ders etiketleri için ders başına en az 3 kayıt, 60 soru ve 2 farklı hafta gerekiyor. Şimdilik teslim ve pas göstergelerine bakın. Sonuç girişini ve Serbest Çalışma kaydını öğrenciyle birlikte bir kez yapın.`,
    evidence: `${plural(nRec, "kayıt")} · ${plural(qRec, "soru")}`, count: nRec, owner: "Öğrenci", action: { kind: "study" },
  });

  // R01 — gecikmiş (sessiz) ödev
  const overdue = items.filter((it) => isTracked(it.key) && it.state === "silent" && it.endDay < ref && ref - it.endDay <= 30)
    .sort((a, b) => (a.expected == null) - (b.expected == null) || (a.expected ?? 0) - (b.expected ?? 0) || a.endDay - b.endDay);
  let r01List = null;
  if (overdue.length) {
    const oldest = overdue.reduce((a, b) => (a.endDay <= b.endDay ? a : b));
    const fmtIt = (it) => `${it.name} – ${cut(it.topicName)}${it.expected ? ` (${it.expected} soru)` : ""}`;
    r01List = overdue.slice(0, 3).map(fmtIt).join("; ");
    add("R01", {
      student: `${plural(overdue.length, "ödevin")} süresi doldu ama hâlâ yapabilirsin. En kısasıyla başla: ${fmtIt(overdue[0])}. Çözdüysen sonucunu gir. Yapamayacaksan sebebini seçip pas geç. İkisi de koçunun sana doğru planı yapmasını sağlar.`,
      coach: `${plural(overdue.length, "ödev")} süresi geçtiği hâlde ne teslim edildi ne pas geçildi (en eskisi ${ref - oldest.endDay} gün önce, hatırlatma ${oldest.reminderAt ? "gönderildi" : "gönderilmedi"}): ${r01List}. Engeli doğrudan sorun; sessiz kalan ödev çoğu zaman bir zorlanma işaretidir. Gerekirse süreyi ya da yükü azaltın.`,
      evidence: `${plural(overdue.length, "ödev")} sessiz · en eskisi ${ref - oldest.endDay} gün önce`, count: overdue.length, owner: "Öğrenci",
      subject: subjectMap.get(overdue[0].key), topic: overdue[0].topicName,
      action: { kind: "submit", itemId: overdue[0].id, assignmentId: overdue[0].assignmentId }, section: "odev",
      short: `${plural(overdue.length, "sessiz ödev")}`,
    });
  }

  // R02 — sessizlik
  const accountAge = ref - c.createdDay;
  if (accountAge >= 7) {
    const openShort = items.filter((it) => !it.handled).sort((a, b) => (a.expected ?? 999) - (b.expected ?? 999))[0];
    const ilk = openShort ? `${openShort.name} – ${cut(openShort.topicName)}${openShort.expected ? ` (${openShort.expected} soru)` : ""}` : "20 soruluk kısa bir set";
    const due7 = items.some((it) => isTracked(it.key) && inR(it.endDay, ref - 7, ref - 1));
    const due5 = items.some((it) => isTracked(it.key) && inR(it.endDay, ref - 5, ref - 1));
    const coachTrig = (c.g != null && c.g >= 5) || (c.k >= 7 && due7);
    const studTrig = c.k >= 5 && due5;
    if (coachTrig || studTrig) add("R02", {
      student: `Tekrar hoş geldin! ${c.k} gündür kayıt görünmüyor. Çalıştıysan girmeyi unutma, girilmeyen çalışma raporuna yansımaz. Kaldığın yerden devam etmek için bugün tek bir adım yeter: ${ilk}.`,
      coach: `Öğrenci ${c.g != null ? `${c.g} gündür uygulamaya girmedi` : "uygulamaya son giriş bilgisi yok"}, ${c.k} gündür kayıt girmedi. Bu hafta birebir ulaşın (sağlık, motivasyon, okul yükü). Uygulamayı açmak çalışmak demek değildir; asıl ölçüt son kayıt tarihidir.`,
      evidence: `${c.k} gündür kayıt yok${c.g != null ? ` · son giriş ${c.g} gün önce` : ""}`, count: c.k, owner: "Koç",
      forStudent: studTrig, forCoach: coachTrig, action: openShort ? { kind: "submit", itemId: openShort.id, assignmentId: openShort.assignmentId } : { kind: "study" },
      short: `${c.k} gündür kayıt yok`,
    });
  }

  // R03 — konu pası (ders başına tek öneri)
  const r03Topics = new Set();
  const konu28 = konuSkips.filter((it) => !it.resolved && inR(it.skipDay, asOf - 27, asOf) && isTracked(it.key));
  for (const key of new Set(konu28.map((it) => it.key))) {
    const list = konu28.filter((it) => it.key === key).sort((a, b) => b.skipDay - a.skipDay);
    const s = subjectMap.get(key);
    const nAll = konuSkips.filter((it) => it.key === key && inR(it.skipDay, asOf - 27, asOf)).length;
    const topics = [...new Set(list.map((it) => it.topicName))];
    for (const it of list) r03Topics.add(`${key}|${it.topicKey}`);
    const konu = cut(topics.join("; "));
    const t = list[0].teacher;
    const kp = list.find((it) => it.isSchool && it.konuSkipRate != null)?.konuSkipRate;
    add("R03", {
      student: `${s.name} dersinde '${konu}' konusunu 'konuyu bilmiyorum' diye pas geçtin. Bunu söylemen çok iyi oldu, eksiği bulmanın ilk adımı bu. Önce konu anlatımına dön (ders notu, video ya da ${hocaYa(t)} soru). Sonra 10–15 kolay soruyla başla ve sonucunu Serbest Çalışma olarak gir.`,
      coach: `${s.name} dersinde '${konu}' konusu 'konuyu bilmiyorum' gerekçesiyle pas geçildi (bu derste son 28 günde ${nAll} kez). Konu anlatımı eksik. Ödevi veren ${t ? hoca(t) : "branş öğretmeni"} ile etüt ayarlayın ya da kısa bir konu tekrarının ardından kolaydan zora 20–30 soruluk kişisel ödev verin.${kp != null ? ` Bu ödevde okul genelinde KONU pası oranı %${kp}.${kp >= 30 ? " Konu sınıf genelinde eksik olabilir; branş öğretmenine iletin." : ""}` : ""}`,
      evidence: `28 günde ${nAll} pas · neden: konu`, count: nAll, owner: "Branş öğretmeni", ownerName: t, subject: s, topic: topics[0],
      action: { kind: "study", subjectKey: key, topic: topics[0] }, coachAction: { kind: "assign", subjectKey: key, topic: topics[0] }, section: "konu",
      short: `${s.name}: konu pası`,
    });
  }

  // R04 — kaynak pası (kaynak başına)
  const kaynak = items.filter((it) => it.state === "skip" && it.skipReason === "KAYNAK" && inR(it.skipDay, asOf - 55, asOf));
  const byBook = new Map();
  for (const it of kaynak) {
    const book = it.sourceBook || "";
    if (items.some((o) => (o.sourceBook || "") === book && book && o.completed && o.doneDay >= it.skipDay)) continue;
    const l = byBook.get(book) || [];
    l.push(it);
    byBook.set(book, l);
  }
  for (const [book, list] of byBook) {
    const s = subjectMap.get(list[0].key);
    const name = book || "ödevin kaynağı";
    add("R04", {
      student: `'${name}' kitabı elinde olmadığı için ${s.name} dersinde ${plural(list.length, "ödevi")} yapamadın. Bu senin eksiğin değil, çözülebilir bir engel. Koçuna yaz. Kitap gelene kadar aynı konudan başka bir kaynakla çalışıp Serbest Çalışma olarak girebilirsin.`,
      coach: `Kaynak engeli: öğrencide '${name}' yok (${s.name}, ${plural(list.length, "ödev")} pas). Kitap temini için okul yönetimine ya da ${hocaYa(list[0].teacher)} iletin. O zamana kadar öğrencinin elindeki bir kaynaktan kişisel ödev verin. Sorun giderilmezse bu kaynaktan gelen okul ödevlerinin tamamı kaçar.`,
      evidence: `${plural(list.length, "ödev")} pas · neden: kaynak`, count: list.length, owner: "Yönetim", subject: s, topic: name,
      short: `kaynak engeli (${cut(name, 24)})`,
    });
  }

  // R05 — düzen düşük
  const r05 = d28.V >= 5 && d28.handledPct < 70;
  if (r05) add("R05", {
    student: `Son 4 haftada ${plural(d28.V, "ödevden")} ${d28.silent} tanesi sessiz kaldı: ne sonucu girildi ne pas geçildi. Hepsini birden telafi etmeye çalışma. Bugün birini seç; ya bitir ya da nedenini yazıp pas geç. Küçük bir adım ritmini yeniden başlatır.`,
    coach: `Son 28 günde vadesi gelen ${plural(d28.V, "ödevin")} ${d28.silent} tanesi sessiz kaldı (teslim ${fmtPct(d28.deliveredPct)}; okul ödevi ${fmtPct(d28School.deliveredPct)}, kişisel ödev ${fmtPct(d28Coach.deliveredPct)}; son giriş ${c.g != null ? `${c.g} gün önce` : "bilinmiyor"}). Kısa bir görüşmeyle sorunun motivasyon mu, zaman mı, yoksa uygulama kullanımı mı olduğunu netleştirin ve haftalık yükü gözden geçirin.${r01List ? ` Açık ödevler: ${r01List}.` : ""}`,
    evidence: `28 günde ${d28.V} ödev · ${d28.silent} sessiz · ele alınan ${fmtPct(d28.handledPct)}`, count: d28.silent, owner: "Koç", section: "odev",
    short: `ele alınan ${fmtPct(d28.handledPct)}`,
  });

  // R06 — zaman sıkıntısı
  const zaman14 = items.filter((it) => it.state === "skip" && it.skipReason === "ZAMAN" && inR(it.skipDay, asOf - 13, asOf));
  const done28 = c.V28.filter((it) => it.completed);
  const late28 = done28.filter((it) => it.state === "late");
  // Geç / (Zamanında + Geç) — pastan dönüş ne zamanında ne geç sayılır.
  const timed28 = done28.filter((it) => it.state === "onTime" || it.state === "late").length;
  const lateRatio = timed28 ? late28.length / timed28 : 0;
  // En az 5 zamanı ölçülebilir teslim (zamanında + geç) — oranla aynı payda; pastan dönüşler ikisine de girmez.
  const r06 = zaman14.length >= 2 || (timed28 >= 5 && lateRatio >= 0.4);
  if (r06) {
    const late14 = items.filter((it) => it.state === "late" && inR(it.doneDay, asOf - 13, asOf)).length;
    const withE = items.filter((it) => it.expected).sort((a, b) => b.schedDay - a.schedDay)[0];
    const Q = (withE ? withE.expected : Math.max(0, ...done28.map((it) => (it.correct ?? 0) + (it.wrong ?? 0) + (it.blank ?? 0)))) || 30;
    const mon = weekStart(c.curWeek);
    const weekNew = items.filter((it) => inR(it.schedDay, mon, mon + 6));
    add("R06", {
      student: `Son iki haftada ${plural(zaman14.length + late14, "ödeve")} zaman yetmedi. Büyük ödevleri güne bölmeyi dene: ${Q} soruluk bir ödev 3 güne bölünürse günde ${Math.ceil(Q / 3)} soru eder. Ödev geldiği gün ilk parçayı bitir, son güne bir şey bırakma.`,
      coach: `Zaman yönetimi sinyali: son 14 günde 'zaman yetmedi' pası okul ödevlerinde ${zaman14.filter((it) => it.isSchool).length}, kişisel ödevlerde ${zaman14.filter((it) => !it.isSchool).length}; geç teslim oranı ${fmtPct(lateRatio * 100)}. Bu haftanın yükü ${weekNew.filter((it) => it.isSchool).length} okul ve ${weekNew.filter((it) => !it.isSchool).length} kişisel ödev, bilinen toplam yaklaşık ${weekNew.reduce((s, it) => s + (it.expected || 0), 0)} soru. Birlikte gün gün bir plan çıkarın; gerekirse bu hafta kişisel ödevi azaltın.`,
      evidence: `14 günde ${zaman14.length} zaman pası · geç teslim ${fmtPct(lateRatio * 100)}`, count: zaman14.length + late28.length, owner: "Koç", section: "odev",
      short: "zaman sıkıntısı",
    });
  }

  // Ders bazlı öneriler R00 yoksa.
  const focus = subjects.filter((s) => isTracked(s.key) && s.label === "focus").sort((a, b) => b.priority - a.priority);
  const r07Subjects = new Map();
  if (!r00) {
    // R07 — odak ders
    for (const s of focus.filter((x) => !x.fromKonu && x.lists.first.length).slice(0, 2)) {
      const [t1, t2] = s.lists.first;
      const hedefQ = c.g2Target(s.key, c.curWeek);
      r07Subjects.set(s.key, s.lists.first.map((t) => t.name));
      add("R07", {
        student: `${s.name} bu dönem en çok net kazanabileceğin alan (net oranın ${fmtPct(s.labelAgg.NO)}). Bu hafta bu derse ${hedefQ} soru ayır ve en çok zorlandığın konuyla başla: ${t1.name}. Küçük ama düzenli setler en hızlı artışı getirir.`,
        coach: `${s.name} odak ders: net oranı ${fmtPct(s.labelAgg.NO)} (${plural(s.labelAgg.Q, "soru")}, ${plural(s.labelAgg.n, "kayıt")}${s.pTilde != null && s.compCount >= 2 ? `; okul içi medyan yüzdelik ${fmtInt(s.pTilde)}` : ""}). En düşük konular: ${t1.name} (${fmtPct(t1.rStar)})${t2 ? `; ${t2.name} (${fmtPct(t2.rStar)})` : ""}. Bu haftaki kişisel ödevi bu konulara, kolaydan zora 20–30 soruluk setlerle verin.`,
        evidence: s.reason.coach, evidenceStudent: s.reason.student, count: s.labelAgg.n, owner: "Koç", subject: s, topic: t1.name,
        action: { kind: "study", subjectKey: s.key, topic: t1.name }, coachAction: { kind: "assign", subjectKey: s.key, topic: t1.name }, section: "karne",
        short: `${s.name} odak`,
      });
    }
  }

  // R08 — okulda işlenen, kaydı olmayan konular (R01 ve R03'teki konular düşülür)
  const r01Keys = new Set(overdue.map((it) => `${it.key}|${it.topicKey}`));
  const r08 = subjects.filter((s) => isTracked(s.key)).map((s) => {
    const list = s.lists.schoolNoRecord.filter((t) => inR(t.endDay, asOf - 55, asOf) && !r01Keys.has(`${s.key}|${t.key}`) && !r03Topics.has(`${s.key}|${t.key}`));
    return { s, list };
  }).filter((x) => x.list.length >= 2).sort((a, b) => b.s.weight - a.s.weight).slice(0, 2);
  for (const { s, list } of r08) {
    const names = list.slice(0, 3).map((t) => t.name).join("; ");
    let tempo = "";
    if (grade12 && weeksLeft != null) {
      const canon = TOPICS_BY_EXAM[s.examType]?.[s.subject] || [];
      const qByTopic = new Map();
      for (const r of records.filter((x) => x.key === s.key)) qByTopic.set(r.topicKey, (qByTopic.get(r.topicKey) || 0) + r.Q);
      const studied = new Set([...qByTopic.entries()].filter(([, q]) => q >= 10).map(([k]) => k));
      const u = canon.filter((n) => !studied.has(n)).length;
      if (canon.length) tempo = ` Müfredatta kaydı olmayan ~${u} konu var. Son 8 haftayı tekrara ayırırsak kalan ${weeksLeft} haftada haftada ~${fmtDec(u / Math.max(weeksLeft - 8, 1), 1)} konu gerekiyor.`;
    }
    add("R08", {
      student: `${s.name} dersinde okulda işlenen ${list.length} konuda henüz kaydın yok: ${names}. Bu hafta birini seç ve 20–30 soru çöz. Sınıfın temposunu yakalamanın en kolay yolu bu.`,
      coach: `${s.name}: okulda işlenmiş ${list.length} konuda öğrencinin kaydı yok (${names}; konu eşleşmesi yaklaşık). Bunlardan birini bu haftanın kişisel ödevi yapın.${tempo}`,
      evidence: `${list.length} konu · son 56 gün okul ödevleri`, count: list.length, owner: "Koç", subject: s, topic: list[0].name,
      action: { kind: "study", subjectKey: s.key, topic: list[0].name }, coachAction: { kind: "assign", subjectKey: s.key, topic: list[0].name }, section: "kapsam",
      short: `${s.name}: ${list.length} konu kayıtsız`,
    });
  }

  if (!r00) {
    // R09 — düşüş
    for (const s of subjects.filter((x) => isTracked(x.key) && x.trend.enough && x.trend.dir === "down")) {
      const t = s.trend;
      const konu = s.lists.first[0]?.name || [...s.records].reverse()[0]?.topicName || s.subject;
      add("R09", {
        student: `${s.name} dersinde net oranın son 4 haftada ${fmtPct(t.a)} düzeyinden ${fmtPct(t.b)} düzeyine indi. Yeni konular daha zorlayıcı olabilir, bu normal. Önce '${konu}' konusunun temel sorularına dönüp onu sağlamlaştır, sonra zor sorulara geç.`,
        coach: `${s.name} düşüşte: önceki 4 haftada ${fmtPct(t.a)}, son 4 haftada ${fmtPct(t.b)}${t.hasSchool ? ` (okul medyanı ${fmtPct(t.ca)} → ${fmtPct(t.cb)})` : " (okul verisi yok)"}. ${t.hasSchool ? "Düşüş okul genelinde görülmüyor, bireysel görünüyor. " : ""}Son 2–3 ödevin yanlış soru numaralarına ve teslim notlarına birlikte bakın. Nedenin yeni konu mu, kaynak mı, yük mü olduğunu netleştirin.`,
        evidence: `${fmtPct(t.a)} → ${fmtPct(t.b)} (Δ ${fmtSigned(t.delta)} puan)`, count: Math.round(-t.delta), owner: "Koç", subject: s, topic: konu,
        action: { kind: "study", subjectKey: s.key, topic: konu }, coachAction: { kind: "assign", subjectKey: s.key, topic: konu }, section: "trend",
        short: `${s.name} düşüşte`,
      });
    }
    // R10 — okulda alt çeyrek
    for (const s of subjects.filter((x) => isTracked(x.key))) {
      const comp = comparable.filter((r) => r.key === s.key && inR(r.day, asOf - 55, asOf));
      if (comp.length < 3) continue;
      const low = comp.filter((r) => r.item.school.pct < 25);
      if (low.length < (2 / 3) * comp.length) continue;
      const d = mean(comp.map((r) => r.item.school.median - r.r));
      const konu = s.lists.first[0]?.name || comp[comp.length - 1].topicName;
      const t = comp[comp.length - 1].item.teacher;
      const r07 = r07Subjects.get(s.key);
      add("R10", {
        student: `${s.name} okul ödevlerinde aynı ödevi çözenlerin medyanına ortalama ${fmtInt(d)} puan uzaktasın. Bu fark kapanabilir. İlk adım olarak '${konu}' konusuna odaklan ve haftada bir ek set çöz.`,
        coach: `${s.name}: son ${comp.length} okul ödevinin ${low.length} tanesinde öğrenci okulun alt çeyreğinde (medyan yüzdelik ${fmtInt(median(comp.map((r) => r.item.school.pct)))}, ortalama katılım ${fmtPct(mean(comp.map((r) => r.item.school.participation ?? 0)))}). Aynı ödevi herkes çözdüğü için fark kitap zorluğundan kaynaklanmıyor. Branş öğretmeni ${t ? hoca(t) : ""} ile görüşüp etüt planlayın ve ek kişisel ödev verin.${r07 ? ` En düşük konular: ${r07.slice(0, 2).join("; ")}.` : ""}`.replace("  ", " "),
        evidence: `${comp.length} okul ödevinin ${low.length} tanesinde alt çeyrek`, evidenceStudent: `${comp.length} okul ödevinde okul medyanına ortalama ${fmtInt(d)} puan`, count: low.length, owner: "Branş öğretmeni", ownerName: t, subject: s, topic: konu,
        action: { kind: "study", subjectKey: s.key, topic: konu }, coachAction: { kind: "assign", subjectKey: s.key, topic: konu }, section: "karne",
        short: `${s.name}: okulda alt çeyrek`,
      });
    }
    // R11–R13 — çözüm profili (her biri en fazla 1 ders)
    const prof = (id) => subjects.filter((s) => isTracked(s.key) && s.profile === id);
    const wrongS = prof("wrong").sort((a, b) => b.agg.Y - a.agg.Y)[0];
    if (wrongS) {
      const a = wrongS.agg;
      add("R11", {
        student: `${wrongS.name} dersinde işaretlediğin her 10 sorudan yaklaşık ${Math.round(10 * (1 - a.accuracy / 100))} tanesi yanlış çıkıyor; yanlışların ayrıca ${fmtDec(a.gotur, 1)} doğrunu götürdü. Yanlış yaptığın soruları çözümüne bakarak yeniden çöz ve her birinin yanına not düş: bilgi mi, dikkat mi, işlem mi? En sık çıkan hata türünden başla.`,
        coach: `${wrongS.name}: isabet ${fmtPct(a.accuracy)}, boş oranı düşük (${fmtPct(a.blankRate)}); yanlışlar ayrıca ${fmtDec(a.gotur, 1)} doğruyu götürdü. Kavram yanılgısı ya da acele olası. Yanlış soru numaralarını birlikte açın. Aynı hata tekrarlıyorsa konu tekrarı, hata türleri dağınıksa süre ve dikkat çalışması verin.`,
        evidence: `isabet ${fmtPct(a.accuracy)} · boş ${fmtPct(a.blankRate)} · ${plural(a.Q, "soru")}`, count: a.Y, owner: "Koç", subject: wrongS, section: "netkaybi",
        short: `${wrongS.name}: yanlış ağırlıklı`,
      });
    }
    const cautS = prof("cautious").sort((a, b) => b.agg.B - a.agg.B)[0];
    if (cautS) {
      const a = cautS.agg;
      add("R12", {
        student: `${cautS.name} dersinde işaretlediğin soruların ${fmtPct(a.accuracy)} kadarı doğru; bildiğin yerde çok iyisin. Ama soruların ${fmtPct(a.blankRate)} kadarı boş kaldı. Boşların hangi konudan geldiğine bak ve o konuyu tekrar et. Sınav için de hatırla: iki şıkka indirebildiğin soruyu işaretlemek ortalamada soru başına +0,375 net getirir.`,
        coach: `${cautS.name}: isabet yüksek (${fmtPct(a.accuracy)}) ama boş oranı ${fmtPct(a.blankRate)}. Sorun dikkat değil; büyük olasılıkla konu eksiği ya da süre. Boş kalan soruların konusuna kısa bir tekrar ödevi verin ve eleme stratejisini konuşun: iki şıkka inildiyse işaretlemek beklenen neti artırır.`,
        evidence: `isabet ${fmtPct(a.accuracy)} · boş ${fmtPct(a.blankRate)}`, count: a.B, owner: "Koç", subject: cautS, section: "netkaybi",
        short: `${cautS.name}: temkinli`,
      });
    }
    const gapS = prof("gap").sort((a, b) => b.agg.B - a.agg.B)[0];
    if (gapS) {
      const a = gapS.agg;
      const konu = gapS.lists.first[0]?.name || [...gapS.topics].sort((x, y) => y.Q - x.Q)[0]?.name || gapS.subject;
      add("R13", {
        student: `${gapS.name} dersinde soruların ${fmtPct(a.blankRate)} kadarını boş bırakıyorsun; bu genelde konunun henüz oturmadığını gösterir. '${konu}' konusunu seç, konu anlatımına bir kez dön ve 15 kolay soruyla yeniden başla.`,
        coach: `${gapS.name}: boş oranı ${fmtPct(a.blankRate)}, isabet ${fmtPct(a.accuracy)}. Bu bir konu eksiği profili. En çok zorlanılan konu '${konu}'. Kısa bir konu anlatımı ve ardından kolaydan zora kısa bir kişisel ödev önerilir.`,
        evidence: `boş ${fmtPct(a.blankRate)} · isabet ${fmtPct(a.accuracy)}`, count: a.B, owner: "Koç", subject: gapS, topic: konu,
        action: { kind: "study", subjectKey: gapS.key, topic: konu }, coachAction: { kind: "assign", subjectKey: gapS.key, topic: konu }, section: "netkaybi",
        short: `${gapS.name}: boş çok`,
      });
    }
    // R14 — serbest çalışma güçlü derslere yığılıyor
    const free28 = winAll.filter((r) => r.kind === "free");
    const freeQ = free28.reduce((s, r) => s + r.Q, 0);
    if (freeQ >= 100 && focus.length) {
      const strongKeys = new Set(subjects.filter((s) => s.label === "strong").map((s) => s.key));
      const strongQ = free28.filter((r) => strongKeys.has(r.key)).reduce((s, r) => s + r.Q, 0);
      const qOf = (key) => free28.filter((r) => r.key === key).reduce((s, r) => s + r.Q, 0);
      const f = focus.find((x) => qOf(x.key) / freeQ < 0.1);
      const focusQ = f ? qOf(f.key) : 0;
      if (f && strongQ / freeQ >= 0.6) {
        const byS = new Map();
        for (const r of free28.filter((r) => strongKeys.has(r.key))) byS.set(r.key, (byS.get(r.key) || 0) + r.Q);
        const gs = subjectMap.get([...byS.entries()].sort((a, b) => b[1] - a[1])[0][0]);
        add("R14", {
          student: `Serbest çalışmanın ${fmtPct((strongQ / freeQ) * 100)} kadarı zaten güçlü olduğun ${gs.name} dersine gidiyor; bu güzel bir temel. Bu hafta serbest çalışmanın yarısını ${f.name} dersine ayırmayı dene. En hızlı net artışı genellikle orada gelir.`,
          coach: `Serbest çalışmanın ${fmtPct((strongQ / freeQ) * 100)} kadarı güçlü derslere (${gs.name}), yalnızca ${fmtPct((focusQ / freeQ) * 100)} kadarı odak derse (${f.name}) gidiyor. Öğrenci rahat olduğu derse yöneliyor olabilir. Bu hafta ${f.name} için somut bir serbest çalışma soru hedefi koyun.`,
          evidence: `serbest ${plural(freeQ, "soru")} · güçlü derslere ${fmtPct((strongQ / freeQ) * 100)}`, count: freeQ, owner: "Koç", subject: f,
          action: { kind: "study", subjectKey: f.key }, short: "serbest çalışma dağılımı",
        });
      }
    }
  }

  // R15 — serbest çalışma yok (12. sınıf)
  if (grade12) {
    const free21 = recsIn(asOf - 20, asOf).filter((r) => r.kind === "free").length;
    if (!free21 && d28.V >= 5 && d28.deliveredPct >= 80) {
      const f = focus[0] || subjects.filter((s) => s.adjNO != null).sort((a, b) => a.agg.NO - b.agg.NO)[0];
      const odak = f ? `${f.name} dersinden` : "en çok zorlandığın dersten";
      add("R15", {
        student: `Ödevlerini düzenli yapıyorsun, bu çok iyi. Bir sonraki adım: haftada 2 kez ${odak} kendi seçtiğin 20 soruyu çözüp Serbest Çalışma olarak gir. Hem gelişimin hızlanır hem raporun seni daha iyi tanır.`,
        coach: `Öğrenci ödevlerini yapıyor (teslim ${fmtPct(d28.deliveredPct)}) ama 3 haftadır ödev dışında kaydı yok. Çalışıp kaydetmiyor olabilir; bunu sorun. ${f ? f.name : "Odak ders"} için haftada 2 × 20 soruluk bir serbest çalışma hedefiyle başlanabilir.`,
        evidence: `21 günde serbest çalışma yok · teslim ${fmtPct(d28.deliveredPct)}`, count: 1, owner: "Koç", subject: f || null,
        action: { kind: "study", subjectKey: f?.key }, short: "serbest çalışma yok",
      });
    }
  }

  // R16 — son gün ertelemesi (R06 varsa bastırılır)
  const md = c.V28.filter((it) => it.completed && it.state !== "fixed" && it.schedDay < it.endDay);
  if (md.length >= 5 && !r06) {
    const last = md.filter((it) => it.doneDay >= it.endDay || (it.reminderAt && new Date(it.completedAt) > new Date(it.reminderAt))).length;
    if (last / md.length >= 0.6) add("R16", {
      student: "Ödevlerinin çoğunu son gün ya da hatırlatmadan sonra bitiriyorsun. Yeni ödev gelince ilk gün sadece 10 soru çöz. Son gün stresi yarıya iner, sorulara da daha dikkatli bakarsın.",
      coach: `Çok günlük ödevlerin ${fmtPct((last / md.length) * 100)} kadarı son gün ya da gecikme hatırlatmasından sonra teslim ediliyor; bir erteleme alışkanlığı var. Ödevin ortasına bir ara kontrol noktası koyun.`,
      evidence: `${md.length} çok günlük ödevin ${last} tanesi son gün`, count: last, owner: "Koç", section: "odev", short: "son gün ertelemesi",
    });
  }

  // R17 — kısmi teslim
  const withE = winAll.filter((r) => r.kind !== "free" && r.expected);
  const partial = withE.filter((r) => r.Q < 0.8 * r.expected);
  if (withE.length >= 3 && partial.length >= 2) {
    const p = partial[partial.length - 1];
    add("R17", {
      student: `Bazı ödevlerinde girdiğin soru sayısı ödevdekinden az (ör. ${p.name}: ${p.Q}/${p.expected}). Çözemediğin soruları 'boş' olarak gir. Ödev yarım kaldıysa kalanını bitirip Serbest Çalışma olarak ekle. Böylece raporun seni daha doğru gösterir.`,
      coach: `${plural(partial.length, "ödevde")} beklenen sorunun %80'inden azı girilmiş (ör. ${p.name}: ${p.Q}/${p.expected}). Ödevin mi yarım kaldığını, boşların mı girilmediğini netleştirin. Bu dönemin boş oranlarını yaklaşık kabul edin.`,
      evidence: `${withE.length} ödevin ${partial.length} tanesinde kısmi giriş`, count: partial.length, owner: "Öğrenci", subject: subjectMap.get(p.key), short: "kısmi teslim",
    });
  }

  // R18 — soru numarası girilmiyor
  const yb = winAll.filter((r) => r.Y + r.B > 0);
  if (yb.length >= 5) {
    const withNums = yb.filter((r) => r.questionNumbers?.length).length;
    if (withNums / yb.length < 0.3) add("R18", {
      student: "Yanlış ve boş bıraktığın soruların numaralarını da girersen tekrar listen otomatik oluşur ve PDF'te yazdırılabilir bir kontrol listesi olarak çıkar. Bir sonraki ödevde yalnızca numaraları yazman yeterli.",
      coach: `Yanlış ya da boş sorusu olan kayıtların yalnızca ${fmtPct((withNums / yb.length) * 100)} kadarında soru numarası var. Hata analizi ve tekrar listesi için numara girmesini isteyin; nasıl yapıldığını bir kez birlikte gösterin.`,
      evidence: `${yb.length} kaydın ${withNums} tanesinde numara`, count: yb.length - withNums, owner: "Öğrenci", short: "soru numarası girilmiyor",
    });
  }

  if (!r00) {
    // R19 — tekrar zamanı (en fazla 1 konu)
    const cands = subjects.filter((s) => isTracked(s.key) && s.lists.review.length).sort((a, b) => b.weight - a.weight);
    if (cands.length) {
      const s = cands[0];
      const t = s.lists.review[0];
      add("R19", {
        student: `'${t.name}' konusuna ${t.daysSince} gündür dönmedin; orada net oranın ${fmtPct(t.rStar)} idi. 15–20 soruluk kısa bir tekrar bilgini tazeler.`,
        coach: `Unutma riski: ${s.name}, '${t.name}' konusu (son çalışma ${t.daysSince} gün önce, net oranı ${fmtPct(t.rStar)}, ${plural(t.Q, "soru")}). Kısa bir tekrar ödevi uygun olur.`,
        evidence: `son çalışma ${t.daysSince} gün önce · ${fmtPct(t.rStar)}`, count: 1, owner: "Koç", subject: s, topic: t.name,
        action: { kind: "study", subjectKey: s.key, topic: t.name }, coachAction: { kind: "assign", subjectKey: s.key, topic: t.name }, section: "konu",
        short: `${s.name}: tekrar zamanı`,
      });
    }
    // R20 — güçlü dersi koru
    const r20 = subjects.filter((s) => isTracked(s.key) && s.label === "strong" && s.daysSinceLast != null && s.daysSinceLast >= 21 && s.openOverdue === 0)
      .sort((a, b) => b.daysSinceLast - a.daysSinceLast)[0];
    if (r20) add("R20", {
      student: `${r20.name} dersinde güçlüsün (net oranın ${fmtPct(r20.labelAgg.NO)}) ama ${r20.daysSinceLast} gündür bu derse soru çözmedin. Unutmamak için haftada bir karışık 20 soru yeter.`,
      coach: `${r20.name} güçlü (${fmtPct(r20.labelAgg.NO)}) ama ${r20.daysSinceLast} gündür kayıt yok. Unutmayı önlemek için haftalık karışık bir tekrar seti ekleyin.`,
      evidence: `${r20.daysSinceLast} gündür kayıt yok · ${fmtPct(r20.labelAgg.NO)}`, count: 1, owner: "Koç", subject: r20, action: { kind: "study", subjectKey: r20.key },
      short: `${r20.name}: bakım`,
    });
  }

  // R21 — TYT/AYT dengesi (12. sınıf)
  if (c.share.flag) {
    const sh = c.share;
    const weeklyAvg = sh.total / 4;
    const hedef = Math.max(40, round10(0.25 * weeklyAvg));
    const p = (sh.smallQ / sh.total) * 100;
    add("R21", {
      student: `Son 4 haftada çözdüğün soruların yalnızca ${fmtPct(p)} kadarı ${sh.small}. Puanını iki oturum birlikte belirler. Bu hafta ${sh.small} tarafına en az ${hedef} soru ekle.`,
      coach: `Son 28 günde ${sh.small} payı ${fmtPct(p)} (${fmtInt(sh.total)} sorunun ${fmtInt(sh.smallQ)} tanesi). Sistemde alan bilgisi olmadığından kararı siz verin. Gerekiyorsa kişisel ödevlerin bir kısmını ${sh.small} tarafına kaydırın (bu hafta yaklaşık ${hedef} soru).`,
      evidence: `${sh.small} payı ${fmtPct(p)} · ${plural(sh.total, "soru")}`, count: 1, owner: "Koç", section: "kapsam", short: `${sh.small} payı düşük`,
    });
  }

  // ---- kutlamalar
  if (!r00) {
    // K01 — yükseliş (Δ en büyük)
    const up = subjects.filter((s) => isTracked(s.key) && s.trend.enough && s.trend.dir === "up" && !s.trend.schoolAlsoUp).sort((a, b) => b.trend.delta - a.trend.delta)[0];
    if (up) add("K01", {
      student: `Harika gidiyorsun: ${up.name} dersinde net oranın son 4 haftada ${fmtPct(up.trend.a)} düzeyinden ${fmtPct(up.trend.b)} düzeyine çıktı. Emeğinin karşılığını alıyorsun, bu ritmi koru.`,
      coach: `${up.name} yükselişte: ${fmtPct(up.trend.a)} → ${fmtPct(up.trend.b)}. Görüşmeyi bununla açın ve somut olarak takdir edin. Zorluğu bir kademe artırmak için uygun bir zaman.`,
      evidence: `${fmtPct(up.trend.a)} → ${fmtPct(up.trend.b)}`, count: Math.round(up.trend.delta), owner: "Koç", subject: up, section: "trend",
    });
    // K02 — etiket yükseldi (W1 etiketi W0 etiketinden yüksek)
    const L1 = c.labelsAt(asOf, 28, null), L0 = c.labelsAt(asOf - 28, 28, null);
    for (const s of subjects.filter((x) => isTracked(x.key))) {
      const a = L0.get(s.key), b = L1.get(s.key);
      if (!a || !b || a.adjNO == null || b.adjNO == null || a.label === "few" || b.label === "few" || s.trend.dir === "down") continue;
      if (LEVEL[b.label] > LEVEL[a.label]) {
        add("K02", {
          student: `${s.name} dersinin etiketi ${LABELS[a.label]} → ${LABELS[b.label]} oldu. Son 4 haftadaki çalışman bunu sağladı, tebrikler!`,
          coach: `${s.name} etiketi ${LABELS[a.label]} → ${LABELS[b.label]} yükseldi. Mevcut plan işe yarıyor; öğrenciyi takdir edin ve aynı düzeni sürdürün.`,
          evidence: `${LABELS[a.label]} → ${LABELS[b.label]}`, count: 1, owner: "Koç", subject: s, section: "karne",
        });
        break;
      }
    }
    // K03 — okul medyanıyla açık kapanıyor
    for (const s of subjects.filter((x) => isTracked(x.key))) {
      const comp = comparable.filter((r) => r.key === s.key && inR(r.day, asOf - 83, asOf));
      if (comp.length < 6) continue;
      const diffs = comp.map((r) => r.r - r.item.school.median);
      const f1 = mean(diffs.slice(-3)), f0 = mean(diffs.slice(-6, -3));
      if (f0 < 0 && f1 - f0 >= 8) {
        add("K03", {
          student: `${s.name} okul ödevlerinde medyanla aranı son 3 ödevde ortalama ${fmtInt(f1 - f0)} puan kapattın. Doğru yoldasın, aynı düzenle devam.`,
          coach: `${s.name}: okul medyanına göre ortalama fark ${fmtSigned(f0)} puandan ${fmtSigned(f1)} puana geldi (son 6 okul ödevi). Açık kapanıyor. Planı değiştirmeden sürdürün ve bu ilerlemeyi öğrenciyle paylaşın.`,
          evidence: `fark ${fmtSigned(f0)} → ${fmtSigned(f1)} puan`, count: 1, owner: "Koç", subject: s, section: "karne",
        });
        break;
      }
    }
    // K04 — üst çeyrek
    const top = subjects.filter((s) => isTracked(s.key) && s.compCount >= 3 && s.pTilde >= 75).sort((a, b) => b.pTilde - a.pTilde)[0];
    if (top) {
      const f = focus[0];
      add("K04", {
        student: `${top.name} ödevlerinde aynı ödevi çözenlerin üst çeyreğindesin. Artık daha zor, yeni nesil sorulara geçebilirsin; bunu koçuna söyle.`,
        coach: `${top.name}: okul içinde üst çeyrekte (medyan yüzdelik ${fmtInt(top.pTilde)}, ${plural(top.compCount, "ödev")}). Daha zor bir kaynak verilebilir${f ? `; bu dersin zamanının bir kısmı ${f.name} dersine aktarılabilir` : ""}.`,
        evidence: `${plural(top.compCount, "okul ödevi")} · üst çeyrek`, count: top.compCount, owner: "Koç", subject: top, section: "karne",
      });
    }
  }
  // K05 — zamanında istikrar
  if (d28.V >= 6 && d28.onTime / d28.V >= 0.9) add("K05", {
    student: `Son 4 haftada ${plural(d28.V, "ödevden")} ${d28.onTime} tanesini zamanında teslim ettin. Bu disiplin YKS yolunda en büyük avantajın.`,
    coach: `Teslim disiplini çok iyi: ${plural(d28.V, "ödevden")} ${d28.onTime} tanesi zamanında. Net düzeyinden bağımsız olarak takdir edin; bu, odak derslerde çalışmayı sürdürmesini kolaylaştırır.`,
    evidence: `${d28.onTime}/${d28.V} zamanında`, count: d28.onTime, owner: "Koç", section: "odev",
  });
  // K06 — düzen serisi
  if (c.streak >= 2) add("K06", {
    student: `${c.streak} haftadır serin sürüyor: hiçbir ödevi sessiz bırakmadın ve haftada en az 3 gün çalıştın. Bu düzen YKS'de fark yaratır.`,
    coach: `${c.streak} haftalık düzen serisi: sessiz kaçırma yok, haftada en az 3 aktif gün. Görüşmede takdir edin.`,
    evidence: `${c.streak} hafta seri`, count: c.streak, owner: "Koç", section: "odev", meta: { badge: [2, 4, 8, 12].includes(c.streak) },
  });
  // K07 — kişisel rekor
  for (const r of [...records].reverse().filter((x) => x.Q >= 20 && inR(x.day, asOf - 6, asOf))) {
    const earlier = records.filter((x) => x.key === r.key && x.Q >= 20 && x.day < r.day);
    if (earlier.length >= 3 && r.r > Math.max(...earlier.map((x) => x.r))) {
      const s = subjectMap.get(r.key);
      add("K07", {
        student: `Yeni kişisel rekor! ${s.name}: ${r.Q} soruda ${fmtNet(r.net)} net (net oranı ${fmtPct(r.r)}).`,
        coach: `Kişisel rekor: ${s.name}, ${fmtDay(r.day)}, ${r.Q} soruda ${fmtNet(r.net)} net (${fmtPct(r.r)}). Kısa bir tebrik mesajı atın.`,
        evidence: `${r.Q} soru · ${fmtPct(r.r)} · ${fmtDay(r.day)}`, count: 1, owner: "Koç", subject: s,
      });
      break;
    }
  }
  // K08 — inisiyatif
  const f28 = winAll.filter((r) => r.kind === "free").reduce((s, r) => s + r.Q, 0);
  const all28 = winAll.reduce((s, r) => s + r.Q, 0);
  if (f28 >= 100 && all28 && f28 / all28 >= 0.25) add("K08", {
    student: `Ödevlerinin dışında ${fmtInt(f28)} soru daha çözmüşsün. Kendi başına çalışman fark yaratıyor.`,
    coach: `Öğrenci ödev dışında ${fmtInt(f28)} soru çözdü (toplamın ${fmtPct((f28 / all28) * 100)} kadarı). Takdir edin; serbest çalışmayı odak konulara yönlendirmesini önerebilirsiniz.`,
    evidence: `serbest ${plural(f28, "soru")} · ${fmtPct((f28 / all28) * 100)}`, count: f28, owner: "Koç",
  });
  // K09 — güçlü alan (yedek: başka kutlama yoksa)
  if (!r00 && !out.some((r) => r.id.startsWith("K"))) {
    const r20key = out.find((r) => r.id === "R20")?.subjectKey;
    const s = subjects.filter((x) => isTracked(x.key) && x.label === "strong" && x.key !== r20key).sort((a, b) => (b.pTilde ?? b.adjNO) - (a.pTilde ?? a.adjNO))[0];
    if (s) {
      const f = focus[0];
      const kanit = s.compCount >= 2 && s.pTilde >= 75 ? "okul ödevlerinde üst çeyrek" : `${plural(s.labelAgg.n, "kayıt")}, ${plural(s.labelAgg.Q, "soru")}`;
      add("K09", {
        student: `${s.name} senin güçlü alanın (net oranı ${fmtPct(s.labelAgg.NO)}, ${kanit}). Bu seviyeyi korumak için haftada bir karışık set yeterli.${f ? ` Kalan zamanını ${f.name} dersine ayırırsan toplam netini en hızlı sen artırırsın.` : ""}`,
        coach: `${s.name} güçlü alan (${fmtPct(s.labelAgg.NO)}, ${kanit}). Bakım modunda tutun (haftalık karışık set)${f ? `; kişisel ödev zamanını ${f.name} dersine kaydırın` : ""}.`,
        evidence: kanit, count: 1, owner: "Koç", subject: s, section: "karne",
      });
    }
  }

  // ---- R00 bastırması
  const all = r00 ? out.filter((r) => !R00_SUPPRESS.has(r.id)) : out;
  const sortKey = (a, b) => a.priority - b.priority || b.weight - a.weight || b.evidenceCount - a.evidenceCount;
  all.sort(sortKey);

  // Çakışmalar — öğrenci ve koç için ayrı listeler.
  const has = (id) => all.some((r) => r.id === id);
  const studentAll = all.filter((r) => r.audience.student).filter((r) => {
    if (r.id === "R05" && has("R01")) return false; // öğrenciye R01 (R05 yalnız PDF'te)
    if (r.id === "R10" && all.some((x) => x.id === "R07" && x.subjectKey === r.subjectKey)) return false;
    return true;
  });
  const coachAll = all.filter((r) => r.audience.coach).filter((r) => {
    if (r.id === "R01" && has("R05")) return false; // R01'in listesi R05'e eklendi
    if (r.id === "R07" && all.some((x) => x.id === "R10" && x.subjectKey === r.subjectKey)) return false;
    return true;
  });
  const pdfStudentAll = all.filter((r) => r.audience.student).filter((r) => !(r.id === "R10" && all.some((x) => x.id === "R07" && x.subjectKey === r.subjectKey)));

  return {
    all,
    studentAll, coachAll,
    student: pickRecs(studentAll, STUDENT_SCREEN),
    coach: pickRecs(coachAll, COACH_SCREEN),
    pdfStudent: pickRecs(pdfStudentAll, { max: 6, maxOthers: 5, maxCelebs: 2, reserve: 1, perSubject: 1, celebFirst: true }),
    pdfCoach: pickRecs(coachAll, { max: 10, maxCelebs: 2, reserve: 1, perSubject: 2, celebFirst: false }),
  };
}

// Kart seçimi: önce engel/odak/strateji/alışkanlık/veri kartları (öncelik sırasıyla, ders başına sınırla), sonra
// kutlamalar (ayrı havuz, ders başına 1). reserve: kutlama varsa ona ayrılan yer — koçta engeller kutlamalara yer
// kaptırmaz, öğrencide ise en fazla 1 kutlama + 2 kart (kutlama yoksa övgü uydurulmaz, yeri boş kalır).
export const STUDENT_SCREEN = { max: 3, maxOthers: 2, maxCelebs: 1, reserve: 1, perSubject: 1, celebFirst: true };
export const COACH_SCREEN = { max: 6, maxOthers: 6, maxCelebs: 2, reserve: 1, perSubject: 2, celebFirst: false };
export function pickRecs(list, { max, maxOthers = max, maxCelebs, reserve = 0, perSubject, celebFirst }) {
  const celebs = list.filter((r) => r.type === "kutlama");
  const others = list.filter((r) => r.type !== "kutlama");
  const counts = new Map();
  const chosen = [];
  const roomOthers = Math.min(maxOthers, max - Math.min(reserve, celebs.length, maxCelebs));
  for (const r of others) {
    if (chosen.length >= roomOthers) break;
    if (r.subjectKey && (counts.get(r.subjectKey) || 0) >= perSubject) continue;
    chosen.push(r);
    if (r.subjectKey) counts.set(r.subjectKey, (counts.get(r.subjectKey) || 0) + 1);
  }
  const celebSubjects = new Set();
  const chosenCelebs = [];
  for (const r of celebs) {
    if (chosenCelebs.length >= Math.min(maxCelebs, max - chosen.length)) break;
    if (r.subjectKey && celebSubjects.has(r.subjectKey)) continue;
    chosenCelebs.push(r);
    if (r.subjectKey) celebSubjects.add(r.subjectKey);
  }
  return celebFirst ? [...chosenCelebs, ...chosen] : [...chosen, ...chosenCelebs];
}

// Kartı gizleme (öğrenci, 7 gün) — cihazda tutulur, rapor hesabını değiştirmez; kanıttaki sayı artarsa kart geri gelir.
export function recHideKey(rec) {
  return `${rec.id}|${rec.subjectKey || ""}|${rec.topic || ""}`;
}
export function isRecHidden(rec, store, now = Date.now()) {
  const h = store?.[recHideKey(rec)];
  if (!h) return false;
  return h.until > now && rec.evidenceCount <= h.count;
}

// Metin yardımcıları — ekran ve PDF aynı sözcükleri kullanır.
export const STATE_LABEL = { onTime: "Zamanında", fixed: "Pastan dönüş", late: "Geç", skip: "Pas", silent: "Sessiz", open: "Açık" };
export const SKIP_LABEL = { KONU: "Konu", ZAMAN: "Zaman", KAYNAK: "Kaynak", DIGER: "Diğer" };
export const SKIP_OWNER = { KONU: "Branş öğretmeni", ZAMAN: "Koç", KAYNAK: "Yönetim", DIGER: "Koç" };
export const TOPIC_STATUS = { solid: "Pekişti", growing: "Gelişiyor", review: "Tekrar gerekli", few: "Az veri", open: "Açık" };
export const TREND_LABEL = { up: "Yükselişte", flat: "Sabit", down: "Düşüşte" };
