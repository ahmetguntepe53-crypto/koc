// Haftalık özet bildirimleri — zamanlayıcının iki adımı (bkz. scheduler.js > runSchedulerTick):
//  • Öğrenci: Pazar 19:00'dan (TR) sonra, ISO hafta başına BİR KEZ — "Bu hafta: 4/5 ödev · 3 gün çalıştın · 180 soru."
//    ve tek bir olumlu ya da "sonraki adım" cümlesi. O hafta ne ödevi ne kaydı olan öğrenciye gitmez.
//  • Koç: Pazartesi 08:00'den (TR) sonra, BİR KEZ — geçen haftanın yalnızca SAYILARI, yalnızca kendi öğrencilerinden
//    (student.teacherId === koç): "Geçen hafta öğrencilerin: 22/26 ödev teslim · 3 sessiz ödev · 1 öğrenci en az 7
//    gündür kayıt girmedi." Öğrenci adı bildirime girmez (kilit ekranında görünür; ayrıntı Öğrencilerim'de).
//
// Sayılar istemcideki raporla aynı kurallarla (src/reportModel.js): hafta Pzt–Paz (Türkiye takvimi, bkz. weekStats.js >
// trWeekRange); "ödev" = bitiş günü o haftada olan gönderilmiş ödev, x/y'deki x = teslim + pas ("ele alınan", öğrencinin
// Gelişim ekranındaki BU HAFTA kartı gibi); kayıt = teslim edilmiş ödev sonucu (teslim günü) + serbest çalışma (çalışma
// günü), aynı gün/ders/D-Y-B'li serbest kayıt ödevin kopyası sayılıp atlanır; seri = sessiz ödevsiz ve ≥ 3 aktif günlü
// haftalar. İstemcinin "takip dışı AYT dersi" ayıklaması burada yok (tüm gönderilmiş ödevler sayılır — koç panosundaki
// haftalık kartla, routes/teacher.js, aynı).
//
// Tekrar ve yarıda kalma: WeeklyDigestRun (hafta × tür) satırı turu "sahiplenir" — aynı hafta ikinci kez başlamaz;
// süreç yarıda çökerse 15 dakika sonra başka bir tur devralır ve özetini almamış kullanıcılara tamamlar (kullanıcı
// başına tekrar, Notification.data.week ile engellenir). Aylık rapor bildirimiyle aynı desen (notifyMonthlyReports).
// Sessiz saatlere (23:00–07:00) notifyUser zaten uyar; zamanlayıcı o saatlerde hiç çalışmaz.
import { prisma } from "./db.js";
import { notifyUser } from "./notify.js";
import { trHour, trTodayAsDateOnly, TR_UTC_OFFSET_MS } from "./quietHours.js";
import { trWeekRange, recipientStatus } from "./weekStats.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
// Pazar akşamı: okul ve etütten sonra, sessiz saatlerden (23:00) önce.
export const STUDENT_DIGEST_TR_HOUR = 19;
// Pazartesi sabahı: koç güne başlarken.
export const COACH_DIGEST_TR_HOUR = 8;
// Pazartesi sunucu kapalıysa koç özeti Çarşamba'ya kadar yetişir ("geçen hafta" hâlâ doğru); öğrenci özeti yalnız
// Pazar akşamı gider — Pazartesi "Bu hafta:" diye başlayan bir özet yanlış olurdu.
const COACH_CATCH_UP_DAYS = 3;
// Seri hesabının geriye bakışı — istemcideki gibi en fazla 52 hafta.
const STREAK_WEEKS = 52;
// Sorgular öğrenci kümeleriyle (tek tek değil) yapılır.
const CHUNK = 100;
// Yarıda kalan tur bu kadar süre ilerlemezse devralınır.
const TAKEOVER_MS = 15 * 60 * 1000;

