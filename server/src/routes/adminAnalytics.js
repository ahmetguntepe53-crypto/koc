import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { EXAM_TYPES, GRADE_LEVELS } from "../subjects.js";
import { recipientStatus, questionCountOf, trWeekRange } from "../weekStats.js";
import { trTodayAsDateOnly } from "../quietHours.js";

// "Okul analizi" — okul yönetiminin (ADMIN) okul geneli ödevlere TOPLU bakışı (bkz. src/screens/admin/AdminAnalytics.jsx).
// routes/admin.js'e alt yol olarak bağlanır (adminRouter.use("/analytics", …)); admin router'ı app.js'de zaten
// requireAuth + requireRole("ADMIN") arkasında — koç, branş öğretmeni ve öğrenci 403 alır.
//
// Kapsam: branş öğretmenlerinin okul çapında yayınladığı (SCHOOL_WIDE, SENT) TYT/AYT ödevleri; bitiş günü seçilen
// pencerede (son 4/8/16 hafta, bu hafta dahil, bugüne kadar) olanlar. Koçların kendi öğrencilerine verdiği ödevler
// burada YOK — onlar koç–öğrenci ilişkisinin içinde kalır, okul yönetimi tekil öğrenci takibi yapmaz.
//
// GİZLİLİK (KVKK, reşit olmayanlar): yanıtta hiçbir öğrencinin adı, kimliği ya da tekil sonucu bulunmaz.
//  • Alıcısı 10'dan az olan ödev satırı hiç dönmez ve hiçbir toplama girmez (k-anonimlik); yalnızca kaç ödevin
//    gizlendiği söylenir. Sınıf süzgeci önce uygulanır: 24 kişilik bir ödevin 12. sınıf dilimi 8 kişiyse o dilim gizlenir;
//    16 kişilik 11. sınıf dilimi de gizlenir — yoksa "Tümü" − "11. sınıf" o 8 kişiyi verirdi (bkz. exposesSmallRemainder).
//  • Medyan/Q1/Q3 yalnızca en az 10 geçerli teslim varsa verilir — 3 kişinin medyanı neredeyse tekil bir değerdir.
//    Min/max, dağılımın kendisi ya da sıra hiç dönmez.
//  • Öğretmen adları personel bilgisidir, döner (branş öğretmeni kendi ödevinin sahibi).
export const adminAnalyticsRouter = Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
// Bitiş gününün Türkiye'deki sonu = UTC gece yarısı + 21 saat (bkz. weekStats.js > recipientStatus).
const TR_END_OF_DAY_GRACE_MS = 21 * 60 * 60 * 1000;

const WINDOWS = [4, 8, 16];
const DEFAULT_WEEKS = 8;
// k-anonimlik eşiği — rapordaki okul karşılaştırmasıyla aynı (bkz. stats.js > MIN_COMPARE).
export const MIN_GROUP = 10;
// Net oranı yalnızca en az 10 soruluk teslimlerden: 3 soruluk bir giriş %100 ya da %0 yazıp medyanı oynatmasın.
const MIN_QUESTIONS = 10;
// İşaret eşikleri (istemci açıklamada aynı sayıları gösterir; yanıtta `thresholds` olarak da gider).
const HARD_MEDIAN = 35; // medyan net oranı bunun altındaysa "zor gelen"
const KONU_SIGNAL = 20; // "konuyu bilmiyorum" pası alıcıların bu yüzdesine ulaştıysa "konu eksiği sinyali"
const LOW_PARTICIPATION = 60; // teslim oranı bunun altındaysa (ve ödev kapandıysa) "düşük katılım"
const SKIP_KEYS = ["KONU", "ZAMAN", "KAYNAK", "DIGER"];

