// Golden verisi: tamamen UYDURMA bir okul (gerçek koç/öğrenci listesi reşit olmayanların kişisel verisidir —
// golden görüntüleri git'e girdiği için burada asla kullanılmaz). Deterministik: sabit tohumlu sözde rastgele
// sayılar; tarihler kayıt anına (NOW) göre — oynatmada tarayıcı saati NOW'a sabitlenir (bkz. support.js).
// record.mjs tarafından `server/` dizininden çalıştırılır; recordings/meta.json yazar.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "../server/node_modules/bcryptjs/index.js";

process.env.FIREBASE_SERVICE_ACCOUNT_PATH = "";
const here = path.dirname(fileURLToPath(import.meta.url));
const { prisma } = await import("../server/src/db.js");
const { publishPlanEntry } = await import("../server/src/routes/planEntries.js");

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date();
// Türkiye takvim günü (UTC gece yarısı biçiminde) ve bu haftanın Pazartesi'si.
const trToday = (() => { const t = new Date(NOW.getTime() + 3 * 3600e3); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); })();
const monday = new Date(trToday.getTime() - ((trToday.getUTCDay() + 6) % 7) * DAY);
const day = (offset) => new Date(trToday.getTime() + offset * DAY);
const weekStart = (w) => new Date(monday.getTime() + w * 7 * DAY);

let seed = 20260926;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

const PASSWORD = "Golden1234";
const hash = await bcrypt.hash(PASSWORD, 8);

// --- Kullanıcılar ---
const admin = await prisma.user.create({ data: { role: "ADMIN", name: "Okul Yönetimi", email: "admin@golden.test", passwordHash: hash, termsAcceptedAt: NOW } });
const TEACHERS = [
  ["Ayşe Yılmaz", "ayse.yilmaz", ["Matematik"]],
  ["Kerem Aydın", "kerem.aydin", ["Türkçe", "Edebiyat"]],
  ["Selin Kara", "selin.kara", ["Fizik"]],
  ["Emre Doğan", "emre.dogan", ["Biyoloji"]],
  ["Zeynep Arslan", "zeynep.arslan", ["Tarih"]],
  ["Can Öztürk", "can.ozturk", ["Coğrafya"]],
  ["Deniz Koç", "deniz.koc", ["Felsefe"]],
  ["Burak Şen", "burak.sen", []],
];
const teachers = {};
for (const [name, username, branches] of TEACHERS) {
  teachers[username] = await prisma.user.create({
    data: { role: "TEACHER", name, username, passwordHash: hash, termsAcceptedAt: NOW, lastSeenAt: NOW, isSubjectTeacher: branches.length > 0, teachingSubjects: branches },
  });
}
// Ayşe Yılmaz'ın 6 öğrencisi (koç panosu, şartname Z3 ile aynı isimler) + diğer koçlara dağılanlar.
const STUDENTS = [
  ["Mert Arslan", "1201", "12-A", "ayse.yilmaz", -4],
  ["Burak Şahin", "1202", "12-A", "ayse.yilmaz", 0],
  ["Ahmet Çelik", "1203", "12-B", "ayse.yilmaz", -1],
  ["Zeynep Kaya", "1204", "12-A", "ayse.yilmaz", 0],
  ["Selin Yıldız", "1205", "12-B", "ayse.yilmaz", 0],
  ["Elif Demir", "1206", "11-A", "ayse.yilmaz", -2],
  ["Ece Aksoy", "1101", "11-A", "kerem.aydin", 0],
  ["Onur Tekin", "1102", "11-B", "kerem.aydin", -1],
  ["Derya Polat", "1103", "11-B", "selin.kara", 0],
  ["Kaan Uçar", "1104", "11-C", "selin.kara", null],
  ["Melis Erdem", "1207", "12-C", "emre.dogan", 0],
  ["Yusuf Kılıç", "1208", "12-C", "zeynep.arslan", -1],
  ["İrem Güneş", "1105", "11-C", "can.ozturk", 0],
  ["Berk Aslan", "1106", "11-A", "deniz.koc", -3],
  ["Nazlı Şimşek", "1209", "12-B", "burak.sen", 0],
  ["Emir Yavuz", "1210", "12-A", "burak.sen", 0],
  ["Duru Akın", "1107", "11-B", null, null],
];
const students = {};
for (const [name, no, className, coach, seenOffset] of STUDENTS) {
  students[no] = await prisma.user.create({
    data: {
      role: "STUDENT", name, username: no, passwordHash: hash, mustChangePassword: false, termsAcceptedAt: NOW,
      gradeLevel: Number(className.slice(0, 2)), className, teacherId: coach ? teachers[coach].id : null,
      createdAt: new Date(NOW.getTime() - 20 * DAY),
      lastSeenAt: seenOffset == null ? null : new Date(NOW.getTime() + seenOffset * DAY - 2 * 3600e3),
    },
  });
}
// İlk giriş (şartname Z7): okul numarasıyla açılmış, şifresini henüz belirlememiş öğrenci.
const firstLogin = await prisma.user.create({
  data: { role: "STUDENT", name: "Nisa Ak", username: "1247", passwordHash: await bcrypt.hash("1247", 8), mustChangePassword: true, gradeLevel: 12, className: "12-B", teacherId: teachers["burak.sen"].id, createdAt: NOW },
});
await prisma.schoolSettings.upsert({ where: { id: "singleton" }, update: { yksExamDate: new Date("2027-06-19T00:00:00Z") }, create: { id: "singleton", yksExamDate: new Date("2027-06-19T00:00:00Z") } });