// ------------------------------------------------------------------------------------------------ tarih yardımcıları
// Türkiye takvim günü (1970-01-01'den gün sayısı) — istemcideki trDay ile aynı. Tarih-yalnız alanlar (endDate, UTC gece
// yarısı) da doğru güne düşer (+3 saat günü değiştirmez).
const trDay = (d) => Math.floor((new Date(d).getTime() + TR_UTC_OFFSET_MS) / DAY_MS);
// Pazartesi = 0 … Pazar = 6 (Türkiye takvimi).
const trDow = (now) => (trTodayAsDateOnly(now).getUTCDay() + 6) % 7;
// ISO hafta anahtarı ("2026-W39") — haftanın Perşembe'sinin yılı ISO yılıdır (yıl dönümündeki haftalar).
export function isoWeekKey(mon) {
  const dow = (mon.getUTCDay() + 6) % 7;
  const thu = new Date(mon.getTime() + (3 - dow) * DAY_MS);
  const year = thu.getUTCFullYear();
  const week = Math.floor((thu.getTime() - Date.UTC(year, 0, 1)) / WEEK_MS) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}
// Binlik nokta (1250 → "1.250"); sunucunun ICU kurulumuna bağlı kalmasın diye elle.
const fmtInt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

// ------------------------------------------------------------------------------------------------ tur sahiplenme
// Satır yoksa oluşturulur; varsa ve bitmediyse 15 dakikadır ilerlemiyorsa devralınır. true → bu tur gönderir.
async function claimRun(week, kind, now) {
  const where = { week_kind: { week, kind } };
  const run = await prisma.weeklyDigestRun.findUnique({ where });
  if (run?.completedAt) return false;
  if (!run) {
    try {
      await prisma.weeklyDigestRun.create({ data: { week, kind, sentAt: now } });
      return true;
    } catch (e) {
      if (e?.code === "P2002") return false; // başka bir tur az önce sahiplendi
      throw e;
    }
  }
  if (now.getTime() - run.sentAt.getTime() < TAKEOVER_MS) return false;
  const taken = await prisma.weeklyDigestRun.updateMany({ where: { week, kind, completedAt: null, sentAt: run.sentAt }, data: { sentAt: now } });
  return taken.count > 0;
}
const finishRun = (week, kind, now) => prisma.weeklyDigestRun.update({ where: { week_kind: { week, kind } }, data: { completedAt: now } });
// Bu hafta için özetini zaten almış kullanıcılar (yarıda kalan turdan).
async function alreadyNotified(type, week) {
  const rows = await prisma.notification.findMany({ where: { type, data: { path: ["week"], equals: week } }, select: { userId: true } });
  return new Set(rows.map((r) => r.userId));
}

