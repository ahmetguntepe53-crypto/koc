// Sunucu testlerinin ortak yardımcıları — yeni bir özellik testi yazarken buradan başlayın (bkz. test/README.md).
//
// Kurallar:
//  • Uygulama src/app.js'ten alınır; src/index.js ASLA import edilmez (zamanlayıcıyı başlatır, port dinler).
//  • Veriler KURGUSALDIR: gerçek öğrenci/öğretmen adı, okul numarası ya da e-postası depoya girmez (KVKK, reşit
//    olmayanlar). Adlar "Test Öğrenci 12-03" gibi açıkça uydurmadır, e-postalar @okul.test alan adındadır.
//  • Her test dosyası beforeAll'da resetDatabase() + kendi dünyasını kurar; başka bir dosyanın bıraktığı veriye
//    güvenmez (dosyalar aynı veritabanını sırayla kullanır).
//  • Hızlı kurulum için kayıtlar doğrudan Prisma ile yazılır; test edilen davranış ise HTTP üzerinden (api(token))
//    çağrılır — yetki, doğrulama ve yanıt biçimi gerçek yoldan geçsin.
import crypto from "node:crypto";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";

export { app, prisma };

// Tüm kurgusal hesapların şifresi. Hash bir kez ve düşük maliyetle (4) üretilir: bcrypt.compare her maliyetle çalışır,
// 40 hesabı 10 turla hash'lemek dosya başına saniyeler eklerdi.
export const PASSWORD = "Sifre1234";
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

// ---------------------------------------------------------------------------------------------------------------
// Veritabanı
// ---------------------------------------------------------------------------------------------------------------

