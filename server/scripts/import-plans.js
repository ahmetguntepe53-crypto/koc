// Okulun haftalık TYT/AYT konu ve soru takip çizelgelerini (Excel'den JSON'a çevrilmiş hâli) her
// dersin branş öğretmeninin Yıllık Plan takvimine yükler. Her hafta tek bir kayıt olur: Pazartesi'den
// Pazar'a, konu + kaynak kitap + haftalık hedef soru, "okul çapında" (yayınlanınca okuldaki tüm 11-12.
// sınıflara gider) ve "elle yayınlanacak" (taslak) olarak — öğretmen kontrol edip kendisi yayınlar.
//
// Kullanım (server/ klasöründen, .env'deki DATABASE_URL'e yazar):
//   node scripts/import-plans.js data/yillik-plan-2026.json                  → KURU ÇALIŞMA: yalnızca rapor
//   node scripts/import-plans.js data/yillik-plan-2026.json --apply          → uygular
//   ... --include-past   → bitmiş haftaları da yükler (varsayılan: bitiş günü bugünden önceki haftalar atlanır)
//   ... --grade 12       → ZORUNLU: planın sınıf düzeyi (11 ya da 12). Yayınlanınca yalnızca o sınıf düzeyindeki
//                          öğrencilere gider; aynı ders ve hafta için 11 ve 12. sınıf planları ayrı kayıt olur.
//
// Kurallar:
// - Planın sahibi, teachingSubjects'inde o branş olan TEK öğretmendir (bkz. import-roster.js "branches",
//   ya da admin > Kullanıcılar > Branş). Branş öğretmeni yoksa ya da birden fazlaysa o ders atlanır.
// - Tekrar çalıştırmak güvenlidir: aynı öğretmen + sınav türü + ders + başlangıç günü için kayıt zaten
//   varsa (öğretmen düzenlemiş, yayınlamış ya da silip yeniden eklemiş olsa da) dokunulmaz.
// - Tatil, ortak sınav ve boş haftalar JSON'a hiç alınmadı; hedef soru sayısı haftalıktır (günde 30 sınırı
//   7 günlük kayıtta 210 eder — bkz. validators.js > maxQuestionCount).
import "dotenv/config";
import fs from "node:fs";
import { prisma } from "../src/db.js";
import { BRANCHES, EXAM_TYPES, isValidSubject, branchOfSubject } from "../src/subjects.js";
import { maxQuestionCount } from "../src/validators.js";

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--grade");
const APPLY = args.includes("--apply");
const INCLUDE_PAST = args.includes("--include-past");
const gradeArg = args.includes("--grade") ? Number(args[args.indexOf("--grade") + 1]) : null;

if (!file || ![11, 12].includes(gradeArg)) {
  console.error("Kullanım: node scripts/import-plans.js <plan.json> --grade <11|12> [--apply] [--include-past]");
  console.error("  --grade zorunlu: planın hangi sınıf düzeyi için olduğu (yayınlanınca yalnızca o sınıflara gider).");
  process.exit(1);
}

