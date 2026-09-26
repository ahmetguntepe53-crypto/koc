// Okulun koç–öğrenci dağılım listesini sisteme aktarır: eksik öğretmen ve öğrenci hesaplarını açar,
// her öğrenciyi koçuna bağlar, sınıf düzeyini (11/12) ve şubesini yazar.
//
// Kullanım (server/ klasöründen, .env'deki DATABASE_URL'e yazar):
//   node scripts/import-roster.js data/roster-2026.json            → KURU ÇALIŞMA: yalnızca rapor, hiçbir şey yazılmaz
//   node scripts/import-roster.js data/roster-2026.json --apply    → uygular
//   ... --apply --reset-passwords   → önceden kendi şifresini belirlemiş hesapların şifresini de başlangıç
//                                       şifresine çeker (öğrenci: okul no, öğretmen: kullanıcı adı)
//
// Kurallar (okul yönetiminin isteği):
// - Öğrenci: kullanıcı adı = okul numarası, ilk şifre = okul numarası (ilk girişte değiştirmek zorunlu).
// - Öğretmen: kullanıcı adı = ad.soyad (Türkçe karaktersiz, ör. "ali.cihangir"), ilk şifre = kullanıcı adı
//   (okul yönetiminin isteği; tahmin edilebilir olduğu için ilk girişte değiştirmek zorunlu — mustChangePassword).
// - Tekrar çalıştırmak güvenlidir: var olan hesaplar kullanıcı adına, yoksa ada göre bulunur, ikinci kez
//   oluşturulmaz. Var olan bir hesabın kendi belirlediği şifresi (ve e-postası) değiştirilmez
//   (--reset-passwords hariç); kullanıcı adı yoksa eklenir.
// - Öğretmende "branches": ["Matematik"] varsa branş öğretmeni yapılır (teachingSubjects + isSubjectTeacher —
//   okul çapında ortak ödev yetkisi); alan yoksa öğretmenin mevcut branşına dokunulmaz. Yıllık planlar
//   ayrıca scripts/import-plans.js ile branş öğretmenine yüklenir.
// - Liste dosyası reşit olmayanların kişisel verisidir: server/data/ git dışıdır (bkz. .gitignore).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { prisma } from "../src/db.js";
import { BRANCHES } from "../src/subjects.js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const RESET_PASSWORDS = args.includes("--reset-passwords");

if (!file) {
  console.error("Kullanım: node scripts/import-roster.js <liste.json> [--apply] [--reset-passwords]");
  process.exit(1);
}

// "AYŞE BETÜL KOÇ" → "Ayşe Betül Koç" (Türkçe büyük/küçük harf kurallarıyla: I→ı, İ→i).
function titleCaseTr(s) {
  return s.trim().split(/\s+/).map((w) => {
    const lower = w.toLocaleLowerCase("tr-TR");
    return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
  }).join(" ");
}

