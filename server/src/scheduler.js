import { prisma } from "./db.js";
import { notifyUser } from "./notify.js";
import { publishPlanEntry } from "./routes/planEntries.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// endDate UTC gece yarısı olarak saklanır (bkz. planEntries.js > parseDateOnly, assignments.js'in
// tarih parse'ı) — yani "10 Eylül"ü ifade eden değer aslında 10 Eylül 00:00 UTC, ki bu Türkiye'de
// (UTC+3, DST yok) zaten 10 Eylül 03:00 demektir. Ham `endDate < now` karşılaştırması bu yüzden
// "gecikti" durumunu günün bitişinden ~21 saat ÖNCE, günün başında tetikliyordu. Doğrusu: bugün,
// bitiş gününün TÜRKİYE'deki sonunu (bir sonraki günün Türkiye 00:00'ı = aynı UTC gün 21:00) geçmiş
// olmalı — bu da `endDate < (now - 21 saat)` ile eşdeğer.
const TR_END_OF_DAY_GRACE_MS = 21 * 60 * 60 * 1000;

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
    await prisma.assignment.update({ where: { id: assignment.id }, data: { status: "SENT", sentAt: now } });
    const text = `${assignment.teacher.name} sana yeni bir ödev gönderdi: ${assignment.subject} — ${assignment.topic}`;
    // Her öğrenciye KENDİ AssignmentRecipient.id'siyle bildirim gider — öğrenci tarafındaki
    // AssignmentSubmitScreen recipientId ile açılır (assignment.id ile değil), bkz. App.jsx.
    await Promise.all(assignment.recipients.map((r) =>
      notifyUser(r.studentId, text, { type: "assignment", data: { screen: "assignmentSubmit", recipientId: r.id } })
    ));
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
  for (const entry of due) {
    try {
      await publishPlanEntry(entry);
    } catch (e) {
      console.error(`[scheduler] takvim kaydı otomatik yayınlanamadı (${entry.id}):`, e.message);
    }
  }
}

// Süresi (endDate) geçmiş ama hâlâ tamamlanmamış (completed=false) ödevler için öğrenciye BİR KEZ
// hatırlatma bildirimi gönderir — overdueReminderSentAt null olan kayıtlar aranır, bildirim atılınca
// hemen doldurulur ki bir sonraki tick'te (60sn sonra) aynı öğrenciye tekrar tekrar gitmesin.
async function notifyOverdueRecipients(now) {
  const cutoff = new Date(now.getTime() - TR_END_OF_DAY_GRACE_MS);
  const overdue = await prisma.assignmentRecipient.findMany({
    where: { completed: false, overdueReminderSentAt: null, assignment: { status: "SENT", endDate: { lt: cutoff } } },
    include: { assignment: { select: { subject: true, topic: true } } },
  });
  for (const r of overdue) {
    const text = `"${r.assignment.subject} — ${r.assignment.topic}" ödevinin süresi geçti, henüz tamamlamadın — unutmadan bitirebilirsin.`;
    try {
      await notifyUser(r.studentId, text, { type: "assignment_overdue", data: { screen: "assignmentSubmit", recipientId: r.id } });
      // Her satır kendi bildirimi gönderilir gönderilmez işaretlenir — toplu updateMany sona
      // bırakılırsa, ortadaki bir satır patladığında zaten bildirim gitmiş öncekiler bir sonraki
      // tick'te (60sn sonra) tekrar bildirim alırdı.
      await prisma.assignmentRecipient.update({ where: { id: r.id }, data: { overdueReminderSentAt: now } });
    } catch (e) {
      console.error(`[scheduler] gecikme hatırlatması gönderilemedi (recipient ${r.id}):`, e.message);
    }
  }
}

// Süresi geçmiş bir ödevde hâlâ tamamlamamış öğrenci varsa koça BİR KEZ özet bildirimi gönderir —
// teacherOverdueNotifiedAt null olan ödevler aranır; tamamlanma durumu ne olursa olsun (hepsi
// bitirmiş olsa bile) işlendikten hemen sonra doldurulur, aynı ödev için ikinci kez kontrol edilmez.
async function notifyTeachersOfOverdueAssignments(now) {
  const cutoff = new Date(now.getTime() - TR_END_OF_DAY_GRACE_MS);
  const assignments = await prisma.assignment.findMany({
    where: { status: "SENT", endDate: { lt: cutoff }, teacherOverdueNotifiedAt: null },
    include: { recipients: { select: { completed: true } } },
  });
  for (const a of assignments) {
    try {
      const missing = a.recipients.filter((r) => !r.completed).length;
      if (missing > 0) {
        const text = `"${a.subject} — ${a.topic}" ödevinin süresi geçti — ${missing}/${a.recipients.length} öğrenci hâlâ tamamlamadı.`;
        await notifyUser(a.teacherId, text, { type: "assignment_overdue_summary", data: { screen: "assignmentDetail", assignmentId: a.id } });
      }
      // Bildirim gerekmese bile (herkes tamamlamış) işaretlenir — aksi halde bu ödev her tick'te
      // yeniden sorgulanmaya devam eder.
      await prisma.assignment.update({ where: { id: a.id }, data: { teacherOverdueNotifiedAt: now } });
    } catch (e) {
      console.error(`[scheduler] öğretmen gecikme özeti gönderilemedi (assignment ${a.id}):`, e.message);
    }
  }
}

let running = false;
// Her N saniyede bir server/src/index.js'ten çağrılır. Bir tick hâlâ sürüyorsa üst üste binmesin
// diye basit bir kilit — PP'deki scheduler.js ile aynı desen (bkz. runMatchLifecycleTick).
export async function runSchedulerTick() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    // Her adım kendi try/catch'i içinde — biri patlarsa (ör. geçici DB hatası) diğerleri yine de
    // çalışır, aksi halde tek bir hata o tick'teki TÜM zamanlanmış işleri (ör. öğretmen özet
    // bildirimini) sessizce atlatırdı.
    const steps = [publishDueAssignments, publishDuePlanEntries, notifyOverdueRecipients, notifyTeachersOfOverdueAssignments];
    for (const step of steps) {
      try {
        await step(now);
      } catch (e) {
        console.error(`[scheduler] ${step.name} başarısız oldu:`, e.message);
      }
    }
  } finally {
    running = false;
  }
}