// --- Yıllık planlar: her branş öğretmenine 12 hafta (7 geçmiş + bu hafta yayınlanmış, 4 taslak) — gelişim raporunun
// trendi (son 4 hafta / önceki 4 hafta) ve konu dökümü için en az 8 haftalık geçmiş gerekiyor.
const TOPICS = {
  Matematik: ["Kümeler", "Mantık", "Fonksiyonlar", "Problemler", "Temel Kavramlar", "Sayı Basamakları", "Bölünebilme", "Rasyonel Sayılar", "Üslü Sayılar", "Köklü Sayılar", "Mutlak Değer", "Oran Orantı"],
  Türkçe: ["Anlatım Bozuklukları", "Fiilimsi", "Cümlenin Öğeleri", "Ek Fiil", "Sözcükte Anlam", "Cümlede Anlam", "Paragrafta Anlatım", "Paragrafta Yapı", "Ses Bilgisi", "Yazım Kuralları", "Noktalama", "Sözcük Türleri"],
  Fizik: ["Elektrik", "Manyetizma", "Optik", "Dinamik", "Fizik Bilimine Giriş", "Madde ve Özellikleri", "Basınç", "Kaldırma Kuvveti", "Isı ve Sıcaklık", "Hareket", "Kuvvet", "Enerji"],
  Biyoloji: ["Kalıtım", "Mitoz ve Eşeysiz Üreme", "Mayoz ve Eşeyli Üreme", "Ekosistem Ekolojisi", "Canlıların Özellikleri", "İnorganik Bileşikler", "Karbonhidratlar", "Lipitler", "Proteinler", "Enzimler", "Nükleik Asitler", "Hücre"],
  Tarih: ["Türk İnkılabı", "Türk Dış Politikası", "Türkiye Tarihi", "Arayış Yılları", "Tarih ve Zaman", "İlk Çağ Uygarlıkları", "Orta Çağ'da Dünya", "İlk Türk Devletleri", "İslam Medeniyeti", "Türk-İslam Devletleri", "Selçuklu Türkiyesi", "Beylikten Devlete"],
  Coğrafya: ["Ekonomik Faaliyetler", "Ülkeler ve Bölgeler", "Çevre ve Toplum", "Coğrafi Konum", "Doğa ve İnsan", "Dünyanın Şekli", "Yer ve Zaman", "Harita Bilgisi", "İklim Bilgisi", "Yerin Şekillenmesi", "Nüfus", "Göç"],
  Felsefe: ["Siyaset Felsefesi", "Sanat Felsefesi", "Bilim Felsefesi", "Ahlak Felsefesi", "Felsefeyi Tanıma", "Felsefe ile Düşünme", "Varlık Felsefesi", "Bilgi Felsefesi", "Bilim Felsefesi", "Ahlak Felsefesi", "Din Felsefesi", "Sanat Felsefesi"],
};
const QUESTIONS = { Matematik: 120, Türkçe: 90, Fizik: 60, Biyoloji: 50, Tarih: 80, Coğrafya: 40, Felsefe: 30 };
const SKIPS = ["KONU", "KONU", "ZAMAN", "KAYNAK", "DIGER"];
const branchOf = { "ayse.yilmaz": "Matematik", "kerem.aydin": "Türkçe", "selin.kara": "Fizik", "emre.dogan": "Biyoloji", "zeynep.arslan": "Tarih", "can.ozturk": "Coğrafya", "deniz.koc": "Felsefe" };
// Öğrenci başına "çalışkanlık" — sonuçlar gerçekçi dağılsın, Mert en geride.
const diligence = (no) => ({ "1201": 0.25, "1202": 0.55, "1204": 0.85, "1205": 0.9, "1206": 0.95 }[no] ?? 0.7);

