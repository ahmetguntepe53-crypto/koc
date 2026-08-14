import { prisma } from "./db.js";
import { notifyUsers } from "./notify.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
    include: { recipients: { select: { studentId: true } }, teacher: { select: { name: true } } },
  });
  for (const assignment of due) {
    await prisma.assignment.update({ where: { id: assignment.id }, data: { status: "SENT", sentAt: now } });
    await notifyUsers(
      assignment.recipients.map((r) => r.studentId),
      `${assignment.teacher.name} sana yeni bir ödev gönderdi: ${assignment.subject} — ${assignment.topic}`,
      { type: "assignment", data: { screen: "assignmentSubmit", assignmentId: assignment.id } }
    );
  }
}

let running = false;
// Her N saniyede bir server/src/index.js'ten çağrılır. Bir tick hâlâ sürüyorsa üst üste binmesin
// diye basit bir kilit — PP'deki scheduler.js ile aynı desen (bkz. runMatchLifecycleTick).
export async function runSchedulerTick() {
  if (running) return;
  running = true;
  try {
    await publishDueAssignments(new Date());
  } finally {
    running = false;
  }
}