// Eşleştirme anahtarı: küçük harf + Türkçe karakterler sadeleşir + boşluklar teke iner — var olan bir
// hesap "Rumeysa Ersoy" diye elle girilmiş olsa da "RÜMEYSA ERSOY" ile eşleşsin diye.
const FOLD = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
function foldName(s) {
  return (s || "").toLocaleLowerCase("tr-TR").normalize("NFC").replace(/[çğıöşüâîû]/g, (c) => FOLD[c] || c)
    .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function teacherUsername(name) {
  return foldName(name).split(" ").join(".");
}

function fail(msg) {
  console.error(`HATA: ${msg}`);
  process.exit(1);
}

// --- Listeyi oku ve doğrula (hiçbir şey yazmadan önce) ---
const roster = JSON.parse(fs.readFileSync(file, "utf8"));
const rows = [];
const seenNos = new Map();
for (const t of roster.teachers || []) {
  if (!t.name) fail("İsmi olmayan bir öğretmen var");
  if (t.branches !== undefined) {
    if (!Array.isArray(t.branches) || !t.branches.length) fail(`${t.name}: "branches" boş olmayan bir liste olmalı`);
    const bad = t.branches.filter((b) => !BRANCHES.includes(b));
    if (bad.length) fail(`${t.name}: geçersiz branş ${bad.join(", ")} — geçerliler: ${BRANCHES.join(", ")}`);
  }
  for (const s of t.students || []) {
    const no = String(s.schoolNo || "").trim();
    if (!/^\d{1,8}$/.test(no)) fail(`Geçersiz okul numarası: "${s.schoolNo}" (${s.name})`);
    if (seenNos.has(no)) fail(`Okul numarası iki kez geçiyor: ${no} (${seenNos.get(no)} ve ${s.name})`);
    seenNos.set(no, s.name);
    const m = /^(11|12)-([A-ZÇĞİÖŞÜ])$/.exec(String(s.className || "").trim());
    if (!m) fail(`Geçersiz şube: "${s.className}" (${s.name}) — 11-A / 12-B biçiminde olmalı`);
    rows.push({ teacherName: t.name, schoolNo: no, name: s.name, className: `${m[1]}-${m[2]}`, gradeLevel: Number(m[1]) });
  }
}
const exp = roster.expected || {};
const counts = { teachers: (roster.teachers || []).length, students: rows.length, grade11: rows.filter((r) => r.gradeLevel === 11).length, grade12: rows.filter((r) => r.gradeLevel === 12).length };
for (const k of Object.keys(exp)) {
  if (exp[k] !== counts[k]) fail(`Liste başlığındaki toplamla uyuşmuyor — ${k}: beklenen ${exp[k]}, dosyada ${counts[k]}`);
}
console.log(`Liste: ${counts.teachers} öğretmen, ${counts.students} öğrenci (11. sınıf: ${counts.grade11}, 12. sınıf: ${counts.grade12}) — toplamlar başlıkla uyumlu.`);
console.log(APPLY ? "Mod: UYGULA\n" : "Mod: KURU ÇALIŞMA (hiçbir şey yazılmayacak — uygulamak için --apply)\n");

const report = { teachersCreated: [], teachersMatched: [], studentsCreated: 0, studentsUpdated: 0, studentsUnchanged: 0, passwordsReset: 0, conflicts: [] };

async function main() {
  // --- Öğretmenler ---
  const existingTeachers = await prisma.user.findMany({ where: { role: "TEACHER" }, select: { id: true, name: true, username: true, email: true, passwordHash: true, isSubjectTeacher: true, teachingSubjects: true } });
  const teacherIdByName = new Map();
  for (const t of roster.teachers) {
    const displayName = titleCaseTr(t.name);
    const username = teacherUsername(t.name);
    const branches = t.branches ? BRANCHES.filter((b) => t.branches.includes(b)) : null;
    const branchNote = branches ? `, branş: ${branches.join(", ")}` : "";
    const byName = existingTeachers.filter((e) => foldName(e.name) === foldName(t.name));
    const match = existingTeachers.find((e) => e.username === username) || (byName.length === 1 ? byName[0] : null);
    if (byName.length > 1) report.conflicts.push(`Öğretmen "${displayName}" adıyla birden fazla hesap var — elle kontrol et`);
    if (match) {
      teacherIdByName.set(t.name, match.id);
      // Var olan öğretmen: kullanıcı adı yoksa eklenir (çakışmıyorsa); şifresi yalnızca hiç yoksa ya da
      // --reset-passwords ile başlangıç şifresine (= kullanıcı adı) çekilir.
      const data = {};
      const loginName = match.username || username;
      if (!match.username) {
        const clash = await prisma.user.findFirst({ where: { OR: [{ username }, { email: username }], NOT: { id: match.id } }, select: { id: true } });
        if (clash) report.conflicts.push(`"${username}" kullanıcı adı başka bir hesapta — ${displayName} e-postasıyla girmeye devam eder`);
        else data.username = username;
      }
      if ((!match.passwordHash || RESET_PASSWORDS) && (match.username || data.username)) {
        data.passwordHash = await bcrypt.hash(loginName, 10);
        data.mustChangePassword = true;
        if (match.passwordHash) { data.tokenVersion = { increment: 1 }; report.passwordsReset++; }
      }
      if (branches && (!match.isSubjectTeacher || match.teachingSubjects.join("|") !== branches.join("|"))) {
        data.teachingSubjects = branches;
        data.isSubjectTeacher = true;
      }
      if (APPLY && Object.keys(data).length) await prisma.user.update({ where: { id: match.id }, data });
      report.teachersMatched.push(`${displayName} (${data.username ? `kullanıcı adı eklendi: ${data.username}` : match.username || match.email}${data.passwordHash ? ", ilk şifre = kullanıcı adı" : ""}${data.teachingSubjects ? branchNote : ""})`);
      continue;
    }
    // Kullanıcı adı başka bir hesapta (e-posta ya da kullanıcı adı olarak) kullanılıyorsa yeni hesap açılmaz.
    const clash = await prisma.user.findFirst({ where: { OR: [{ username }, { email: username }] }, select: { id: true, role: true } });
    if (clash) { report.conflicts.push(`"${username}" kullanıcı adı başka bir hesapta kullanılıyor — ${displayName} oluşturulmadı`); continue; }
    report.teachersCreated.push(`${displayName} → kullanıcı adı ve ilk şifre: ${username}${branchNote}`);
    if (APPLY) {
      const created = await prisma.user.create({
        data: {
          role: "TEACHER", name: displayName, username, passwordHash: await bcrypt.hash(username, 10), mustChangePassword: true,
          ...(branches ? { teachingSubjects: branches, isSubjectTeacher: true } : {}),
        },
      });
      teacherIdByName.set(t.name, created.id);
    } else {
      teacherIdByName.set(t.name, `(yeni:${username})`);
    }
  }

  // --- Öğrenciler ---
  const existingStudents = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true, name: true, username: true, email: true, passwordHash: true, teacherId: true, gradeLevel: true, className: true },
  });
  const matchedIds = new Set();
  for (const r of rows) {
    const displayName = titleCaseTr(r.name);
    const teacherId = teacherIdByName.get(r.teacherName);
    if (!teacherId) { report.conflicts.push(`${displayName} (${r.schoolNo}): koçu "${titleCaseTr(r.teacherName)}" oluşturulamadığı için atlandı`); continue; }

    const byNo = existingStudents.find((e) => e.username === r.schoolNo || e.email === r.schoolNo);
    const byName = existingStudents.filter((e) => foldName(e.name) === foldName(r.name));
    let match = byNo || null;
    if (!match && byName.length === 1) {
      // Ada göre bulunan hesabın başka bir okul numarası zaten varsa bu aynı kişi değildir (adaş).
      if (!byName[0].username || byName[0].username === r.schoolNo) match = byName[0];
    }
    if (!match && byName.length > 1) report.conflicts.push(`${displayName} (${r.schoolNo}): aynı adla birden fazla öğrenci hesabı var — yeni hesap açıldı, eskileri elle kontrol et`);

    if (!match) {
      // Okul numarası başka rolde bir hesabın kimliği olarak kullanılıyorsa (çok düşük ihtimal) açılmaz.
      const clash = await prisma.user.findFirst({ where: { OR: [{ username: r.schoolNo }, { email: r.schoolNo }] }, select: { id: true } });
      if (clash) { report.conflicts.push(`${displayName}: ${r.schoolNo} başka bir hesapta kullanılıyor — oluşturulmadı`); continue; }
      report.studentsCreated++;
      if (APPLY) {
        await prisma.user.create({
          data: {
            role: "STUDENT", name: displayName, username: r.schoolNo, passwordHash: await bcrypt.hash(r.schoolNo, 10), mustChangePassword: true,
            gradeLevel: r.gradeLevel, className: r.className, teacherId,
          },
        });
      }
      continue;
    }

    matchedIds.add(match.id);
    const data = {};
    if (match.username !== r.schoolNo) data.username = r.schoolNo;
    if (match.gradeLevel !== r.gradeLevel) data.gradeLevel = r.gradeLevel;
    if (match.className !== r.className) data.className = r.className;
    // Kuru çalışmada yeni koçun id'si henüz yok ("(yeni:...)") — yalnızca "değişecek" diye sayılır.
    if (match.teacherId !== teacherId) data.teacherId = teacherId;
    // Şifre: hiç belirlenmemişse (aktivasyon bekleyen) okul numarası olur; kendi şifresini belirlemişse
    // yalnızca --reset-passwords ile değişir (ve eski oturumları kapanır).
    if (!match.passwordHash || RESET_PASSWORDS) {
      data.passwordHash = await bcrypt.hash(r.schoolNo, 10);
      data.mustChangePassword = true;
      if (match.passwordHash) { data.tokenVersion = { increment: 1 }; report.passwordsReset++; }
    }
    if (Object.keys(data).length === 0) { report.studentsUnchanged++; continue; }
    report.studentsUpdated++;
    if (APPLY) {
      await prisma.user.update({ where: { id: match.id }, data });
      // Koçu değiştiyse eski koçun özel notları silinir (bkz. routes/admin.js > reassign-teacher).
      if (data.teacherId) await prisma.coachNote.deleteMany({ where: { studentId: match.id, teacherId: { not: data.teacherId } } });
    }
  }

  // Listede olmayan öğrenci hesapları — silinmez, yalnızca bilgi için.
  const inRosterNos = new Set(rows.map((r) => r.schoolNo));
  const notInRoster = existingStudents.filter((e) => !matchedIds.has(e.id) && !inRosterNos.has(e.username || ""));

  console.log(`Öğretmen — eşleşen: ${report.teachersMatched.length}, yeni: ${report.teachersCreated.length}`);
  report.teachersMatched.forEach((t) => console.log(`  = ${t}`));
  report.teachersCreated.forEach((t) => console.log(`  + ${t}`));
  console.log(`Öğrenci — yeni: ${report.studentsCreated}, güncellenen: ${report.studentsUpdated}, değişmeyen: ${report.studentsUnchanged}`);
  if (report.passwordsReset) console.log(`Kendi şifresi başlangıç şifresine çekilen hesap (öğretmen + öğrenci): ${report.passwordsReset}`);
  if (notInRoster.length) console.log(`Listede olmayan ${notInRoster.length} öğrenci hesabı var (dokunulmadı): ${notInRoster.map((e) => e.name).join(", ")}`);
  if (report.conflicts.length) {
    console.log(`\nDikkat (${report.conflicts.length}):`);
    report.conflicts.forEach((c) => console.log(`  ! ${c}`));
  }

  if (!APPLY) console.log("\nKuru çalışmaydı — hiçbir şey yazılmadı. Uygulamak için aynı komutu --apply ile çalıştır.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
