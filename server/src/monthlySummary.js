// Bir öğrencinin bir ayının KİMLİKSİZ özeti — yapay zekâ incelemesine (routes/aiAnalysis.js) giden tek veri.
// İçinde ad, kullanıcı adı, okul numarası, sınıf şubesi, koç adı YOK; yalnızca sınıf düzeyi (11/12), ders/konu
// adları ve sayılar. Branş ödevlerinde okulla karşılaştırma yalnızca toplu: aynı ödevi çözen DİĞER öğrencilerin medyanı,
// en az 10 kişi (k-anonimlik; bkz. routes/stats.js > full-report). Oranlar raporla aynı: net oranı = Σw·r/Σw, w = min(Q, 40).
import { prisma } from "./db.js";
import { recipientStatus, questionCountOf } from "./weekStats.js";

const DAY = 24 * 60 * 60 * 1000;
const TR_END_OF_DAY_GRACE_MS = 21 * 60 * 60 * 1000;
const MIN_CLASS = 10;

export function monthBounds(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(month || "");
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return { start: new Date(Date.UTC(y, mo - 1, 1)), end: new Date(Date.UTC(y, mo, 0)) }; // son gün dahil (UTC gece yarısı)
}

function prevMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
function agg() { return { soru: 0, dogru: 0, yanlis: 0, bos: 0, kayit: 0, sw: 0, swr: 0 }; }
function add(a, c, w, b) {
  const q = c + w + b;
  a.soru += q; a.dogru += c; a.yanlis += w; a.bos += b; a.kayit += 1;
  if (q) { const wt = Math.min(q, 40); a.sw += wt; a.swr += wt * (((c - w / 4) / q) * 100); }
}
function derive(a) {
  const net = a.dogru - a.yanlis / 4;
  const { sw, swr, ...rest } = a;
  return {
    ...rest,
    net: r1(net),
    netOrani: sw ? r1(swr / sw) : null,
    dogrulukYuzde: a.dogru + a.yanlis ? r1((a.dogru / (a.dogru + a.yanlis)) * 100) : null,
    bosYuzde: a.soru ? r1((a.bos / a.soru) * 100) : null,
    yanlisinGoturduguNet: r1(a.yanlis / 4),
  };
}
const pctOf = (c, w, b) => (c + w + b ? ((c - w / 4) / (c + w + b)) * 100 : null);
function medianOf(list) {
  const s = [...list].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Türkiye takvim günü (UTC gece yarısı) — serbest çalışma tarihleri gerçek zaman damgası.
function trDay(d) {
  const t = new Date(new Date(d).getTime() + 3 * 3600e3);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

const EXAMS = ["TYT", "AYT"];
async function monthData(studentId, month, now) {
  const b = monthBounds(month);
  const recipients = await prisma.assignmentRecipient.findMany({
    where: { studentId, assignment: { status: "SENT", examType: { in: EXAMS }, endDate: { gte: b.start, lte: b.end } } },
    include: {
      assignment: { select: { id: true, examType: true, subject: true, topic: true, pageRange: true, endDate: true, targetMode: true } },
      submission: { select: { correctCount: true, wrongCount: true, blankCount: true } },
    },
  });
  const inMonth = (d) => { const t = trDay(d); return t >= b.start && t <= b.end; };
  const sessions = (await prisma.studySession.findMany({ where: { studentId, examType: { in: EXAMS }, studyDate: { gte: new Date(b.start.getTime() - DAY), lte: new Date(b.end.getTime() + 2 * DAY) } } }))
    .filter((s) => inMonth(s.studyDate));
  // Aktif gün: AY İÇİNDE teslim edilen her ödev (vadesi hangi ayda olursa olsun) ya da serbest çalışma.
  const completions = (await prisma.assignmentRecipient.findMany({
    where: { studentId, completed: true, completedAt: { gte: new Date(b.start.getTime() - DAY), lte: new Date(b.end.getTime() + 2 * DAY) } },
    select: { completedAt: true },
  })).filter((r) => inMonth(r.completedAt));
  return { recipients, sessions, completions, b, now };
}

// Kişisel (koçun serbest metinle yazdığı) ödev konularında bir kişinin adı geçebilir — yapay zekâya gitmeden önce
// okuldaki herhangi bir kullanıcının ad/soyadını içeren konu "kişisel ödev konusu" diye maskelenir. Okul geneli ödev
// konuları yıllık plandan gelir, olduğu gibi kalır.
const FOLD = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
const foldWords = (t) => String(t || "").toLocaleLowerCase("tr-TR").replace(/[çğıöşüâîû]/g, (c) => FOLD[c] || c).split(/[^a-z0-9]+/).filter(Boolean);
async function nameTokens() {
  const users = await prisma.user.findMany({ select: { name: true } });
  return new Set(users.flatMap((u) => foldWords(u.name)).filter((w) => w.length >= 3));
}
const safeTopic = (topic, schoolWide, tokens) => (schoolWide || !foldWords(topic).some((w) => tokens.has(w)) ? topic : "kişisel ödev konusu");

export async function buildMonthlySummary(studentId, month, now = new Date()) {
  const student = await prisma.user.findUnique({ where: { id: studentId }, select: { gradeLevel: true, lastSeenAt: true } });
  const settings = await prisma.schoolSettings.findUnique({ where: { id: "singleton" } });
  const cur = await monthData(studentId, month, now);
  const prev = await monthData(studentId, prevMonth(month), now);

  const tokens = await nameTokens();
  // Okul karşılaştırması (yalnızca toplu, rapordaki kuralla aynı): aynı sınıf düzeyinde bu ödevi GEÇERLİ teslim etmiş
  // diğer öğrenciler (E biliniyorsa Q ≥ 0,8·E, bilinmiyorsa Q ≥ 10); 10'dan azsa tüm okul; orada da azsa yok.
  const swRecipients = cur.recipients.filter((r) => r.assignment.targetMode === "SCHOOL_WIDE");
  const swIds = swRecipients.map((r) => r.assignment.id);
  const expectedOf = new Map(swRecipients.map((r) => [r.assignment.id, questionCountOf(r.assignment.pageRange)]));
  const others = swIds.length ? await prisma.assignmentRecipient.findMany({
    where: { assignmentId: { in: swIds }, studentId: { not: studentId }, submission: { isNot: null } },
    select: { assignmentId: true, student: { select: { gradeLevel: true } }, submission: { select: { correctCount: true, wrongCount: true, blankCount: true } } },
  }) : [];
  const classByAssignment = new Map();
  for (const id of swIds) {
    const E = expectedOf.get(id);
    const valid = others.filter((o) => {
      if (o.assignmentId !== id) return false;
      const q = o.submission.correctCount + o.submission.wrongCount + o.submission.blankCount;
      return E ? q >= 0.8 * E : q >= 10;
    });
    const rate = (o) => pctOf(o.submission.correctCount, o.submission.wrongCount, o.submission.blankCount);
    const same = student?.gradeLevel ? valid.filter((o) => o.student.gradeLevel === student.gradeLevel) : [];
    const group = same.length >= MIN_CLASS ? same : valid;
    if (group.length >= MIN_CLASS) classByAssignment.set(id, group.map(rate));
  }

  const totals = agg();
  const bySubject = new Map();
  const byTopic = new Map();
  const skipReasons = { konuyuBilmiyorum: 0, zamanYetmedi: 0, kaynagimYok: 0, baskaSebep: 0 };
  const reasonKey = { KONU: "konuyuBilmiyorum", ZAMAN: "zamanYetmedi", KAYNAK: "kaynagimYok", DIGER: "baskaSebep" };
  const activeDays = new Set();
  let due = 0, done = 0, onTime = 0, fromSkip = 0, skipped = 0, missed = 0, open = 0;

  for (const r of cur.recipients) {
    const a = r.assignment;
    const key = `${a.examType} ${a.subject}`;
    const s = bySubject.get(key) || { ders: key, odev: 0, cozulen: 0, zamanindaCozulen: 0, pastanDonen: 0, pas: 0, yapilmayan: 0, sonuc: agg(), sinifFarklari: [] };
    s.odev += 1;
    const status = recipientStatus(r, now);
    if (status === "open") open += 1; else due += 1;
    if (status === "done") {
      done += 1; s.cozulen += 1;
      const intime = r.completedAt && r.completedAt.getTime() <= a.endDate.getTime() + TR_END_OF_DAY_GRACE_MS;
      if (intime) { onTime += 1; s.zamanindaCozulen += 1; }
      // Süresi içinde pas geçilip sonra çözülen ödev gecikme değil düzeltmedir.
      else if (r.priorSkippedAt && r.priorSkippedAt.getTime() <= a.endDate.getTime() + TR_END_OF_DAY_GRACE_MS) { fromSkip += 1; s.pastanDonen += 1; }
    }
    if (status === "skipped") { skipped += 1; s.pas += 1; if (reasonKey[r.skipReason]) skipReasons[reasonKey[r.skipReason]] += 1; }
    if (status === "missed") { missed += 1; s.yapilmayan += 1; }
    if (r.submission) {
      const { correctCount: c, wrongCount: w, blankCount: bl } = r.submission;
      add(totals, c, w, bl);
      add(s.sonuc, c, w, bl);
      const konu = safeTopic(a.topic, a.targetMode === "SCHOOL_WIDE", tokens);
      const t = byTopic.get(`${key}|${konu}`) || { ders: key, konu, sonuc: agg() };
      add(t.sonuc, c, w, bl);
      byTopic.set(`${key}|${konu}`, t);
      const cls = classByAssignment.get(a.id);
      const mine = pctOf(c, w, bl);
      if (cls && cls.length >= MIN_CLASS && mine != null) s.sinifFarklari.push(mine - medianOf(cls));
    }
    if (status === "skipped" && r.skipReason === "KONU") {
      const konu = safeTopic(a.topic, a.targetMode === "SCHOOL_WIDE", tokens);
      const t = byTopic.get(`${key}|${konu}`) || { ders: key, konu, sonuc: agg() };
      t.konuyuBilmiyorumPas = (t.konuyuBilmiyorumPas || 0) + 1;
      byTopic.set(`${key}|${konu}`, t);
    }
    bySubject.set(key, s);
  }

  const study = agg();
  const studyBySubject = {};
  for (const s of cur.sessions) {
    add(study, s.correctCount, s.wrongCount, s.blankCount);
    studyBySubject[`${s.examType} ${s.subject}`] = (studyBySubject[`${s.examType} ${s.subject}`] || 0) + s.correctCount + s.wrongCount + s.blankCount;
    activeDays.add(trDay(s.studyDate).getTime());
  }
  for (const r of cur.completions) {
    activeDays.add(trDay(r.completedAt).getTime());
  }

  // Önceki ayın ders başarıları (karşılaştırma).
  const prevBySubject = new Map();
  const prevTotals = agg();
  for (const r of prev.recipients) {
    if (!r.submission) continue;
    const key = `${r.assignment.examType} ${r.assignment.subject}`;
    const a = prevBySubject.get(key) || agg();
    add(a, r.submission.correctCount, r.submission.wrongCount, r.submission.blankCount);
    add(prevTotals, r.submission.correctCount, r.submission.wrongCount, r.submission.blankCount);
    prevBySubject.set(key, a);
  }

  const dersler = [...bySubject.values()].map((s) => {
    const sonuc = derive(s.sonuc);
    const p = prevBySubject.get(s.ders);
    return {
      ders: s.ders, odev: s.odev, cozulen: s.cozulen, zamanindaCozulen: s.zamanindaCozulen, pastanDonen: s.pastanDonen, pas: s.pas, yapilmayan: s.yapilmayan,
      ...sonuc,
      oncekiAyNetOrani: p ? derive(p).netOrani : null,
      okulMedyaninaGoreFark: s.sinifFarklari.length ? r1(s.sinifFarklari.reduce((x, y) => x + y, 0) / s.sinifFarklari.length) : null,
      veriAz: s.sonuc.kayit < 3 || s.sonuc.soru < 60,
    };
  }).sort((a, b) => (b.soru || 0) - (a.soru || 0));

  const konular = [...byTopic.values()].map((t) => ({ ders: t.ders, konu: t.konu, ...derive(t.sonuc), konuyuBilmiyorumPas: t.konuyuBilmiyorumPas || 0 }));
  const yeterli = konular.filter((t) => t.soru >= 20);
  const ykskalan = settings?.yksExamDate ? Math.ceil((settings.yksExamDate.getTime() - now.getTime()) / DAY) : null;

  return {
    ay: month,
    sinifDuzeyi: student?.gradeLevel ?? null,
    yksyeKalanGun: ykskalan != null && ykskalan > 0 ? ykskalan : null,
    sonGiristenBuyanaGun: student?.lastSeenAt ? Math.floor((now.getTime() - student.lastSeenAt.getTime()) / DAY) : null,
    odevDuzeni: { verilen: cur.recipients.length, suresiDolan: due, cozulen: done, zamanindaCozulen: onTime, pastanDonen: fromSkip, pasGecilen: skipped, yapilmayan: missed, suresiDolmayan: open, pasSebepleri: skipReasons },
    toplam: derive(totals),
    oncekiAyToplam: prevTotals.soru ? derive(prevTotals) : null,
    dersler,
    oncelikliKonular: [...yeterli].sort((a, b) => a.netOrani - b.netOrani).slice(0, 5),
    enGucluKonular: [...yeterli].sort((a, b) => b.netOrani - a.netOrani).slice(0, 5),
    konuyuBilmiyorumDenilenKonular: konular.filter((t) => t.konuyuBilmiyorumPas > 0).map((t) => `${t.ders} — ${t.konu}`),
    serbestCalisma: { kayit: cur.sessions.length, ...derive(study), dersDagilimiSoru: studyBySubject },
    aktifGunSayisi: activeDays.size,
  };
}