// ------------------------------------------------------------------------------------------------ öğrenci özeti
// Öğrenci kümesinin haftalık sayıları: Map<studentId, { total, handled, open, activeDays, Q, prevQ, streak, nextMonOpen,
// nextWeekOpen }>. curMon: bu haftanın Pazartesi'si (TR günü), today: bugün (TR günü).
export async function studentWeekStats(studentIds, now) {
  const today = trDay(now);
  const curMon = trDay(trWeekRange(now).mon);
  const startDay = curMon - STREAK_WEEKS * 7;
  const startDate = new Date(startDay * DAY_MS); // TR günü → o günün UTC gece yarısı (tarih-yalnız biçim)
  const startTs = new Date(startDay * DAY_MS - TR_UTC_OFFSET_MS); // o günün Türkiye'deki başlangıcı (anlık değerler için)
  const nextSun = new Date((curMon + 13) * DAY_MS);
  const [recipients, sessions] = await Promise.all([
    // Seri penceresinde bitişi olan ödevler (ödev sayıları, seri, gelecek haftanın açıkları) + pencerede teslim edilen
    // her ödev (bitişi daha eskiyse de o günün kaydıdır).
    prisma.assignmentRecipient.findMany({
      where: {
        studentId: { in: studentIds }, assignment: { status: "SENT" },
        OR: [{ assignment: { endDate: { gte: startDate, lte: nextSun } } }, { completed: true, completedAt: { gte: startTs } }],
      },
      select: {
        studentId: true, completed: true, completedAt: true, skippedAt: true,
        assignment: { select: { endDate: true, examType: true, subject: true } },
        submission: { select: { correctCount: true, wrongCount: true, blankCount: true } },
      },
    }),
    prisma.studySession.findMany({
      where: { studentId: { in: studentIds }, studyDate: { gte: startTs } },
      select: { studentId: true, studyDate: true, examType: true, subject: true, correctCount: true, wrongCount: true, blankCount: true },
    }),
  ]);
  const per = new Map(studentIds.map((id) => [id, { items: [], records: [] }]));
  for (const r of recipients) {
    const p = per.get(r.studentId);
    const endDay = trDay(r.assignment.endDate);
    if (endDay >= startDay) p.items.push({ endDay, handled: r.completed || !!r.skippedAt });
    if (r.completed && r.completedAt && r.submission) {
      const s = r.submission;
      p.records.push({ day: trDay(r.completedAt), key: `${r.assignment.examType}|${r.assignment.subject}`, D: s.correctCount, Y: s.wrongCount, B: s.blankCount });
    }
  }
  for (const s of sessions) {
    per.get(s.studentId).records.push({ day: trDay(s.studyDate), key: `${s.examType}|${s.subject}`, D: s.correctCount, Y: s.wrongCount, B: s.blankCount, free: true });
  }

  const out = new Map();
  for (const [id, { items, records: all }] of per) {
    // Ödev sonucu serbest çalışma olarak da girilmişse (eski istemciler) iki kez sayılmaz — reportModel.js ile aynı imza.
    const hwSig = new Set(all.filter((r) => !r.free).map((r) => `${r.day}|${r.key}|${r.D}|${r.Y}|${r.B}`));
    const records = all.filter((r) => !r.free || !hwSig.has(`${r.day}|${r.key}|${r.D}|${r.Y}|${r.B}`));
    const activeSet = new Set(records.map((r) => r.day));
    const activeIn = (a, b) => { let n = 0; for (let d = a; d <= b; d++) if (activeSet.has(d)) n += 1; return n; };
    const qIn = (a, b) => records.filter((r) => r.day >= a && r.day <= b).reduce((q, r) => q + r.D + r.Y + r.B, 0);

    const week = items.filter((it) => it.endDay >= curMon && it.endDay <= curMon + 6);
    const handled = week.filter((it) => it.handled).length;
    // Seri (reportModel.js > weekStatus): vadesi gelen her ödev ele alınmış (sessiz yok) VE ≥ 3 aktif gün → "ok";
    // ödevsiz ve < 3 aktif günlük hafta nötr; içinde bulunulan hafta koşulu sağlamadıkça seriyi kırmaz.
    // İlk verinin haftasından (en fazla 52 hafta geriden) bu haftaya.
    const firstDay = Math.min(today, ...records.map((r) => r.day), ...items.map((it) => it.endDay));
    let streak = 0;
    for (let m = Math.max(startDay, curMon - 7 * Math.ceil((curMon - firstDay) / 7)); m <= curMon; m += 7) {
      const wItems = items.filter((it) => it.endDay >= m && it.endDay <= m + 6);
      const silent = wItems.filter((it) => !it.handled && it.endDay < today).length;
      const active = activeIn(m, Math.min(m + 6, today));
      if (!wItems.length && active < 3) continue;
      if (silent === 0 && active >= 3) streak += 1;
      else if (m !== curMon) streak = 0;
    }
    out.set(id, {
      total: week.length, handled, open: week.length - handled,
      activeDays: activeIn(curMon, curMon + 6), Q: qIn(curMon, curMon + 6), prevQ: qIn(curMon - 7, curMon - 1), streak,
      nextMonOpen: items.filter((it) => it.endDay === curMon + 7 && !it.handled).length,
      nextWeekOpen: items.filter((it) => it.endDay >= curMon + 7 && it.endDay <= curMon + 13 && !it.handled).length,
    });
  }
  return out;
}

