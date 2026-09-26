import { Router } from "express";
import crypto from "crypto";
import path from "node:path";
import { unlink } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { safeUser } from "../serialize.js";
import { sendAccountSetupEmail } from "../mailer.js";
import { handleErr } from "../handleErr.js";
import { isValidEmail, isValidUsername, assert } from "../validators.js";
import { GRADE_LEVELS, BRANCHES } from "../subjects.js";
import { recipientPhotosDir } from "../uploads.js";

// Bu router server/src/app.js'de zaten requireAuth + requireRole("ADMIN") ile mount edilir —
// buradaki her uç nokta yalnızca kimlik doğrulanmış bir ADMIN tarafından çağrılabilir.
export const adminRouter = Router();

// 7 gün: öğrenciler kurulum e-postasını çoğu zaman ertesi gün (ya da hafta sonu) açıyor — 1 saatlik
// süre bu linklerin çoğunu kullanılamaz hale getiriyordu. "Şifremi unuttum" linki ise kullanıcının
// kendisi o an istediği için 1 saat kalır (bkz. auth.js > RESET_TOKEN_TTL_MS).
const ACCOUNT_SETUP_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ROLES = ["ADMIN", "TEACHER", "STUDENT"];

async function issueAccountSetupToken(userId) {
  const resetToken = crypto.randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: { resetToken, resetTokenExpires: new Date(Date.now() + ACCOUNT_SETUP_TOKEN_TTL_MS) },
  });
  return resetToken;
}

adminRouter.get("/stats", async (req, res) => {
  try {
    const [teacherCount, studentCount, studentsWithoutTeacher, teachersWithoutStudents] = await Promise.all([
      prisma.user.count({ where: { role: "TEACHER" } }),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "STUDENT", teacherId: null } }),
      prisma.user.count({ where: { role: "TEACHER", students: { none: {} } } }),
    ]);
    res.json({ teacherCount, studentCount, studentsWithoutTeacher, teachersWithoutStudents });
  } catch (e) {
    handleErr(res, e);
  }
});

adminRouter.get("/users", async (req, res) => {
  try {
    const { role, q } = req.query || {};
    const where = {};
    if (role) {
      // Enum dışı bir değer Prisma'da doğrulama hatasına (500) dönüşürdü.
      assert(ROLES.includes(role), "Geçersiz rol");
      where.role = role;
    }
    if (q) {
      where.OR = [
        { name: { contains: String(q), mode: "insensitive" } },
        { email: { contains: String(q), mode: "insensitive" } },
        { username: { contains: String(q), mode: "insensitive" } },
      ];
    }
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { teacher: { select: { id: true, name: true } }, _count: { select: { students: true } } },
    });
    res.json({ users: users.map((u) => ({ ...safeUser(u), hasPassword: !!u.passwordHash })) });
  } catch (e) {
    handleErr(res, e);
  }
});

// Öğrenci ekleme formundaki "koç" dropdown'u için — sadece id/isim/mevcut öğrenci sayısı.
adminRouter.get("/teachers", async (req, res) => {
  try {
    const teachers = await prisma.user.findMany({
      where: { role: "TEACHER", banned: false },
      select: { id: true, name: true, isSubjectTeacher: true, teachingSubjects: true, _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ teachers: teachers.map((t) => ({ id: t.id, name: t.name, studentCount: t._count.students, isSubjectTeacher: t.isSubjectTeacher, teachingSubjects: t.teachingSubjects })) });
  } catch (e) {
    handleErr(res, e);
  }
});

// Giriş kimliği çakışması: giriş e-posta VE kullanıcı adı alanlarının ikisine birden baktığı için
// (bkz. auth.js > login) bir değer, başka bir hesabın ne e-postası ne de kullanıcı adı olabilir.
async function findIdentifierClash(values, exceptUserId) {
  const ids = values.filter(Boolean);
  if (!ids.length) return null;
  return prisma.user.findFirst({
    where: {
      OR: ids.flatMap((v) => [{ email: v }, { username: v }]),
      ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}),
    },
  });
}

