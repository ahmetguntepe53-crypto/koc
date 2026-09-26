import { prisma } from "./db.js";
import { notifyUser, flushPendingPushes } from "./notify.js";
import { publishPlanEntry } from "./routes/planEntries.js";
import { notifyRecipientsAssignmentSent } from "./routes/assignments.js";
import { isQuietHours, trHour, trStartOfToday, trTodayAsDateOnly } from "./quietHours.js";
import { alert } from "./alerts.js";
import { notifyStudentWeeklyDigest, notifyCoachWeeklyDigest } from "./weeklyDigest.js";
import { notifyReviewReminders } from "./reviewReminders.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// endDate UTC gece yarısı olarak saklanır (bkz. planEntries.js > parseDateOnly, assignments.js'in
// tarih parse'ı) — yani "10 Eylül"ü ifade eden değer aslında 10 Eylül 00:00 UTC, ki bu Türkiye'de
// (UTC+3, DST yok) zaten 10 Eylül 03:00 demektir. Ham `endDate < now` karşılaştırması bu yüzden
// "gecikti" durumunu günün bitişinden ~21 saat ÖNCE, günün başında tetikliyordu. Doğrusu: bugün,
// bitiş gününün TÜRKİYE'deki sonunu (bir sonraki günün Türkiye 00:00'ı = aynı UTC gün 21:00) geçmiş
// olmalı — bu da `endDate < (now - 21 saat)` ile eşdeğer.
const TR_END_OF_DAY_GRACE_MS = 21 * 60 * 60 * 1000;
// "Bugün son gün" hatırlatmasının saati (Türkiye) — okul çıkışından sonra, sessiz saatlerden önce.
const DUE_REMINDER_TR_HOUR = 18;

// Sessiz saatler (Türkiye saatiyle 23:00-07:00, bkz. quietHours.js): tarihler UTC gece yarısı
// saklandığı için otomatik yayınlar (ve yüksek öncelikli push'ları) Türkiye'de ~03:00'te, gecikme
// hatırlatmaları ~00:00'da öğrencilerin telefonunu çaldırıyordu. Bu aralıkta tick hiçbir şey yapmaz;
// sorgular "vakti gelmiş ya da geçmiş" diye yazıldığı için bekleyen her şey 07:00'deki ilk tick'te yetişir.

// Ödev, bitiş gününün Türkiye'deki sonundan SONRA yayınlandıysa (ör. koç geçmiş tarihli bir ödevi
// bugün gönderdiyse) öğrenciye/koça "süresi geçti" bildirimi anlamsız ve kafa karıştırıcı — atlanır.
function publishedAfterDeadline(assignment) {
  return !!assignment.sentAt && assignment.sentAt.getTime() > assignment.endDate.getTime() + TR_END_OF_DAY_GRACE_MS;
}

// Otomatik gönderilmesi gereken DRAFT ödevleri bulur ve yayınlar:
// AUTO_ON_DATE    — scheduledDate gelmiş/geçmişse
// AUTO_DAY_BEFORE — scheduledDate'e 1 günden az kalmışsa (yani "bir gün önce" penceresine girmişse)
// MANUAL_NOW zaten oluşturulduğu anda published olduğu için burada hiç görünmez.
async function publishDueAssignments(now) {
  const inOneDay = new Date(now.getTime() + ONE_DAY_MS);
  const due = await prisma.assignment.findMany({
    where: {
      status: "DRAFT",
      OR: [
        { sendMode: "AUTO_ON_DATE", scheduledDate: { lte: now } },
        { sendMode: "AUTO_DAY_BEFORE", scheduledDate: { lte: inOneDay } },
      ],
    },
    include: { recipients: { select: { id: true, studentId: true } }, teacher: { select: { name: true } } },
  });
  for (const assignment of due) {
    try {
      // Koşulsuz update yerine "hâlâ DRAFT ise" sahiplenme: aynı anda koç "şimdi gönder"e bastıysa
      // ya da ödevi sildiyse count 0 döner ve bildirim İKİNCİ kez gitmez / P2025 fırlamaz.
      const claim = await prisma.assignment.updateMany({ where: { id: assignment.id, status: "DRAFT" }, data: { status: "SENT", sentAt: now } });
      if (claim.count === 0) continue;
      // Her öğrenciye KENDİ AssignmentRecipient.id'siyle bildirim gider — öğrenci tarafındaki
      // AssignmentSubmitScreen recipientId ile açılır (assignment.id ile değil), bkz. App.jsx.
      await notifyRecipientsAssignmentSent(assignment, assignment.teacher.name);
    } catch (e) {
      // Tek bir ödevin hatası partinin geri kalanını durdurmasın.
      console.error(`[scheduler] ödev otomatik yayınlanamadı (${assignment.id}):`, e.message);
    }
  }
}