for (const [username, subject] of Object.entries(branchOf)) {
  const teacher = teachers[username];
  for (let w = -7; w <= 4; w++) {
    const entry = await prisma.planEntry.create({
      data: {
        teacherId: teacher.id, examType: "TYT", date: weekStart(w), endDate: new Date(weekStart(w).getTime() + 6 * DAY),
        // Gerçekteki gibi: yüklenen yıllık planlar yalnız 12. sınıf içindir (11. sınıflar bu ödevleri almaz).
        kind: "TOPIC", subject, topic: TOPICS[subject][w + 7], sourceBook: "Golden Yayınları", questionCount: QUESTIONS[subject], schoolWide: true, gradeLevel: 12,
      },
    });
    if (w > 0) continue;
    const { assignment } = await publishPlanEntry(entry);
    const q = QUESTIONS[subject];
    for (const r of assignment.recipients) {
      const no = Object.keys(students).find((k) => students[k].id === r.studentId);
      const x = rnd();
      // Bu hafta daha az kişi girmiş (hafta sürüyor); geçmiş haftalarda çoğu girmiş ya da gecikmiş.
      const doneChance = (w === 0 ? 0.55 : 0.8) * (diligence(no) / 0.7);
      if (x < doneChance) {
        const answered = Math.round(q * (0.85 + rnd() * 0.15));
        const correct = Math.round(answered * (0.25 + diligence(no) * 0.45 + rnd() * 0.15));
        const wrong = Math.round((answered - correct) * (0.3 + rnd() * 0.5));
        // Bazı teslimlerde yanlış/boş soru numaraları (rapordaki tekrar listesi) ve kısa bir not.
        const numbers = rnd() < 0.35 ? [4, 9, 13, 21].slice(0, 2 + Math.floor(rnd() * 3)) : [];
        await prisma.assignmentRecipient.update({
          where: { id: r.id },
          data: {
            completed: true, completedAt: new Date(weekStart(w).getTime() + (1 + Math.floor(rnd() * 5)) * DAY + 15 * 3600e3),
            submission: { create: { correctCount: correct, wrongCount: wrong, blankCount: q - correct - wrong, questionNumbers: numbers, note: rnd() < 0.08 ? "Son sayfadaki sorularda zorlandım." : null } },
          },
        });
      } else if (x < doneChance + 0.15) {
        await prisma.assignmentRecipient.update({ where: { id: r.id }, data: { skippedAt: new Date(weekStart(w).getTime() + 4 * DAY), skipReason: SKIPS[Math.floor(rnd() * SKIPS.length)] } });
      }
    }
  }
}