// E-posta ya da kullanıcı adından en az biri zorunlu. E-posta verilirse eskisi gibi şifre belirleme
// bağlantısı gider; YALNIZCA kullanıcı adı verilirse (e-postası olmayan öğrenci — okulun kuralı:
// kullanıcı adı ve ilk şifre okul numarası) ilk şifre kullanıcı adıyla aynı olur.
async function createOneUser({ role, name, email, username, phone, className, teacherId, gradeLevel }) {
  assert(role === "TEACHER" || role === "STUDENT", "Rol TEACHER veya STUDENT olmalı");
  assert(name && String(name).trim(), "İsim gerekli");
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;
  const cleanUsername = username ? String(username).trim().toLowerCase() : null;
  assert(cleanEmail || cleanUsername, "E-posta ya da kullanıcı adı (okul numarası) gerekli");
  if (cleanEmail) assert(isValidEmail(cleanEmail), "Geçerli bir e-posta gir");
  if (cleanUsername) assert(isValidUsername(cleanUsername), "Kullanıcı adı yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir (2-40 karakter)");
  const existing = await findIdentifierClash([cleanEmail, cleanUsername]);
  assert(!existing, `${cleanUsername || cleanEmail} zaten kayıtlı`, 409);

  let resolvedTeacherId = null;
  let resolvedGradeLevel = null;
  if (role === "STUDENT") {
    if (teacherId) {
      const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
      assert(teacher && teacher.role === "TEACHER", "Geçersiz koç seçimi");
      resolvedTeacherId = teacherId;
    }
    // Öğrencinin sınav grubu (TYT/AYT) bu alandan türetildiği için (bkz. subjects.js) kayıt
    // aşamasında zorunlu — sonradan admin panelinden düzeltilebilir ama boş bırakılamaz.
    const gradeLevelNum = Number(gradeLevel);
    assert(GRADE_LEVELS.includes(gradeLevelNum), "Geçerli bir sınıf düzeyi seç (11 veya 12)");
    resolvedGradeLevel = gradeLevelNum;
  }

  const user = await prisma.user.create({
    data: {
      role,
      name: String(name).trim(),
      email: cleanEmail,
      username: cleanUsername,
      passwordHash: cleanEmail ? null : await bcrypt.hash(cleanUsername, 10),
      // Kullanıcı adıyla aynı ilk şifre tahmin edilebilir — ilk girişte değiştirmek zorunlu.
      mustChangePassword: !cleanEmail,
      phone: phone ? String(phone).trim() : null,
      className: role === "STUDENT" && className ? String(className).trim() : null,
      teacherId: resolvedTeacherId,
      gradeLevel: resolvedGradeLevel,
    },
  });
  if (cleanEmail) {
    const token = await issueAccountSetupToken(user.id);
    sendAccountSetupEmail(cleanEmail, token, user.name).catch((e) => console.error("[mailer] gönderilemedi:", e.message));
  }
  return user;
}

adminRouter.post("/users", async (req, res) => {
  try {
    const user = await createOneUser(req.body || {});
    res.status(201).json({ user: safeUser(user) });
  } catch (e) {
    handleErr(res, e);
  }
});

// 200 öğrenciyi tek tek eklemek pratik değil — Excel/Sheets'ten kopyalanan satırları client tarafında
// ayrıştırıp buraya {role, rows:[{name,email,phone?,className?,teacherId?}]} olarak gönderiyoruz,
// her satır bağımsız değerlendirilip başarı/hata raporu dönülüyor (bir satırın hatası diğerlerini durdurmaz).
adminRouter.post("/users/bulk-import", async (req, res) => {
  try {
    const { role, rows } = req.body || {};
    assert(Array.isArray(rows) && rows.length > 0, "En az bir satır gerekli");
    assert(rows.length <= 500, "Tek seferde en fazla 500 satır işlenebilir");
    const results = [];
    for (const row of rows) {
      try {
        const user = await createOneUser({ ...row, role: row.role || role });
        results.push({ email: row.email || row.username, ok: true, id: user.id });
      } catch (e) {
        results.push({ email: row.email || row.username, ok: false, error: e.message || "Bilinmeyen hata" });
      }
    }
    res.json({ results, successCount: results.filter((r) => r.ok).length });
  } catch (e) {
    handleErr(res, e);
  }
});