const r1 = (v) => (v == null || Number.isNaN(v) ? null : Math.round(v * 10) / 10);
const pct = (part, whole) => (whole ? (part / whole) * 100 : null);
const ymd = (d) => d.toISOString().slice(0, 10);
// Doğrusal aralıklı yüzdelik — stats.js > quantile ile aynı tanım (rapordaki okul medyanıyla tutarlı).
function quantile(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
const medianOf = (list) => quantile([...list].sort((a, b) => a - b), 0.5);

// Tarihler UTC gece yarısı saklanır; koçun formundan gelen bir bitişte saat kısmı olabilir — gün başına indirilir.
const dayStart = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
// ISO hafta anahtarı ("2026-W39") — haftanın Perşembe'sinin yılı ISO yılıdır (yıl dönümündeki haftalar).
function isoWeekKey(day) {
  const dow = (day.getUTCDay() + 6) % 7; // Pazartesi = 0
  const thu = new Date(day.getTime() + (3 - dow) * DAY_MS);
  const year = thu.getUTCFullYear();
  const week = Math.floor((thu.getTime() - Date.UTC(year, 0, 1)) / WEEK_MS) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// Pencere: bu haftanın Pazartesi'sinden (weeks − 1) hafta geriye, bugünün sonuna kadar. Bitişi ileride olan ödev henüz
// sonuçlanmadığı için girmez; bugün biten girer (katılımı gün içinde artabilir, "düşük katılım" işareti kapanınca gelir).
export function analyticsWindow(now, weeks) {
  const { mon } = trWeekRange(now);
  const from = new Date(mon.getTime() - (weeks - 1) * WEEK_MS);
  const today = trTodayAsDateOnly(now);
  const toExclusive = new Date(today.getTime() + DAY_MS);
  // Eğilim için pencerenin ortası: ilk yarı [from, mid), son yarı [mid, bugün].
  const mid = new Date(from.getTime() + (weeks / 2) * WEEK_MS);
  return { from, today, toExclusive, mid };
}

// Tek ödevin toplu özeti. recipients önceden sınıf süzgecinden geçmiş olmalı.
function summarizeAssignment(a, recipients, now) {
  let submitted = 0, skipped = 0, silent = 0, open = 0;
  const skips = { KONU: 0, ZAMAN: 0, KAYNAK: 0, DIGER: 0 };
  const rates = [];
  for (const r of recipients) {
    const status = recipientStatus({ ...r, assignment: a }, now);
    if (status === "done") {
      submitted += 1;
      const s = r.submission;
      const q = s ? s.correctCount + s.wrongCount + s.blankCount : 0;
      // r = (D − Y/4) / Q × 100 — rapordaki kayıt net oranıyla aynı; kısa girişler (Q < 10) medyana girmez.
      // (Önce ×100, sonra ÷Q: 11/20×100 = 55,000…01 gibi kayan nokta artıkları yuvarlama sınırında sapmasın.)
      if (s && q >= MIN_QUESTIONS) rates.push(((s.correctCount - s.wrongCount / 4) * 100) / q);
    } else if (status === "skipped") {
      skipped += 1;
      // Tanınmayan eski bir sebep kaybolmasın: DIGER'e sayılır (toplam pas = dört sebebin toplamı).
      skips[SKIP_KEYS.includes(r.skipReason) ? r.skipReason : "DIGER"] += 1;
    } else if (status === "missed") {
      // Süresi geçti, ne sonuç ne pas: "kayıt yok" (sessiz). Neden bilinmiyor — yargı yok, yalnızca sayı.
      silent += 1;
    } else {
      open += 1;
    }
  }
  rates.sort((x, y) => x - y);
  const n = rates.length;
  const enough = n >= MIN_GROUP;
  const closed = a.endDate.getTime() + TR_END_OF_DAY_GRACE_MS < now.getTime();
  const participation = pct(submitted, recipients.length);
  const konuPassRate = pct(skips.KONU, recipients.length);
  const median = enough ? quantile(rates, 0.5) : null;
  const flags = [];
  if (median != null && median < HARD_MEDIAN) flags.push("zor");
  if (konuPassRate != null && konuPassRate >= KONU_SIGNAL) flags.push("konu");
  // Açık ödevde katılım gün içinde artar — "düşük" demek için süresinin dolmasını bekle.
  if (closed && participation != null && participation < LOW_PARTICIPATION) flags.push("katilim");
  const end = dayStart(a.endDate);
  return {
    id: a.id,
    examType: a.examType,
    subject: a.subject,
    topic: a.topic,
    teacher: a.teacher?.name || null,
    scheduledDate: a.scheduledDate,
    endDate: a.endDate,
    week: isoWeekKey(end),
    targetGrade: a.targetGrade ?? null,
    questionCount: questionCountOf(a.pageRange),
    closed,
    recipients: recipients.length,
    submitted, skipped, silent, open,
    participation: r1(participation),
    skips,
    konuPassRate: r1(konuPassRate),
    n,
    median: r1(median),
    q1: enough ? r1(quantile(rates, 0.25)) : null,
    q3: enough ? r1(quantile(rates, 0.75)) : null,
    flags,
    // İç kullanım (toplamlar için ham değerler) — yanıttan çıkarılır.
    _median: median,
    _end: end,
  };
}

// Birden çok ödevin toplamı: katılım ve konu pası kişi ağırlıklı (Σ teslim / Σ alıcı), medyan net oranı ödev
// medyanlarının medyanı — kalabalık bir ödev tek başına belirlemesin, her ödev bir oy. Medyanı olmayan (10'dan az
// geçerli teslim) ödev medyana girmez.
function aggregate(rows) {
  const recipients = rows.reduce((s, r) => s + r.recipients, 0);
  const submitted = rows.reduce((s, r) => s + r.submitted, 0);
  const konu = rows.reduce((s, r) => s + r.skips.KONU, 0);
  const medians = rows.map((r) => r._median).filter((v) => v != null);
  return {
    assignments: rows.length,
    recipients,
    submitted,
    participation: pct(submitted, recipients),
    median: medians.length ? medianOf(medians) : null,
    konuPassRate: pct(konu, recipients),
    medianCount: medians.length,
  };
}

const rounded = (agg) => ({ ...agg, participation: r1(agg.participation), median: r1(agg.median), konuPassRate: r1(agg.konuPassRate) });

// Ders düzeyi işaretler — ödevdekiyle aynı eşikler; katılım yalnızca süresi dolmuş ödevlerden (closedAgg), bugün biten
// bir ödevin henüz dolmayan katılımı dersi "düşük katılım" göstermesin.
function flagsOf(agg, closedAgg) {
  const flags = [];
  if (agg.median != null && agg.median < HARD_MEDIAN) flags.push("zor");
  if (agg.konuPassRate != null && agg.konuPassRate >= KONU_SIGNAL) flags.push("konu");
  if (closedAgg.participation != null && closedAgg.participation < LOW_PARTICIPATION) flags.push("katilim");
  return flags;
}

// Fark saldırısı: sınıf süzgeçli görünüm, süzgeçsiz görünümle (aynı ödevin tamamı) yan yana konunca aradaki fark ödevin
// DİĞER dilimini verir — 11 alıcılı bir ödevin 11. sınıf dilimi 10 kişiyse "Tümü" − "11. sınıf" tek bir 12. sınıf
// öğrencisinin teslim/pas durumunu ve pas sebebini açık ederdi. Bu yüzden süzgeçli görünümde dilim, ödevin geri kalan
// alıcılarından (sınıf düzeyine göre: 11, 12, diğer/boş — admin yalnız 11 ve 12'yi seçebildiği için "diğer" tek grup;
// Tümü − 11 − 12 ancak onu verir) boş olmayan her grup en az 10 kişiyse gösterilir; değilse gizlenir ve sayılır.
function exposesSmallRemainder(allRecipients, gradeLevel) {
  const sizes = new Map();
  for (const r of allRecipients) {
    const g = r.student?.gradeLevel;
    const bucket = GRADE_LEVELS.includes(g) ? g : "diğer";
    if (bucket !== gradeLevel) sizes.set(bucket, (sizes.get(bucket) || 0) + 1);
  }
  return [...sizes.values()].some((n) => n < MIN_GROUP);
}

// Saf hesap (veritabanına dokunmaz) — uç nokta ve testler aynı fonksiyonu kullanır.
// assignments: Prisma'dan gelen okul geneli ödevler (recipients: completed, skippedAt, skipReason, student.gradeLevel,
// submission D/Y/B); gradeLevel: null | 11 | 12.
export function buildSchoolAnalytics(assignments, { weeks, gradeLevel = null, now = new Date() }) {
  const win = analyticsWindow(now, weeks);
  let hidden = 0;
  const rows = [];
  for (const a of assignments) {
    // Sınıf süzgeci: hedef sınıfı başka olan ödev hiç girmez; hedefsiz (11+12) ödevde yalnız o sınıftaki alıcılar sayılır.
    if (gradeLevel && a.targetGrade != null && a.targetGrade !== gradeLevel) continue;
    const recipients = gradeLevel ? a.recipients.filter((r) => r.student?.gradeLevel === gradeLevel) : a.recipients;
    if (!recipients.length) continue; // o sınıfa hiç gitmemiş — gizlenen değil, ilgisiz
    if (recipients.length < MIN_GROUP) { hidden += 1; continue; }
    if (gradeLevel && exposesSmallRemainder(a.recipients, gradeLevel)) { hidden += 1; continue; }
    rows.push(summarizeAssignment(a, recipients, now));
  }

  // Ders (sınav türü + ders) bazında; eğilim = son yarı − ilk yarı (medyan ve katılım, puan farkı). Yarılardan biri boşsa
  // eğilim yok (null) — tek ödevden "yükseliyor" denmez.
  const bySubject = new Map();
  for (const r of rows) {
    const key = `${r.examType}|${r.subject}`;
    if (!bySubject.has(key)) bySubject.set(key, []);
    bySubject.get(key).push(r);
  }
  const subjects = [...bySubject.values()].map((list) => {
    const agg = aggregate(list);
    const first = aggregate(list.filter((r) => r._end < win.mid));
    const last = aggregate(list.filter((r) => r._end >= win.mid));
    const both = (x, y) => (x != null && y != null ? r1(y - x) : null);
    return {
      examType: list[0].examType,
      subject: list[0].subject,
      ...rounded(agg),
      trend: {
        median: both(first.median, last.median),
        participation: both(first.participation, last.participation),
      },
      flags: flagsOf(agg, aggregate(list.filter((r) => r.closed))),
    };
  }).sort((x, y) => x.examType.localeCompare(y.examType) || x.subject.localeCompare(y.subject, "tr"));

  // ISO haftaları — boş haftalar da döner (istemcideki çubuk serisi pencerenin tamamını göstersin).
  const weekList = [];
  for (let i = 0; i < weeks; i += 1) {
    const start = new Date(win.from.getTime() + i * WEEK_MS);
    const key = isoWeekKey(start);
    const agg = aggregate(rows.filter((r) => r.week === key));
    weekList.push({ week: key, start: ymd(start), ...rounded(agg) });
  }

  const total = aggregate(rows);
  const assignmentsOut = rows
    .sort((x, y) => y._end - x._end || x.subject.localeCompare(y.subject, "tr"))
    .map(({ _median, _end, ...rest }) => rest);

  return {
    window: { weeks, from: ymd(win.from), to: ymd(win.today), gradeLevel: gradeLevel || null },
    thresholds: { minGroup: MIN_GROUP, minQuestions: MIN_QUESTIONS, hardMedian: HARD_MEDIAN, konuSignal: KONU_SIGNAL, lowParticipation: LOW_PARTICIPATION },
    summary: { ...rounded(total), flagged: assignmentsOut.filter((r) => r.flags.length).length },
    // Alıcısı 10'dan az olduğu için gösterilmeyen (ve hiçbir toplama girmeyen) ödev sayısı.
    hidden,
    assignments: assignmentsOut,
    subjects,
    weeks: weekList,
  };
}

// GET /api/admin/analytics?weeks=4|8|16&gradeLevel=11|12
adminAnalyticsRouter.get("/", async (req, res) => {
  try {
    const { weeks: weeksRaw, gradeLevel: gradeRaw } = req.query || {};
    const weeks = weeksRaw === undefined || weeksRaw === "" ? DEFAULT_WEEKS : Number(weeksRaw);
    assert(WINDOWS.includes(weeks), "Geçersiz dönem (4, 8 ya da 16 hafta)");
    const gradeLevel = gradeRaw === undefined || gradeRaw === "" ? null : Number(gradeRaw);
    assert(gradeLevel === null || GRADE_LEVELS.includes(gradeLevel), "Geçersiz sınıf düzeyi (11 ya da 12)");

    const now = new Date();
    const { from, toExclusive } = analyticsWindow(now, weeks);
    const assignments = await prisma.assignment.findMany({
      where: {
        targetMode: "SCHOOL_WIDE",
        status: "SENT",
        examType: { in: EXAM_TYPES },
        endDate: { gte: from, lt: toExclusive },
        ...(gradeLevel ? { OR: [{ targetGrade: null }, { targetGrade: gradeLevel }] } : {}),
      },
      orderBy: [{ endDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, examType: true, subject: true, topic: true, pageRange: true, scheduledDate: true, endDate: true, targetGrade: true,
        teacher: { select: { name: true } },
        // Yalnızca sayım için gereken alanlar — öğrenci kimliği/adı hiç okunmaz.
        recipients: {
          select: {
            completed: true, skippedAt: true, skipReason: true,
            student: { select: { gradeLevel: true } },
            submission: { select: { correctCount: true, wrongCount: true, blankCount: true } },
          },
        },
      },
    });
    res.json(buildSchoolAnalytics(assignments, { weeks, gradeLevel, now }));
  } catch (e) {
    handleErr(res, e);
  }
});