function fail(msg) {
  console.error(`HATA: ${msg}`);
  process.exit(1);
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const utcDay = (iso) => new Date(`${iso}T00:00:00Z`);
// Okulun takvim günü — sunucu UTC'de çalışsa da "bugün" Türkiye saatine göre.
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

// --- Dosyayı oku ve doğrula (hiçbir şey yazmadan önce) ---
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const plans = data.plans || [];
if (!plans.length) fail("Dosyada plan yok");
for (const p of plans) {
  const label = `${p.examType} ${p.subject}`;
  if (!BRANCHES.includes(p.branch)) fail(`${label}: geçersiz branş "${p.branch}"`);
  if (!EXAM_TYPES.includes(p.examType)) fail(`${label}: geçersiz sınav türü`);
  if (!isValidSubject(p.examType, p.subject)) fail(`${label}: ders bu sınav türünün listesinde yok`);
  if (branchOfSubject(p.subject) !== p.branch) fail(`${label}: ders "${p.branch}" branşına ait değil`);
  const starts = new Set();
  for (const w of p.weeks || []) {
    const at = `${label}, ${w.week}. hafta`;
    if (!ISO_DAY.test(w.start || "") || !ISO_DAY.test(w.end || "") || w.end < w.start) fail(`${at}: geçersiz tarih aralığı`);
    if (starts.has(w.start)) fail(`${at}: aynı başlangıç günü iki kez geçiyor`);
    starts.add(w.start);
    if (!w.topic || !String(w.topic).trim()) fail(`${at}: konu boş`);
    if (w.questionCount != null) {
      const max = maxQuestionCount(utcDay(w.start), utcDay(w.end));
      if (!Number.isInteger(w.questionCount) || w.questionCount < 1 || w.questionCount > max) fail(`${at}: soru sayısı 1-${max} arasında olmalı`);
    }
  }
}
const weekTotal = plans.reduce((n, p) => n + p.weeks.length, 0);
console.log(`Dosya: ${plans.length} plan, ${weekTotal} haftalık kayıt — doğrulandı.`);
console.log(`Bugün: ${today}${INCLUDE_PAST ? " (bitmiş haftalar da yüklenecek)" : " (bitiş günü bugünden önceki haftalar atlanır)"}`);
console.log(`Sınıf düzeyi: ${gradeArg}. sınıf (yayınlanınca yalnızca ${gradeArg}. sınıflara gider)`);
console.log(APPLY ? "Mod: UYGULA\n" : "Mod: KURU ÇALIŞMA (hiçbir şey yazılmayacak — uygulamak için --apply)\n");

async function main() {
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER", banned: false, isSubjectTeacher: true },
    select: { id: true, name: true, teachingSubjects: true },
  });
  const problems = [];
  let created = 0;
  let existing = 0;
  let past = 0;

  for (const p of plans) {
    const label = `${p.examType} ${p.subject}`.padEnd(15);
    const owners = teachers.filter((t) => t.teachingSubjects.includes(p.branch));
    if (owners.length !== 1) {
      problems.push(owners.length
        ? `${p.examType} ${p.subject}: ${p.branch} branşında birden fazla öğretmen var (${owners.map((t) => t.name).join(", ")}) — atlandı`
        : `${p.examType} ${p.subject}: ${p.branch} branş öğretmeni yok — atlandı (önce import-roster.js ya da admin > Branş)`);
      continue;
    }
    const owner = owners[0];
    // Aynı sınıf düzeyinin kaydı varsa atlanır (11 ve 12. sınıf planları aynı haftaya düşebilir). Düzeyi boş eski
    // kayıtlar (fix-grade-targets.js çalışmadan önceki) her düzeyle çakışır sayılır — çift yükleme olmasın.
    const have = await prisma.planEntry.findMany({
      where: { teacherId: owner.id, examType: p.examType, subject: p.subject, OR: [{ gradeLevel: gradeArg }, { gradeLevel: null }] },
      select: { date: true },
    });
    const haveDays = new Set(have.map((e) => e.date.toISOString().slice(0, 10)));

    const rows = [];
    let planExisting = 0;
    let planPast = 0;
    for (const w of p.weeks) {
      if (!INCLUDE_PAST && w.end < today) { planPast++; continue; }
      if (haveDays.has(w.start)) { planExisting++; continue; }
      rows.push({
        teacherId: owner.id,
        examType: p.examType,
        date: utcDay(w.start),
        endDate: w.end === w.start ? null : utcDay(w.end),
        kind: "TOPIC",
        subject: p.subject,
        topic: String(w.topic).trim(),
        sourceBook: w.sourceBook || null,
        questionCount: w.questionCount ?? null,
        schoolWide: true,
        gradeLevel: gradeArg,
        autoSend: "OFF",
      });
    }
    if (APPLY && rows.length) await prisma.planEntry.createMany({ data: rows });
    created += rows.length;
    existing += planExisting;
    past += planPast;
    console.log(`  ${label} → ${owner.name.padEnd(20)} yeni: ${String(rows.length).padStart(2)}  zaten var: ${String(planExisting).padStart(2)}  bitmiş (atlandı): ${planPast}`);
  }

  console.log(`\nToplam — yeni: ${created}, zaten var: ${existing}, bitmiş hafta (atlandı): ${past}`);
  if (problems.length) {
    console.log(`\nDikkat (${problems.length}):`);
    problems.forEach((m) => console.log(`  ! ${m}`));
  }
  if (!APPLY) console.log("\nKuru çalışmaydı — hiçbir şey yazılmadı. Uygulamak için aynı komutu --apply ile çalıştır.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
