// Yüklenmiş yıllık planları bir sınıf düzeyine bağlar ve o düzeyin dışındaki öğrencilere yanlışlıkla gitmiş ödevleri
// temizler. 2026-09: sisteme yüklenen Excel planları YALNIZCA 12. sınıf içindi, ama hedef sınıf alanı olmadığı için
// yayınlanan ödevler 11. sınıflara da gidiyordu.
//
// Kullanım (server/ klasöründen, .env'deki DATABASE_URL'e yazar):
//   node scripts/fix-grade-targets.js --grade 12            → KURU ÇALIŞMA: yalnızca rapor
//   node scripts/fix-grade-targets.js --grade 12 --apply    → uygular (tek işlemde)
//
// Ne yapar:
//  1. Hedef sınıfı boş olan OKUL ÇAPINDAKİ plan kayıtlarını --grade düzeyine bağlar (kendi öğrencisine giden koç
//     planlarına dokunmaz).
//  2. Bu kayıtlardan yayınlanmış ödevlere hedef sınıfı yazar.
//  3. Bu ödevlerin o sınıf düzeyinde OLMAYAN alıcılarından, hiç dokunulmamış olanları (sonuç yok, pas yok, fotoğraf
//     yok) ve onlara giden "yeni ödev" bildirimlerini siler. Sonuç girilmiş, pas geçilmiş ya da fotoğraf eklenmiş
//     kayıtlar öğrencinin emeğidir — SİLİNMEZ, yalnızca raporlanır.
import "dotenv/config";
import { prisma } from "../src/db.js";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const grade = args.includes("--grade") ? Number(args[args.indexOf("--grade") + 1]) : null;
if (![11, 12].includes(grade)) {
  console.error("Kullanım: node scripts/fix-grade-targets.js --grade <11|12> [--apply]");
  process.exit(1);
}
console.log(`Hedef sınıf: ${grade}. sınıf · ${APPLY ? "Mod: UYGULA" : "Mod: KURU ÇALIŞMA (hiçbir şey yazılmayacak — uygulamak için --apply)"}\n`);

async function main() {
  const entries = await prisma.planEntry.findMany({
    where: { schoolWide: true, gradeLevel: null },
    select: { id: true, examType: true, subject: true, assignmentId: true, teacher: { select: { name: true } } },
  });
  const byPlan = new Map();
  for (const e of entries) {
    const k = `${e.examType} ${e.subject || "—"} · ${e.teacher?.name || "?"}`;
    const v = byPlan.get(k) || { total: 0, published: 0 };
    v.total += 1;
    if (e.assignmentId) v.published += 1;
    byPlan.set(k, v);
  }
  console.log(`1) Hedef sınıfı boş okul çapında plan kaydı: ${entries.length}`);
  for (const [k, v] of [...byPlan.entries()].sort()) console.log(`   ${k.padEnd(48)} ${String(v.total).padStart(3)} kayıt (${v.published} yayınlanmış)`);

  const assignmentIds = entries.map((e) => e.assignmentId).filter(Boolean);
  const recipients = assignmentIds.length ? await prisma.assignmentRecipient.findMany({
    where: { assignmentId: { in: assignmentIds }, student: { NOT: { gradeLevel: grade } } },
    select: {
      id: true, studentId: true, completed: true, skippedAt: true,
      student: { select: { gradeLevel: true } },
      submission: { select: { id: true } },
      _count: { select: { photos: true } },
    },
  }) : [];
  const untouched = recipients.filter((r) => !r.completed && !r.skippedAt && !r.submission && r._count.photos === 0);
  const kept = recipients.filter((r) => !untouched.includes(r));
  const students = new Set(untouched.map((r) => r.studentId));
  console.log(`\n2) Bu kayıtlardan yayınlanmış ödev: ${assignmentIds.length} → hedef sınıf ${grade} yazılacak`);
  console.log(`3) ${grade}. sınıf dışındaki alıcı: ${recipients.length}`);
  console.log(`   silinecek (dokunulmamış: sonuç/pas/fotoğraf yok): ${untouched.length} kayıt, ${students.size} öğrenci`);
  console.log(`   KORUNACAK (öğrenci sonuç girmiş, pas geçmiş ya da fotoğraf eklemiş): ${kept.length}`);

  // Silinecek alıcılara giden tekil "yeni ödev" bildirimleri (data.recipientId eşleşen).
  let notifIds = [];
  if (untouched.length) {
    const recIds = new Set(untouched.map((r) => r.id));
    const notifs = await prisma.notification.findMany({
      where: { userId: { in: [...students] }, type: "assignment" },
      select: { id: true, data: true },
    });
    notifIds = notifs.filter((n) => n.data && recIds.has(n.data.recipientId)).map((n) => n.id);
  }
  console.log(`   bu ödevlere ait silinecek bildirim: ${notifIds.length}`);

  if (!APPLY) {
    console.log("\nKURU ÇALIŞMA bitti — hiçbir şey değişmedi. Uygulamak için --apply ekleyin.");
    return;
  }
  await prisma.$transaction(async (tx) => {
    if (entries.length) await tx.planEntry.updateMany({ where: { id: { in: entries.map((e) => e.id) } }, data: { gradeLevel: grade } });
    if (assignmentIds.length) await tx.assignment.updateMany({ where: { id: { in: assignmentIds } }, data: { targetGrade: grade } });
    if (notifIds.length) await tx.notification.deleteMany({ where: { id: { in: notifIds } } });
    if (untouched.length) await tx.assignmentRecipient.deleteMany({ where: { id: { in: untouched.map((r) => r.id) }, completed: false, skippedAt: null } });
  });
  console.log("\nUYGULANDI.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