// --- Ayşe Yılmaz'ın kişisel ödevleri (koç ödevi) ---
const ayse = teachers["ayse.yilmaz"];
const ayseStudents = Object.values(students).filter((s) => s.teacherId === ayse.id);
async function coachAssignment(topic, subject, start, end, pageRange, doneFor = [], teacher = ayse, targetStudents = ayseStudents, audienceLabel = null) {
  const a = await prisma.assignment.create({
    data: {
      teacherId: teacher.id, examType: "TYT", subject, topic, pageRange, period: "WEEKLY", scheduledDate: start, endDate: end,
      sendMode: "MANUAL_NOW", targetMode: "WHOLE_GROUP", status: "SENT", sentAt: start, audienceLabel,
      recipients: { create: targetStudents.map((s) => ({ studentId: s.id })) },
    },
    include: { recipients: true },
  });
  for (const r of a.recipients) {
    const no = Object.keys(students).find((k) => students[k].id === r.studentId);
    if (!doneFor.includes(no)) continue;
    await prisma.assignmentRecipient.update({ where: { id: r.id }, data: { completed: true, completedAt: new Date(start.getTime() + DAY), submission: { create: { correctCount: 16, wrongCount: 3, blankCount: 1 } } } });
  }
  return a;
}
// audienceLabel: "Son gönderdiklerim"de sınıf/okul etiketi (bkz. Assignment.audienceLabel) — Sözcükte
// Anlam BİLİNÇLİ olarak null: "Seçerek" modunu (sayı + "Listeyi gör") de golden'da göstersin diye.
await coachAssignment("Sayı basamakları tekrarı", "Matematik", day(-4), day(-1), "20 soru", ["1204", "1205", "1206"], ayse, ayseStudents, "12-A");
await coachAssignment("Sözcükte Anlam tekrarı", "Türkçe", day(-3), day(0), "20 soru", ["1204", "1206"]);
await coachAssignment("Limit tekrarı", "Matematik", day(-1), day(3), "25 soru", [], ayse, ayseStudents, "Tüm okul");
// Burak Şen (branşsız koç) — bu değişiklikten ÖNCEKİ dönemden kalma, kendi öğrencilerine kendi
// verdiği bir ödev: yeni kuralda koçlar artık ödev veremez, ama eski kayıtlar "Ödevler" sekmesinde
// durmaya devam eder (bkz. golden/specs/koc.spec.js > "Düz koç ödevleri").
const burakStudents = Object.values(students).filter((s) => s.teacherId === teachers["burak.sen"].id);
await coachAssignment("Türev tekrarı", "Matematik", day(-2), day(2), "20 soru", ["1209"], teachers["burak.sen"], burakStudents);

// --- Zeynep Kaya: serbest çalışma + koçunun tarihli notları ---
const zeynep = students["1204"];
for (const [topic, c, w, b, d] of [["Paragraf", 30, 6, 4, 0], ["Cümle Yorumu", 25, 3, 2, 1], ["Sözcükte Anlam", 28, 8, 4, 2], ["Paragraf", 32, 5, 3, 9], ["Paragraf", 27, 7, 6, 16], ["Cümlede Anlam", 24, 4, 2, 23]]) {
  await prisma.studySession.create({ data: { studentId: zeynep.id, examType: "TYT", subject: "Türkçe", topic, correctCount: c, wrongCount: w, blankCount: b, studyDate: new Date(NOW.getTime() - d * DAY) } });
}
await prisma.coachNote.create({ data: { studentId: zeynep.id, teacherId: ayse.id, text: "Türkçe'de çok iyi gidiyor, paragrafta 31 net. Buradan güven kazandırıyorum.", createdAt: new Date(NOW.getTime() - 9 * DAY), updatedAt: new Date(NOW.getTime() - 9 * DAY) } });
await prisma.coachNote.create({ data: { studentId: zeynep.id, teacherId: ayse.id, text: "Matematik'te tıkanıyor, rasyonel sayılar konusunu hiç açmadı.\nAilesiyle görüştüm, akşam programı dağınık.", createdAt: new Date(NOW.getTime() - 2 * DAY), updatedAt: new Date(NOW.getTime() - 2 * DAY) } });