// Yıllık Takvim'de autoSend ON_DATE/DAY_BEFORE işaretlenmiş, henüz yayınlanmamış (assignmentId=null)
// kayıtları bulur ve publishPlanEntry ile gerçek bir Assignment'a çevirir — koçun her gün/ders elle
// "Yayınla"ya basmasına gerek kalmaz. Bir kaydın yayınlanması başarısız olursa (ör. o sınav
// türünde artık hiç öğrenci kalmamış) yalnızca o kayıt atlanır, diğer koçların/kayıtların
// yayınlanmasını engellemez.
async function publishDuePlanEntries(now) {
  const inOneDay = new Date(now.getTime() + ONE_DAY_MS);
  const due = await prisma.planEntry.findMany({
    where: {
      assignmentId: null,
      OR: [
        { autoSend: "ON_DATE", date: { lte: now } },
        { autoSend: "DAY_BEFORE", date: { lte: inOneDay } },
      ],
    },
  });
  const todayStart = trStartOfToday(now);
  for (const entry of due) {
    try {
      await publishPlanEntry(entry);
    } catch (e) {
      console.error(`[scheduler] takvim kaydı otomatik yayınlanamadı (${entry.id}):`, e.message);
      // Günü geçmiş bir kayıt yayınlanamıyorsa otomatik gönderimi kapatılır: aksi halde her 60 sn'de
      // sonsuza dek yeniden denenir ve (ör. koça sonradan öğrenci atanınca) haftalarca birikmiş
      // geçmiş kayıtların hepsi aynı anda öğrencilere yağardı. Koç isterse elle yayınlayabilir.
      // Çok günlük kayıtta son gün (endDate) esas alınır — hâlâ süren bir kayıt kapatılmaz.
      if ((entry.endDate || entry.date) < todayStart) {
        try {
          await prisma.planEntry.updateMany({ where: { id: entry.id, assignmentId: null }, data: { autoSend: "OFF" } });
          console.error(`[scheduler] takvim kaydının (${entry.id}) tarihi geçtiği için otomatik gönderimi kapatıldı`);
        } catch (e2) {
          console.error(`[scheduler] takvim kaydının (${entry.id}) otomatik gönderimi kapatılamadı:`, e2.message);
        }
      }
    }
  }
}

// Öğrencinin satırlarını gruplar — Pazartesi sabahı 7 dersin gecikmesi ya da Pazar akşamı 5 dersin
// son günü ayrı ayrı 7 push olarak değil, öğrenci başına tek bildirim olarak gider.
function groupByStudent(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.studentId)) map.set(r.studentId, []);
    map.get(r.studentId).push(r);
  }
  return map;
}

function subjectList(rows) {
  return [...new Set(rows.map((r) => r.assignment.subject))].join(", ");
}

