// Yıllık plandan ("Branş" sekmesi / takvim) YAYINLANMIŞ ödevleri geri alır: ödev ve alıcıları silinir,
// plan kaydı yeniden "taslak" olur (assignmentId = null), öğrencilere gitmiş "yeni ödev" bildirimleri
// temizlenir. Plan kayıtlarının KENDİSİ silinmez — sekme yeniden açıldığında aynı plandan tekrar
// yayınlanabilir.
//
// 2026-09-28: okul, ödevin yalnızca branş öğretmenlerinin "Ata" ekranından gitmesine karar verdi; plandan
// yayınlama arayüzü gizlendi, o yoldan gitmiş ödevler geri alınıyor.
//
// Kullanım (server/ klasöründen, .env'deki DATABASE_URL'e yazar):
//   node scripts/revert-plan-assignments.js            → KURU ÇALIŞMA: yalnızca rapor
//   node scripts/revert-plan-assignments.js --apply    → uygular (tek işlemde)
//
// KORUMA: öğrencinin emeği silinmez. Bir ödevin alıcılarından herhangi biri sonuç girmiş, pas geçmiş ya da
// fotoğraf eklemişse o ödev OLDUĞU GİBİ BIRAKILIR ve raporda "korundu" diye listelenir. Yalnızca hiç
// dokunulmamış ödevler geri alınır.
import "dotenv/config";
import { prisma } from "../src/db.js";

const APPLY = process.argv.slice(2).includes("--apply");
console.log(APPLY ? "Mod: UYGULA\n" : "Mod: KURU ÇALIŞMA (hiçbir şey yazılmayacak — uygulamak için --apply)\n");

async function main() {
  // Plandan yayınlanmış ödevler: PlanEntry.assignmentId dolu olanlar.
  const entries = await prisma.planEntry.findMany({
    where: { assignmentId: { not: null } },
    select: {
      id: true, examType: true, subject: true, topic: true, date: true, schoolWide: true,
      teacher: { select: { name: true } },
      assignment: {
        select: {
          id: true, subject: true, topic: true, sentAt: true,
          recipients: {
            select: {
              id: true, completed: true, skipReason: true,
              submission: { select: { id: true } },
              photos: { select: { id: true } },
            },
          },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  if (!entries.length) {
    console.log("Plandan yayınlanmış ödev yok — yapılacak bir şey yok.");
    return;
  }

  const touched = (r) => r.completed || r.skipReason != null || r.submission != null || r.photos.length > 0;
  const revertable = [];
  const kept = [];
  for (const e of entries) {
    if (!e.assignment) continue; // ödev elle silinmiş, plan kaydı boşta kalmış
    const touchedCount = e.assignment.recipients.filter(touched).length;
    (touchedCount > 0 ? kept : revertable).push({ entry: e, touchedCount });
  }

  const line = (x) => {
    const e = x.entry;
    const d = new Date(e.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", timeZone: "UTC" });
    const scope = e.schoolWide ? "okul çapı" : "kendi öğrencileri";
    return `   ${d} · ${e.examType} ${e.assignment.subject} — ${e.assignment.topic} · ${e.teacher?.name || "?"} · ${e.assignment.recipients.length} alıcı (${scope})`;
  };

  console.log(`1) Geri alınacak ödev: ${revertable.length}`);
  revertable.forEach((x) => console.log(line(x)));
  const recipientCount = revertable.reduce((n, x) => n + x.entry.assignment.recipients.length, 0);
  console.log(`   toplam ${recipientCount} alıcı kaydı ve bunlara giden bildirimler silinecek`);
  console.log(`   plan kayıtları SİLİNMEZ, yeniden taslağa döner\n`);

  console.log(`2) KORUNACAK (öğrenci sonuç girmiş, pas geçmiş ya da fotoğraf eklemiş): ${kept.length}`);
  kept.forEach((x) => console.log(`${line(x)} — ${x.touchedCount} öğrenci dokunmuş`));

  if (!APPLY) {
    console.log("\nKURU ÇALIŞMA bitti — hiçbir şey değişmedi. Uygulamak için --apply ekleyin.");
    return;
  }
  if (!revertable.length) {
    console.log("\nGeri alınacak ödev yok.");
    return;
  }

  const assignmentIds = revertable.map((x) => x.entry.assignment.id);
  const recipientIds = revertable.flatMap((x) => x.entry.assignment.recipients.map((r) => r.id));

  // Bildirimler hedeflerini JSON alanında taşıyor (bkz. notify.js > data.recipientId). Prisma'nın JSON
  // filtreleri sürüme/veritabanına göre değiştiği için eşleme JS tarafında yapılır — ödev silinince
  // dokununca hiçbir yere gitmeyen bildirim kalmasın diye.
  const idSet = new Set(recipientIds);
  const candidates = await prisma.notification.findMany({ where: { type: "assignment" }, select: { id: true, data: true } });
  const notificationIds = candidates.filter((n) => idSet.has(n.data?.recipientId)).map((n) => n.id);

  const out = await prisma.$transaction(async (tx) => {
    const notifications = await tx.notification.deleteMany({ where: { id: { in: notificationIds } } });
    // Plan kaydını önce çöz — Assignment silinince assignmentId zaten SetNull olur, ama sırayı açıkça
    // yazmak (ve aynı işlemde tutmak) yarı tamamlanmış bir durum bırakmaz.
    const unlinked = await tx.planEntry.updateMany({ where: { assignmentId: { in: assignmentIds } }, data: { assignmentId: null } });
    // AssignmentRecipient onDelete: Cascade — alıcılar ödevle birlikte gider.
    const assignments = await tx.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
    return { notifications: notifications.count, unlinked: unlinked.count, assignments: assignments.count };
  });

  console.log(`\nUYGULANDI: ${out.assignments} ödev silindi, ${out.unlinked} plan kaydı taslağa döndü, ${out.notifications} bildirim temizlendi.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