// Öğrenci bildirimi metni (saf; testlerde doğrudan da sınanır). null → gönderilmez (ne ödev ne kayıt).
// Sayılar yalın yazılır, eki arkadaki sabit kelime taşır ("3 gün", "2 haftadır"); olumsuz hüküm yok — kayıt yoksa
// "henüz kayıt yok", açık ödev varsa "sonucunu girerek kapatabilirsin" (sonraki adım).
export function studentDigestText(s) {
  if (!s || (s.total === 0 && s.activeDays === 0)) return null;
  const parts = [];
  if (s.total > 0) parts.push(`${s.handled}/${s.total} ödev`);
  parts.push(s.activeDays > 0 ? `${s.activeDays} gün çalıştın` : "henüz kayıt yok");
  if (s.Q > 0) parts.push(`${fmtInt(s.Q)} soru`);
  return `Bu hafta: ${parts.join(" · ")}. ${studentClause(s)}`;
}
// Tek cümle — önce olumlu bir şey (hafta kapandı · seri · soru artışı), yoksa bir sonraki adım.
function studentClause(s) {
  if (s.total > 0 && s.handled === s.total) return s.total === 1 ? "Haftanın ödevini kapattın!" : "Haftanın bütün ödevlerini kapattın!";
  if (s.streak >= 2) return `${s.streak} haftadır serin sürüyor!`;
  const up = s.Q - s.prevQ;
  if (s.prevQ > 0 && up >= 20 && up >= s.prevQ * 0.1) return `Geçen haftadan ${fmtInt(up)} soru fazla!`;
  if (s.open > 0) return `Açık kalan ${s.open} ödevin sonucunu girerek haftayı kapatabilirsin.`;
  if (s.nextMonOpen > 0) return `Pazartesi için ${s.nextMonOpen} açık ödevin var.`;
  if (s.nextWeekOpen > 0) return `Yeni haftada ${s.nextWeekOpen} ödevin seni bekliyor.`;
  return "Yeni haftaya 20 soruluk bir setle başlayabilirsin.";
}

export async function notifyStudentWeeklyDigest(now) {
  if (trDow(now) !== 6 || trHour(now) < STUDENT_DIGEST_TR_HOUR) return;
  const week = isoWeekKey(trWeekRange(now).mon);
  if (!(await claimRun(week, "student", now))) return;
  const done = await alreadyNotified("weekly_digest", week);
  const students = await prisma.user.findMany({ where: { role: "STUDENT", banned: false }, select: { id: true }, orderBy: { id: "asc" } });
  for (const ids of chunks(students.map((s) => s.id).filter((id) => !done.has(id)), CHUNK)) {
    const stats = await studentWeekStats(ids, now);
    for (const id of ids) {
      try {
        const text = studentDigestText(stats.get(id));
        if (text) await notifyUser(id, text, { type: "weekly_digest", data: { screen: "reports", week }, now });
      } catch (e) {
        console.error(`[scheduler] haftalık özet gönderilemedi (öğrenci ${id}):`, e.message);
      }
    }
  }
  await finishRun(week, "student", now);
}