adminRouter.patch("/users/:id", async (req, res) => {
  try {
    const { name, phone, className, gradeLevel, username } = req.body || {};
    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (username !== undefined) {
      const cleanUsername = username ? String(username).trim().toLowerCase() : null;
      const current = await prisma.user.findUnique({ where: { id: req.params.id }, select: { email: true } });
      assert(current, "Bulunamadı", 404);
      // Hesabın giriş yapabileceği en az bir kimlik kalmalı.
      assert(cleanUsername || current.email, "E-postası olmayan bir hesabın kullanıcı adı silinemez");
      if (cleanUsername) {
        assert(isValidUsername(cleanUsername), "Kullanıcı adı yalnızca harf, rakam, nokta, tire ve alt çizgi içerebilir (2-40 karakter)");
        assert(!(await findIdentifierClash([cleanUsername], req.params.id)), `${cleanUsername} zaten kayıtlı`, 409);
      }
      data.username = cleanUsername;
    }
    if (phone !== undefined) data.phone = phone ? String(phone).trim() : null;
    if (className !== undefined) data.className = className ? String(className).trim() : null;
    if (gradeLevel !== undefined) {
      const gradeLevelNum = Number(gradeLevel);
      assert(GRADE_LEVELS.includes(gradeLevelNum), "Geçerli bir sınıf düzeyi seç (11 veya 12)");
      data.gradeLevel = gradeLevelNum;
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ user: safeUser(user) });
  } catch (e) {
    handleErr(res, e);
  }
});

adminRouter.post("/users/:id/reassign-teacher", async (req, res) => {
  try {
    const { teacherId } = req.body || {};
    const student = await prisma.user.findUnique({ where: { id: req.params.id } });
    assert(student && student.role === "STUDENT", "Bu işlem yalnızca öğrenciler için geçerli");
    if (teacherId) {
      const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
      assert(teacher && teacher.role === "TEACHER", "Geçersiz koç seçimi");
    }
    // Koç değişince eski koçun bu öğrenci hakkındaki özel notları silinir: notu yalnızca yazarı görebiliyordu,
    // öğrenci artık onun değil — kimsenin göremediği ve silemediği veri tutulmaz (bkz. schema.prisma > CoachNote).
    const [updated] = await prisma.$transaction([
      prisma.user.update({ where: { id: req.params.id }, data: { teacherId: teacherId || null } }),
      prisma.coachNote.deleteMany({ where: { studentId: req.params.id, ...(teacherId ? { teacherId: { not: teacherId } } : {}) } }),
    ]);
    res.json({ user: safeUser(updated) });
  } catch (e) {
    handleErr(res, e);
  }
});

adminRouter.post("/users/bulk-reassign-teacher", async (req, res) => {
  try {
    const { studentIds, teacherId } = req.body || {};
    assert(Array.isArray(studentIds) && studentIds.length > 0, "En az bir öğrenci seçilmeli");
    if (teacherId) {
      const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
      assert(teacher && teacher.role === "TEACHER", "Geçersiz koç seçimi");
    }
    const [result] = await prisma.$transaction([
      prisma.user.updateMany({ where: { id: { in: studentIds }, role: "STUDENT" }, data: { teacherId: teacherId || null } }),
      // Eski koçların notları silinir (bkz. tekil reassign-teacher).
      prisma.coachNote.deleteMany({ where: { studentId: { in: studentIds }, ...(teacherId ? { teacherId: { not: teacherId } } : {}) } }),
    ]);
    res.json({ ok: true, updatedCount: result.count });
  } catch (e) {
    handleErr(res, e);
  }
});