// Tüm tabloları boşaltır (_prisma_migrations hariç). Her dosyanın beforeAll'unda ilk iş. Yeni bir tablo eklendiğinde
// burayı güncellemek gerekmez — liste Postgres'ten okunur. Yanlış veritabanına bağlanılmışsa (adında "test" yoksa)
// hiçbir şey silmeden durur: testler yanlışlıkla geliştirme/canlı adresiyle çalıştırılırsa veri kaybolmasın.
export async function resetDatabase() {
  const [{ db }] = await prisma.$queryRaw`SELECT current_database() AS db`;
  if (!/test/i.test(db)) throw new Error(`resetDatabase: "${db}" bir test veritabanı değil — durduruldu.`);
  const rows = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  if (!rows.length) return;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${rows.map((r) => `"${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

// ---------------------------------------------------------------------------------------------------------------
// Tarih
// ---------------------------------------------------------------------------------------------------------------

// Takvim günü, sunucunun sakladığı biçimde (UTC gece yarısı; bkz. planEntries.js > parseDateOnly). day("2026-09-10").
export const day = (ymd) => new Date(`${ymd}T00:00:00.000Z`);
// Türkiye saatiyle bir an (UTC+3, yaz saati yok). trTime("2026-10-01", "09:00") → 06:00Z.
export const trTime = (ymd, hm = "12:00") => new Date(`${ymd}T${hm}:00.000+03:00`);
const toDate = (v) => (v instanceof Date ? v : typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? day(v) : new Date(v));

// ---------------------------------------------------------------------------------------------------------------
// Kullanıcılar
// ---------------------------------------------------------------------------------------------------------------

let userSeq = 0;

// Tek kullanıcı. Giriş kimliği: username (verilmezse "kullanici<n>") ya da email. Şifre her zaman PASSWORD (aksi
// belirtilmedikçe), şartlar kabul edilmiş, mustChangePassword kapalı — yani doğrudan login() ile girilebilir.
export async function createUser({
  role = "STUDENT", name, username, email = null, gradeLevel = null, className = null, teacherId = null,
  isSubjectTeacher = false, teachingSubjects = [], banned = false, password = PASSWORD, mustChangePassword = false,
  lastSeenAt = null, createdAt,
} = {}) {
  userSeq += 1;
  return prisma.user.create({
    data: {
      role,
      name: name ?? `Test Kullanıcı ${userSeq}`,
      username: username !== undefined ? username : email ? null : `kullanici${userSeq}`,
      email,
      passwordHash: password === PASSWORD ? PASSWORD_HASH : bcrypt.hashSync(password, 4),
      gradeLevel, className, teacherId, isSubjectTeacher, teachingSubjects, banned, mustChangePassword, lastSeenAt,
      termsAcceptedAt: new Date(), termsVersion: "1.1",
      ...(createdAt ? { createdAt: toDate(createdAt) } : {}),
    },
  });
}

// Kurgusal bir okul:
//   admin   — okul yöneticisi (ADMIN)
//   coachA  — koç; her sınıftaki öğrencilerin çift sıradakileri (01, 03, … → 0-tabanlı çift indeks) onun
//   coachB  — koç; geri kalanlar
//   branch  — branş öğretmeni (isSubjectTeacher, teachingSubjects: Matematik + Fizik); koçluk ettiği öğrenci YOK
//   grade11 / grade12 — her sınıf düzeyinde perGrade öğrenci (varsayılan 12: k ≥ 10 toplu karşılaştırmalar
//                        öğrencinin kendisi hariç 11 kişiyle sınanabilsin)
// Kullanıcı adları: ogr1101…ogr1112, ogr1201…ogr1212 (sınıf + sıra); koçlar/admin e-postayla girer.
export async function seedSchool({ perGrade = 12 } = {}) {
  const admin = await createUser({ role: "ADMIN", name: "Test Yönetici", email: "yonetici@okul.test", username: null });
  const coachA = await createUser({ role: "TEACHER", name: "Test Koç A", email: "koc.a@okul.test", username: null });
  const coachB = await createUser({ role: "TEACHER", name: "Test Koç B", email: "koc.b@okul.test", username: null });
  const branch = await createUser({
    role: "TEACHER", name: "Test Branş Öğretmeni", email: "brans@okul.test", username: null,
    isSubjectTeacher: true, teachingSubjects: ["Matematik", "Fizik"],
  });
  const grades = {};
  for (const grade of [11, 12]) {
    grades[grade] = [];
    for (let i = 0; i < perGrade; i += 1) {
      const nn = String(i + 1).padStart(2, "0");
      grades[grade].push(await createUser({
        role: "STUDENT", name: `Test Öğrenci ${grade}-${nn}`, username: `ogr${grade}${nn}`,
        gradeLevel: grade, className: `${grade}-${i % 2 === 0 ? "A" : "B"}`,
        teacherId: (i % 2 === 0 ? coachA : coachB).id,
      }));
    }
  }
  const students = [...grades[11], ...grades[12]];
  return {
    admin, coachA, coachB, branch,
    grade11: grades[11], grade12: grades[12], students,
    studentsOf: (coach) => students.filter((s) => s.teacherId === coach.id),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Giriş ve HTTP
// ---------------------------------------------------------------------------------------------------------------

// Gerçek giriş ucu üzerinden token alır (POST /api/auth/login). Başarısızsa açık bir hatayla durur.
export async function login(identifier, password = PASSWORD) {
  const res = await request(app).post("/api/auth/login").send({ email: identifier, password });
  if (res.status !== 200 || !res.body?.token) throw new Error(`Giriş başarısız (${identifier}): ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

// Kullanıcı nesnesiyle giriş (username varsa onunla, yoksa e-postayla).
export const loginAs = (user, password = PASSWORD) => login(user.username || user.email, password);

// Birden çok kullanıcıyı tek seferde: await loginAll({ student: s, coach: c }) → { student: "<token>", coach: "<token>" }.
export async function loginAll(users) {
  const out = {};
  for (const [key, user] of Object.entries(users)) out[key] = await loginAs(user);
  return out;
}

// Kimliği doğrulanmış istemci: const r = await api(token).get("/api/stats/full-report"); r.status, r.body.
// token verilmezse anonim istek. Gövdeli metotlar JSON gönderir.
export function api(token) {
  const auth = (t) => (token ? t.set("Authorization", `Bearer ${token}`) : t);
  return {
    get: (url) => auth(request(app).get(url)),
    post: (url, body) => auth(request(app).post(url)).send(body ?? {}),
    put: (url, body) => auth(request(app).put(url)).send(body ?? {}),
    patch: (url, body) => auth(request(app).patch(url)).send(body ?? {}),
    delete: (url, body) => auth(request(app).delete(url)).send(body ?? {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Ödevler, sonuçlar, serbest çalışma (doğrudan Prisma — kurulum için)
// ---------------------------------------------------------------------------------------------------------------

// Ödev + alıcıları. Varsayılan: gönderilmiş (SENT), tek günlük, koçun seçtiği öğrencilere. Okul geneli ödev için
// targetMode: "SCHOOL_WIDE" (ve teacher: branş öğretmeni). questionCount verilirse pageRange "N soru" olur — raporun
// beklenen soru sayısı (E) buradan okunur (bkz. weekStats.js > questionCountOf). Tarihler "YYYY-MM-DD" ya da Date.
// Dönen nesnede recipients dizisi var; belirli öğrencinin kaydı için recipientOf(a, student).
export async function createAssignment({
  teacher, students, examType = "TYT", subject = "Matematik", topic = "Deneme konusu", sourceBook = null,
  pageRange, questionCount, note = null, scheduledDate, endDate, status = "SENT", sentAt, targetMode, targetGrade = null,
  sendMode = "MANUAL_NOW", period = "WEEKLY",
}) {
  if (!teacher || !Array.isArray(students)) throw new Error("createAssignment: teacher ve students gerekli");
  const start = toDate(scheduledDate ?? endDate ?? new Date());
  const end = toDate(endDate ?? scheduledDate ?? start);
  return prisma.assignment.create({
    data: {
      teacherId: teacher.id, examType, subject, topic, sourceBook, note, period, sendMode, status,
      pageRange: pageRange !== undefined ? pageRange : questionCount ? `${questionCount} soru` : null,
      scheduledDate: start, endDate: end,
      sentAt: status === "SENT" ? (sentAt ? toDate(sentAt) : start) : null,
      targetMode: targetMode ?? (students.length === 1 ? "SINGLE_STUDENT" : "SELECTED_STUDENTS"),
      targetGrade,
      recipients: { create: students.map((s) => ({ studentId: s.id })) },
    },
    include: { recipients: true },
  });
}

export function recipientOf(assignment, student) {
  const r = assignment.recipients.find((x) => x.studentId === student.id);
  if (!r) throw new Error(`recipientOf: öğrenci (${student.id}) bu ödevin alıcısı değil`);
  return r;
}

// Öğrencinin sonucu — POST /submit'in yazdığıyla aynı iki satır (tamamlandı işareti + Submission). Varsayılan teslim anı
// şimdi; zamanında/geç senaryoları için completedAt verin.
export async function submitResult(recipient, { correct, wrong = 0, blank = 0, note = null, questionNumbers = [], completedAt = new Date() }) {
  const id = typeof recipient === "string" ? recipient : recipient.id;
  const at = toDate(completedAt);
  await prisma.assignmentRecipient.update({ where: { id }, data: { completed: true, completedAt: at, skippedAt: null, skipReason: null, skipNote: null } });
  return prisma.submission.create({ data: { recipientId: id, correctCount: correct, wrongCount: wrong, blankCount: blank, note, questionNumbers, createdAt: at } });
}

// "Pas geç" — reason: KONU | ZAMAN | KAYNAK | DIGER (note yalnız DIGER'de anlamlı).
export async function skipRecipient(recipient, { reason = "ZAMAN", note = null, at = new Date() } = {}) {
  const id = typeof recipient === "string" ? recipient : recipient.id;
  return prisma.assignmentRecipient.update({ where: { id }, data: { skippedAt: toDate(at), skipReason: reason, skipNote: note } });
}

// Kanıt fotoğrafı kaydı (diskte dosya OLUŞTURMAZ — yalnız sayım/izin testleri için).
export async function addPhoto(recipient) {
  const id = typeof recipient === "string" ? recipient : recipient.id;
  return prisma.recipientPhoto.create({ data: { recipientId: id, filename: `${crypto.randomUUID()}.png`, mimeType: "image/png", size: 68 } });
}

// Serbest çalışma kaydı (ödevden bağımsız).
export async function createSession(student, {
  examType = "TYT", subject = "Matematik", topic = "Serbest çalışma", sourceBook = null, correct, wrong = 0, blank = 0,
  note = null, questionNumbers = [], studyDate = new Date(),
}) {
  return prisma.studySession.create({
    data: {
      studentId: student.id, examType, subject, topic, sourceBook, note, questionNumbers,
      correctCount: correct, wrongCount: wrong, blankCount: blank, studyDate: toDate(studyDate),
    },
  });
}

// Yıllık plan kaydı (yayınlanmamış). Yayın ve düzenleme davranışı için HTTP uçlarını kullanın (/api/plan-entries).
export async function createPlanEntry(teacher, {
  examType = "TYT", date, endDate = null, kind = "TOPIC", subject = "Matematik", topic = "Plan konusu", questionCount = null,
  schoolWide = false, gradeLevel = null, autoSend = "OFF", assignmentId = null, note = null,
}) {
  return prisma.planEntry.create({
    data: {
      teacherId: teacher.id, examType, kind, subject: kind === "TOPIC" ? subject : null, topic, questionCount, note,
      schoolWide, gradeLevel, autoSend, assignmentId,
      date: toDate(date), endDate: endDate ? toDate(endDate) : null,
    },
  });
}

// Okul ayarları (tek satır) — ör. setSettings({ aiEnabled: true, yksExamDate: day("2027-06-19") }).
export async function setSettings(data) {
  return prisma.schoolSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
}

// Bir JSON yanıtında (ya da herhangi bir değerde) geçen tüm nesne anahtarları — "bu alan hiçbir derinlikte yok"
// türü gizlilik doğrulamaları için: expect(allKeys(body)).not.toContain("min").
export function allKeys(value) {
  const out = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.add(k); walk(x); }
  };
  walk(value);
  return [...out];
}