// ------------------------------------------------------------------------------------------------ koç özeti
// Koçun kendi (askıda olmayan) öğrencilerinin geçen haftası: bitişi geçen hafta olan gönderilmiş ödevler (teslim · pas ·
// sessiz — sessiz: recipientStatus "missed", koç panosu ve zamanlayıcının gecikme kuralı) ve en az 7 gündür kaydı
// olmayan öğrenci sayısı (istemcideki "son kayıt ≥ 7 gün" ile aynı: son 7 TR gününde — bugün dahil — kayıt yok). Hesabı
// 7 günden yeni öğrenci sayılmaz (henüz kayıt girecek zamanı olmadı).
export async function coachWeekStats(coachIds, now) {
  const { mon, prevMon } = trWeekRange(now);
  const prevSun = new Date(mon.getTime() - DAY_MS);
  const today = trDay(now);
  const since = new Date((today - 6) * DAY_MS - TR_UTC_OFFSET_MS); // 6 gün önceki TR gününün başlangıcı
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", banned: false, teacherId: { in: coachIds } },
    select: { id: true, teacherId: true, createdAt: true },
  });
  const ids = students.map((s) => s.id);
  const [recipients, recentSubs, recentSessions] = await Promise.all([
    prisma.assignmentRecipient.findMany({
      where: { studentId: { in: ids }, assignment: { status: "SENT", endDate: { gte: prevMon, lte: prevSun } } },
      select: { studentId: true, completed: true, skippedAt: true, assignment: { select: { endDate: true } } },
    }),
    prisma.assignmentRecipient.findMany({ where: { studentId: { in: ids }, completed: true, completedAt: { gte: since } }, select: { studentId: true }, distinct: ["studentId"] }),
    prisma.studySession.findMany({ where: { studentId: { in: ids }, studyDate: { gte: since } }, select: { studentId: true }, distinct: ["studentId"] }),
  ]);
  const recent = new Set([...recentSubs, ...recentSessions].map((r) => r.studentId));
  const coachOf = new Map(students.map((s) => [s.id, s.teacherId]));
  const out = new Map(coachIds.map((id) => [id, { students: 0, total: 0, completed: 0, skipped: 0, silent: 0, inactive: 0 }]));
  for (const s of students) {
    const c = out.get(s.teacherId);
    c.students += 1;
    if (!recent.has(s.id) && trDay(s.createdAt) <= today - 7) c.inactive += 1;
  }
  for (const r of recipients) {
    const c = out.get(coachOf.get(r.studentId));
    const status = recipientStatus(r, now);
    c.total += 1;
    if (status === "done") c.completed += 1;
    else if (status === "skipped") c.skipped += 1;
    else if (status === "missed") c.silent += 1;
  }
  return out;
}

// Koç bildirimi metni (saf). null → gönderilmez (geçen hafta ödev yok ve kayıtsız öğrenci yok: söylenecek sayı yok).
export function coachDigestText(c) {
  if (!c || c.students === 0 || (c.total === 0 && c.inactive === 0)) return null;
  const parts = [];
  if (c.total > 0) {
    parts.push(`${c.completed}/${c.total} ödev teslim`);
    if (c.skipped > 0) parts.push(`${c.skipped} pas`);
    parts.push(c.silent > 0 ? `${c.silent} sessiz ödev` : "sessiz ödev yok");
  } else parts.push("vadesi gelen ödev yok");
  if (c.inactive > 0) parts.push(`${c.inactive} öğrenci en az 7 gündür kayıt girmedi`);
  return `Geçen hafta öğrencilerin: ${parts.join(" · ")}.`;
}

export async function notifyCoachWeeklyDigest(now) {
  const dow = trDow(now);
  if (dow >= COACH_CATCH_UP_DAYS || trHour(now) < COACH_DIGEST_TR_HOUR) return;
  const week = isoWeekKey(trWeekRange(now).prevMon);
  if (!(await claimRun(week, "coach", now))) return;
  const done = await alreadyNotified("weekly_digest_coach", week);
  const coaches = await prisma.user.findMany({
    where: { role: "TEACHER", banned: false, students: { some: { banned: false, role: "STUDENT" } } },
    select: { id: true }, orderBy: { id: "asc" },
  });
  for (const ids of chunks(coaches.map((c) => c.id).filter((id) => !done.has(id)), CHUNK)) {
    const stats = await coachWeekStats(ids, now);
    for (const id of ids) {
      try {
        const text = coachDigestText(stats.get(id));
        if (text) await notifyUser(id, text, { type: "weekly_digest_coach", data: { screen: "students", week }, now });
      } catch (e) {
        console.error(`[scheduler] haftalık koç özeti gönderilemedi (koç ${id}):`, e.message);
      }
    }
  }
  await finishRun(week, "coach", now);
}