adminRouter.post("/users/:id/resend-activation", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    assert(user, "Kullanıcı bulunamadı", 404);
    assert(user.email, "Bu kullanıcının e-posta adresi yok — şifresini doğrudan belirle", 400);
    const token = await issueAccountSetupToken(user.id);
    await sendAccountSetupEmail(user.email, token, user.name);
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

// Acil durum kaçış kapısı: 200 lise öğrencisinin hepsi e-postasını güvenilir şekilde kontrol
// etmeyebilir — admin gerektiğinde şifreyi doğrudan belirleyip öğrenciye/öğretmene sözlü iletebilir.
// Normal akış yine de e-posta ile kullanıcının kendi şifresini kendisinin belirlemesidir.
adminRouter.post("/users/:id/set-password", async (req, res) => {
  try {
    const { password } = req.body || {};
    assert(typeof password === "string" && password.length >= 8, "Şifre en az 8 karakter olmalı");
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: req.params.id },
      // Adminin sözlü ilettiği geçici şifre — kullanıcı ilk girişte kendi şifresini belirler.
      data: { passwordHash, resetToken: null, resetTokenExpires: null, tokenVersion: { increment: 1 }, mustChangePassword: true },
    });
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

// Bir öğretmeni "ders öğretmeni" (branş öğretmeni) olarak işaretler/kaldırır — bu bayrağa sahip
// öğretmenler Takvim'den okuldaki TÜM ilgili sınav türü öğrencilerine (kendi koçluk ettikleriyle
// sınırlı olmadan) ortak ödev gönderebilir (bkz. routes/planEntries.js > publishPlanEntry).
// Gövde { subjects: ["Matematik"] } ise branşlar yazılır ve yetki branş varsa açılır, yoksa kapanır;
// eski istemcilerin { isSubjectTeacher } gövdesi de çalışır (yetki kalkınca branşlar da silinir).
adminRouter.post("/users/:id/subject-teacher", async (req, res) => {
  try {
    const { isSubjectTeacher, subjects } = req.body || {};
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    assert(user && user.role === "TEACHER", "Bu işlem yalnızca öğretmenler için geçerli");
    let data;
    if (subjects !== undefined) {
      assert(Array.isArray(subjects) && subjects.every((s) => BRANCHES.includes(s)), "Geçersiz branş");
      const clean = BRANCHES.filter((b) => subjects.includes(b));
      data = { teachingSubjects: clean, isSubjectTeacher: clean.length > 0 };
    } else {
      data = isSubjectTeacher ? { isSubjectTeacher: true } : { isSubjectTeacher: false, teachingSubjects: [] };
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data });
    res.json({ user: safeUser(updated) });
  } catch (e) {
    handleErr(res, e);
  }
});

adminRouter.post("/users/:id/ban", async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { banned: true, tokenVersion: { increment: 1 } },
    });
    res.json({ user: safeUser(user) });
  } catch (e) {
    handleErr(res, e);
  }
});

adminRouter.post("/users/:id/unban", async (req, res) => {
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { banned: false } });
    res.json({ user: safeUser(user) });
  } catch (e) {
    handleErr(res, e);
  }
});