// "Pastan dönüş": Zeynep iki hafta önceki bir okul ödevini süresi içinde pas geçmiş, bitişten 2 gün sonra yine de çözmüş
// (rapor bunu gecikme saymaz — bkz. src/reportModel.js).
const zeynepDone = await prisma.assignmentRecipient.findFirst({
  where: { studentId: zeynep.id, completed: true, assignment: { targetMode: "SCHOOL_WIDE", endDate: { gte: weekStart(-2), lt: weekStart(-1) } } },
  include: { assignment: { select: { endDate: true } } },
  orderBy: { assignment: { subject: "asc" } },
});
if (zeynepDone) {
  const end = zeynepDone.assignment.endDate.getTime();
  await prisma.assignmentRecipient.update({
    where: { id: zeynepDone.id },
    data: { priorSkippedAt: new Date(end - DAY + 16 * 3600e3), priorSkipReason: "ZAMAN", completedAt: new Date(end + 2 * DAY + 15 * 3600e3) },
  });
}

// Koçun aylık rapor bildirimi (zamanlayıcının her ayın ilk haftasında gönderdiğiyle aynı biçim) — bildirimler ekranı ve
// bildirime dokununca açılan aylık raporlar ekranı golden'da görünsün diye.
{
  const t = new Date(NOW.getTime() + 3 * 3600e3);
  const prevMonth = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
  const monthKey = `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, "0")}`;
  const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  await prisma.notification.create({
    data: {
      // Okunmuş olarak: sahnede dokunmak okundu işaretleyip sunucu durumunu değiştirmesin (kayıttaki rozet sayısı sabit kalsın).
      userId: ayse.id, type: "monthly_report", read: true, data: { screen: "monthlyReports", month: monthKey }, createdAt: new Date(NOW.getTime() - 26 * 3600e3),
      text: `${MONTHS_TR[prevMonth.getUTCMonth()]} ayı raporları hazır — ${ayseStudents.length} öğrencinin aylık gelişim raporunu incele; hepsini tek PDF olarak da alabilirsin.`,
    },
  });
}

// YKS alanları (kurgusal) ve Zeynep'in deneme sınavları — rapordaki "Denemeler" bölümü ve alan bilgisi dolu görünsün.
for (const [no, field] of [["1201", "SAY"], ["1202", "EA"], ["1203", "SAY"], ["1204", "SAY"], ["1205", "EA"], ["1206", "SOZ"], ["1207", "SAY"], ["1208", "SOZ"]]) {
  await prisma.user.update({ where: { id: students[no].id }, data: { field } });
}
{
  const TYT_ROWS = (k) => [
    ["Türkçe", 31 + k, 6 - Math.min(k, 3), 3], ["Tarih", 4, 1, 0], ["Coğrafya", 3, 1, 1], ["Felsefe", 4, 0, 1], ["Din Kültürü ve Ahlak Bilgisi", 4, 1, 0],
    ["Matematik", 14 + 2 * k, 7, 9 - 2 * k], ["Geometri", 4 + (k > 1 ? 1 : 0), 3, 3 - (k > 1 ? 1 : 0)], ["Fizik", 3, 2, 2], ["Kimya", 4, 2, 1], ["Biyoloji", 4, 1, 1],
  ];
  const AYT_ROWS = (k) => [["Matematik", 10 + 3 * k, 8, 12 - 3 * k], ["Geometri", 3, 3, 4], ["Fizik", 5 + k, 4, 5 - k], ["Kimya", 5, 3, 5], ["Biyoloji", 6, 3, 4]];
  const exams = [
    { examType: "TYT", w: -6, name: "Golden Yayınları TYT-1", rows: TYT_ROWS(0) },
    { examType: "TYT", w: -4, name: "Golden Yayınları TYT-2", rows: TYT_ROWS(1) },
    { examType: "AYT", w: -3, name: "Golden Yayınları AYT-1", rows: AYT_ROWS(0) },
    { examType: "TYT", w: -2, name: "Golden Yayınları TYT-3", rows: TYT_ROWS(2) },
    { examType: "TYT", w: -1, name: "Okul Denemesi TYT", rows: TYT_ROWS(3) },
    { examType: "AYT", w: -1, name: "Golden Yayınları AYT-2", rows: AYT_ROWS(1) },
  ];
  for (const e of exams) {
    await prisma.practiceExam.create({
      data: {
        studentId: zeynep.id, examType: e.examType, date: new Date(weekStart(e.w).getTime() + 5 * DAY), name: e.name, createdById: zeynep.id,
        results: { create: e.rows.map(([subject, correct, wrong, blank]) => ({ subject, correct, wrong, blank })) },
      },
    });
  }
}