// Bitiş günü BUGÜN olan, hâlâ tamamlanmamış ödevler için 18:00'den sonra öğrenciye BİR KEZ "bugün son
// gün" hatırlatması. Bugün yayınlanmış ödev atlanır (yeni ödev bildirimi zaten "son gün" diyordu).
async function notifyDueToday(now) {
  if (trHour(now) < DUE_REMINDER_TR_HOUR) return;
  const today = trTodayAsDateOnly(now);
  const todayStart = trStartOfToday(now);
  const rows = await prisma.assignmentRecipient.findMany({
    where: {
      completed: false, skippedAt: null, dueReminderSentAt: null, overdueReminderSentAt: null,
      assignment: { status: "SENT", endDate: { gte: today, lt: new Date(today.getTime() + ONE_DAY_MS) } },
    },
    include: { assignment: { select: { subject: true, topic: true, sentAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  for (const [studentId, list] of groupByStudent(rows)) {
    try {
      const remind = list.filter((r) => !r.assignment.sentAt || r.assignment.sentAt < todayStart);
      if (remind.length === 1) {
        const [r] = remind;
        await notifyUser(studentId, `Bugün son gün: "${r.assignment.subject} — ${r.assignment.topic}" ödevini henüz bitirmedin.`, { type: "assignment_due", data: { screen: "assignmentSubmit", recipientId: r.id }, now });
      } else if (remind.length > 1) {
        await notifyUser(studentId, `Bugün son gün — ${remind.length} ödevin henüz bitmedi: ${subjectList(remind)}.`, { type: "assignment_due", data: { screen: "home" }, now });
      }
      // Atlananlar da işaretlenir, her tick'te yeniden sorgulanmasın.
      await prisma.assignmentRecipient.updateMany({ where: { id: { in: list.map((r) => r.id) } }, data: { dueReminderSentAt: now } });
    } catch (e) {
      console.error(`[scheduler] son gün hatırlatması gönderilemedi (student ${studentId}):`, e.message);
    }
  }
}

// Süresi (endDate) geçmiş ama hâlâ tamamlanmamış (completed=false) ödevler için öğrenciye BİR KEZ
// hatırlatma — overdueReminderSentAt null olan kayıtlar aranır, bildirim atılınca hemen doldurulur ki
// bir sonraki tick'te (60sn sonra) aynı öğrenciye tekrar tekrar gitmesin. Aynı anda birden çok ödevi
// gecikmişse tek bildirimde toplanır.
async function notifyOverdueRecipients(now) {
  const cutoff = new Date(now.getTime() - TR_END_OF_DAY_GRACE_MS);
  const overdue = await prisma.assignmentRecipient.findMany({
    where: { completed: false, skippedAt: null, overdueReminderSentAt: null, assignment: { status: "SENT", endDate: { lt: cutoff } } },
    include: { assignment: { select: { subject: true, topic: true, sentAt: true, endDate: true } } },
    orderBy: { createdAt: "asc" },
  });
  for (const [studentId, list] of groupByStudent(overdue)) {
    try {
      // Geç yayınlanmış ödevde bildirim atlanır ama satır yine işaretlenir, tekrar sorgulanmasın.
      const remind = list.filter((r) => !publishedAfterDeadline(r.assignment));
      if (remind.length === 1) {
        const [r] = remind;
        await notifyUser(studentId, `"${r.assignment.subject} — ${r.assignment.topic}" ödevinin süresi geçti, henüz tamamlamadın — unutmadan bitirebilirsin.`, { type: "assignment_overdue", data: { screen: "assignmentSubmit", recipientId: r.id }, now });
      } else if (remind.length > 1) {
        await notifyUser(studentId, `${remind.length} ödevinin süresi geçti, henüz tamamlamadın: ${subjectList(remind)} — unutmadan bitirebilirsin.`, { type: "assignment_overdue", data: { screen: "home" }, now });
      }
      await prisma.assignmentRecipient.updateMany({ where: { id: { in: list.map((r) => r.id) } }, data: { overdueReminderSentAt: now } });
    } catch (e) {
      console.error(`[scheduler] gecikme hatırlatması gönderilemedi (student ${studentId}):`, e.message);
    }
  }
}

// Aylık rapor bildirimi: ayın ilk haftasında (08:00'den sonra) önceki ayın raporları hazır diye her koça
// BİR bildirim — dokununca "Aylık raporlar" ekranı açılır (öğrenci öğrenci inceleme + PDF). Ayda bir kez:
// MonthlyReportRun satırı "sahiplenilir" (birincil anahtar), ikinci kez oluşturulamaz. Sunucu 1'inde kapalı
// olsa bile ilk hafta içinde yetişir.
const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
async function notifyMonthlyReports(now) {
  const tr = new Date(now.getTime() + 3 * 3600e3);
  if (tr.getUTCDate() > 7 || trHour(now) < 8) return;
  const prev = new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth() - 1, 1));
  const month = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  // Ayı sahiplen: satır yoksa oluştur; varsa ve bitmediyse 15 dakikadır ilerlemiyorsa (çökme/yeniden başlatma) devral.
  const run = await prisma.monthlyReportRun.findUnique({ where: { month } });
  if (run?.completedAt) return;
  if (!run) {
    try {
      await prisma.monthlyReportRun.create({ data: { month, sentAt: now } });
    } catch (e) {
      if (e?.code === "P2002") return; // başka bir tur az önce sahiplendi
      throw e;
    }
  } else {
    if (now.getTime() - run.sentAt.getTime() < 15 * 60 * 1000) return;
    const taken = await prisma.monthlyReportRun.updateMany({ where: { month, completedAt: null, sentAt: run.sentAt }, data: { sentAt: now } });
    if (!taken.count) return;
  }
  const coaches = await prisma.user.findMany({
    where: { role: "TEACHER", banned: false, students: { some: { banned: false } } },
    select: { id: true, _count: { select: { students: { where: { banned: false } } } } },
  });
  for (const c of coaches) {
    try {
      // Yarıda kalan bir turdan sonra devralınırsa aynı koça ikinci bildirim gitmez.
      const already = await prisma.notification.findFirst({ where: { userId: c.id, type: "monthly_report", data: { path: ["month"], equals: month } }, select: { id: true } });
      if (already) continue;
      await notifyUser(c.id, `${MONTHS_TR[prev.getUTCMonth()]} ayı raporları hazır — ${c._count.students} öğrencinin aylık gelişim raporunu incele; hepsini tek PDF olarak da alabilirsin.`, {
        type: "monthly_report", data: { screen: "monthlyReports", month }, now,
      });
    } catch (e) {
      console.error(`[scheduler] aylık rapor bildirimi gönderilemedi (koç ${c.id}):`, e.message);
    }
  }
  await prisma.monthlyReportRun.update({ where: { month }, data: { completedAt: now } });
}

// Süresi geçmiş bir ödevde hâlâ tamamlamamış öğrenci varsa koça BİR KEZ özet bildirimi gönderir —
// teacherOverdueNotifiedAt null olan ödevler aranır; tamamlanma durumu ne olursa olsun (hepsi
// bitirmiş olsa bile) işlendikten hemen sonra doldurulur, aynı ödev için ikinci kez kontrol edilmez.
async function notifyTeachersOfOverdueAssignments(now) {
  const cutoff = new Date(now.getTime() - TR_END_OF_DAY_GRACE_MS);
  const assignments = await prisma.assignment.findMany({
    where: { status: "SENT", endDate: { lt: cutoff }, teacherOverdueNotifiedAt: null },
    include: { recipients: { select: { completed: true, skippedAt: true } } },
  });
  for (const a of assignments) {
    try {
      // Pas geçen öğrenci sebebini bildirdi — "hâlâ tamamlamadı" sayılmaz.
      const missing = a.recipients.filter((r) => !r.completed && !r.skippedAt).length;
      if (missing > 0 && !publishedAfterDeadline(a)) {
        const text = `"${a.subject} — ${a.topic}" ödevinin süresi geçti — ${missing}/${a.recipients.length} öğrenci hâlâ tamamlamadı.`;
        await notifyUser(a.teacherId, text, { type: "assignment_overdue_summary", data: { screen: "assignmentDetail", assignmentId: a.id }, now });
      }
      // Bildirim gerekmese bile (herkes tamamlamış ya da ödev geç yayınlanmış) işaretlenir — aksi
      // halde bu ödev her tick'te yeniden sorgulanmaya devam eder.
      await prisma.assignment.update({ where: { id: a.id }, data: { teacherOverdueNotifiedAt: now } });
    } catch (e) {
      console.error(`[scheduler] öğretmen gecikme özeti gönderilemedi (assignment ${a.id}):`, e.message);
    }
  }
}

// Zamanlayıcının sağlığı (süreç belleğinde) — /api/health (app.js) ve index.js'teki gözcü okur. Adım patlarsa uyarı
// e-postası gider (alerts.js); ama tur bir await'te ASILI kalırsa (yanıt vermeyen DB bağlantısı vb.) hiçbir şey
// fırlatmaz, `running` kilidi yüzünden sonraki turlar da sessizce atlanır — bunu yalnız "son tamamlanan tur ne zaman"
// sorusu yakalar. Zamanlar DUVAR SAATİ (new Date()), turun `now` parametresi değil: testler geçmiş/gelecek bir anla tur
// çalıştırır, sağlık ise gerçek zamanda "kaç dakikadır tur bitmedi" diye bakar.
export const SCHEDULER_STALE_MS = 10 * 60 * 1000;
const health = { runningSince: null, lastTickAt: null, lastTickOk: null, failedSteps: [] };

// index.js zamanlayıcıyı BU süreçte başlatınca çağırır. Çağrılmadıysa (testler, PM2'de 0 dışındaki kopyalar)
// /api/health zamanlayıcıya hiç bakmaz — başka kopyanın işini burada "durmuş" saymak yanlış alarm olurdu.
export function markSchedulerRunning(at = new Date()) {
  health.runningSince = at;
}

// { running, lastTickAt, lastTickOk, failedSteps, sinceLastTickMs, stale }. stale: bu süreçte çalışıyor ve son
// SCHEDULER_STALE_MS içinde hiç tur tamamlanmadı (henüz hiç tamamlanmadıysa başlangıçtan beri sayılır — yeniden
// başlatmadan hemen sonra, ilk tur sürerken yanlış alarm olmasın).
export function getSchedulerHealth(at = new Date()) {
  const running = health.runningSince != null;
  const since = health.lastTickAt || health.runningSince;
  const sinceLastTickMs = health.lastTickAt ? at.getTime() - health.lastTickAt.getTime() : null;
  return {
    running,
    lastTickAt: health.lastTickAt,
    lastTickOk: health.lastTickOk,
    failedSteps: health.failedSteps.slice(),
    sinceLastTickMs,
    stale: running && !!since && at.getTime() - since.getTime() > SCHEDULER_STALE_MS,
  };
}

let running = false;
// Her N saniyede bir server/src/index.js'ten çağrılır. Bir tick hâlâ sürüyorsa üst üste binmesin
// diye basit bir kilit — PP'deki scheduler.js ile aynı desen (bkz. runMatchLifecycleTick).
// now: testler için — üretimde her zaman şimdiki an.
export async function runSchedulerTick(now = new Date()) {
  if (running) return;
  running = true;
  const failed = [];
  let finished = false;
  try {
    // Sessiz saatlerde erken dönen tur da "tamamlanmış" sayılır: zamanlayıcı canlı, yalnızca bilerek bekliyor.
    if (isQuietHours(now)) {
      finished = true;
      return;
    }
    // Her adım kendi try/catch'i içinde — biri patlarsa (ör. geçici DB hatası) diğerleri yine de
    // çalışır, aksi halde tek bir hata o tick'teki TÜM zamanlanmış işleri (ör. öğretmen özet
    // bildirimini) sessizce atlatırdı.
    // Önce gece bekletilen push'lar (sabahın ilk tick'i), sonra yeni yayınlar ve hatırlatmalar. Haftalık özetler en
    // sonda: Pazar 19:00'daki özet, aynı turda yazılan "bugün son gün" hatırlatmasından sonra sayılsın. Tekrar
    // hatırlatmaları (reviewReminders.js, 17:00 sonrası) ödev hatırlatmalarından sonra.
    const steps = [flushPendingPushes, publishDueAssignments, publishDuePlanEntries, notifyDueToday, notifyOverdueRecipients, notifyTeachersOfOverdueAssignments, notifyReviewReminders, notifyMonthlyReports, notifyStudentWeeklyDigest, notifyCoachWeeklyDigest];
    for (const step of steps) {
      try {
        await step(now);
      } catch (e) {
        console.error(`[scheduler] ${step.name} başarısız oldu:`, e.message);
        failed.push(step.name);
        // Adım başına ayrı tür: DB çökünce her dakika 7 adım patlar — tür başına 30 dakikada bir e-posta (alerts.js).
        // await edilmez: e-posta gönderimi (Resend yeniden denemeleri) turun geri kalanını bekletmesin.
        void alert(`scheduler:${step.name}`, `Zamanlayıcı adımı ${step.name} hata verdi — bu turdaki diğer adımlar çalışmaya devam etti; adım bir sonraki turda (1 dk) yeniden denenecek.`, { error: e });
      }
    }
    finished = true;
  } finally {
    health.lastTickAt = new Date();
    health.lastTickOk = finished && failed.length === 0;
    health.failedSteps = failed;
    running = false;
  }
}