// Gerçek DELETE yalnızca ilişkili hiçbir kaydı (verdiği/aldığı ödev, çalışma kaydı) olmayan
// hesaplarda çalışır — geçmiş sınav hazırlık verisi kazayla kaybolmasın diye. Aksi halde admin
// "ban" ile hesabı devre dışı bırakmalı.
adminRouter.delete("/users/:id", async (req, res) => {
  try {
    const [assignmentsCreated, assignmentRecipients, studySessions, coachedStudents] = await Promise.all([
      prisma.assignment.count({ where: { teacherId: req.params.id } }),
      prisma.assignmentRecipient.count({ where: { studentId: req.params.id } }),
      prisma.studySession.count({ where: { studentId: req.params.id } }),
      // Hedef bir ÖĞRETMEN'se ve hâlâ kendisine atanmış öğrencileri varsa: henüz hiç ödev
      // oluşturmamış olsa bile (assignmentsCreated=0) silme, öğrencileri koçsuz (teacherId=null,
      // bkz. schema.prisma onDelete: SetNull) bırakmasın — önce öğrenciler başka bir koça atanmalı.
      prisma.user.count({ where: { teacherId: req.params.id } }),
    ]);
    if (assignmentsCreated + assignmentRecipients + studySessions + coachedStudents > 0) {
      return res.status(409).json({ error: "Bu kullanıcının geçmiş ödev/çalışma kayıtları ya da kendisine atanmış öğrencileri var — silmek yerine hesabı askıya al." });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

// Admin, okuldaki TÜM öğrencilerin kanıt fotoğraflarını tek ekrandan görüp temizleyebilir — koç/
// öğrenci ekranlarındaki (bkz. assignmentRecipients.js) kapsamı ödev/öğrenci başınayken burası
// sistem geneli bir moderasyon görünümü. q ile öğrenci adında arama yapılabilir.
adminRouter.get("/photos", async (req, res) => {
  try {
    const { q } = req.query || {};
    const where = q ? { recipient: { student: { name: { contains: String(q), mode: "insensitive" } } } } : {};
    const photos = await prisma.recipientPhoto.findMany({
      where,
      include: {
        recipient: {
          include: {
            student: { select: { id: true, name: true, className: true } },
            assignment: { select: { id: true, subject: true, topic: true, examType: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    res.json({ photos });
  } catch (e) {
    handleErr(res, e);
  }
});

adminRouter.delete("/photos/:photoId", async (req, res) => {
  try {
    const photo = await prisma.recipientPhoto.findUnique({ where: { id: req.params.photoId } });
    assert(photo, "Bulunamadı", 404);
    await prisma.recipientPhoto.delete({ where: { id: photo.id } });
    await unlink(path.join(recipientPhotosDir(photo.recipientId), photo.filename)).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

// Okul çapında tek satır (bkz. schema.prisma > SchoolSettings) — yazma yalnızca admin'e açık.
// Öğrenci/öğretmen ekranlarındaki salt-okunur karşılığı: GET /api/settings (routes/settings.js).
adminRouter.get("/settings", async (req, res) => {
  try {
    const settings = await prisma.schoolSettings.findUnique({ where: { id: "singleton" } });
    // aiConfigured: sunucuda Anthropic API anahtarı tanımlı mı (anahtarın kendisi asla dönmez).
    res.json({ yksExamDate: settings?.yksExamDate ?? null, lgsExamDate: settings?.lgsExamDate ?? null, aiEnabled: !!settings?.aiEnabled, aiConfigured: !!process.env.ANTHROPIC_API_KEY });
  } catch (e) {
    handleErr(res, e);
  }
});

adminRouter.put("/settings", async (req, res) => {
  try {
    const { yksExamDate, lgsExamDate, aiEnabled } = req.body || {};
    const data = {};
    if (aiEnabled !== undefined) data.aiEnabled = !!aiEnabled;
    if (yksExamDate !== undefined) {
      if (yksExamDate === null || yksExamDate === "") data.yksExamDate = null;
      else {
        assert(!Number.isNaN(new Date(yksExamDate).getTime()), "Geçerli bir YKS tarihi gir");
        data.yksExamDate = new Date(yksExamDate);
      }
    }
    if (lgsExamDate !== undefined) {
      if (lgsExamDate === null || lgsExamDate === "") data.lgsExamDate = null;
      else {
        assert(!Number.isNaN(new Date(lgsExamDate).getTime()), "Geçerli bir LGS tarihi gir");
        data.lgsExamDate = new Date(lgsExamDate);
      }
    }
    const settings = await prisma.schoolSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });
    res.json({ yksExamDate: settings.yksExamDate, lgsExamDate: settings.lgsExamDate, aiEnabled: settings.aiEnabled, aiConfigured: !!process.env.ANTHROPIC_API_KEY });
  } catch (e) {
    handleErr(res, e);
  }
});