// Bildirimlerin zamanları sabit: yayın anında yazılanlar "az önce" görünmesin, günlere yayılsın.
const notes = await prisma.notification.findMany({ where: { userId: zeynep.id }, orderBy: { createdAt: "asc" } });
for (let i = 0; i < notes.length; i++) {
  await prisma.notification.update({ where: { id: notes[i].id }, data: { createdAt: new Date(NOW.getTime() - (notes.length - i) * 5 * 3600e3), read: i < notes.length - 4 } });
}

// Aktivite sekmesi için birkaç günlük giriş kaydı — hepsi sıfır görünmesin diye (gerçek giriş sayıları
// requireAuth üzerinden birikir, burada elle uydurma tarihlerle döşenir).
{
  const { trTodayAsDateOnly } = await import("../server/src/quietHours.js");
  const today = trTodayAsDateOnly(NOW);
  const teacherList = Object.values(teachers);
  const studentList = Object.values(students);
  const loginRows = [];
  for (let d = 0; d < 10; d++) {
    const day = new Date(today.getTime() - d * DAY);
    // Hafta sonu (golden'da sabit bir "bugün" olduğu için gerçek gün adı önemli değil) daha düşük katılım.
    const weekendish = d % 6 === 5;
    teacherList.forEach((t, i) => { if ((i + d) % (weekendish ? 3 : 2) === 0) loginRows.push({ userId: t.id, day }); });
    studentList.forEach((s, i) => { if ((i + d) % (weekendish ? 4 : 2) === 0) loginRows.push({ userId: s.id, day }); });
  }
  await prisma.loginDay.createMany({ data: loginRows, skipDuplicates: true });
}

const meta = {
  now: NOW.toISOString(),
  password: PASSWORD,
  personas: {
    ogrenci: { username: "1204", password: PASSWORD },
    // koc = branş öğretmeni (Matematik): ödev atayabilen rol. duzKoc = branşı olmayan koç: ödev
    // atayamaz, Takvim sekmesi onda — iki rolün sekmeleri 2026-09-28'den beri farklı (bkz. App.jsx > tabsFor).
    koc: { username: "ayse.yilmaz", password: PASSWORD },
    duzKoc: { username: "burak.sen", password: PASSWORD },
    admin: { username: "admin@golden.test", password: PASSWORD },
    ilk: { username: "1247", password: "1247" },
  },
  ids: { zeynep: zeynep.id, firstLogin: firstLogin.id, admin: admin.id },
};
fs.writeFileSync(path.join(here, "recordings", "meta.json"), JSON.stringify(meta, null, 1));
console.log(`[golden] tohumlandı: ${Object.keys(students).length + 1} öğrenci, ${TEACHERS.length} öğretmen, şimdi=${meta.now}`);
await prisma.$disconnect();
