import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { safeUser } from "../serialize.js";
import { sendAccountSetupEmail } from "../mailer.js";
import { handleErr } from "../handleErr.js";
import { isValidEmail, assert } from "../validators.js";
import { GRADE_LEVELS } from "../subjects.js";

// Bu router server/src/app.js'de zaten requireAuth + requireRole("ADMIN") ile mount edilir —
// buradaki her uç nokta yalnızca kimlik doğrulanmış bir ADMIN tarafından çağrılabilir.
export const adminRouter = Router();

const ACCOUNT_SETUP_TOKEN_TTL_MS = 60 * 60 * 1000;

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
    if (role) where.role = String(role);
    if (q) {
      where.OR = [
        { name: { contains: String(q), mode: "insensitive" } },
        { email: { contains: String(q), mode: "insensitive" } },
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
      select: { id: true, name: true, _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ teachers: teachers.map((t) => ({ id: t.id, name: t.name, studentCount: t._count.students })) });
  } catch (e) {
    handleErr(res, e);
  }
});

async function createOneUser({ role, name, email, phone, className, teacherId, gradeLevel }) {
  assert(role === "TEACHER" || role === "STUDENT", "Rol TEACHER veya STUDENT olmalı");
  assert(name && String(name).trim(), "İsim gerekli");
  assert(isValidEmail(email), "Geçerli bir e-posta gerekli");
  const cleanEmail = String(email).trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  assert(!existing, `${cleanEmail} zaten kayıtlı`, 409);

  let resolvedTeacherId = null;
  let resolvedGradeLevel = null;
  if (role === "STUDENT") {
    if (teacherId) {
      const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
      assert(teacher && teacher.role === "TEACHER", "Geçersiz koç seçimi");
      resolvedTeacherId = teacherId;
    }
    // LGS mi TYT/AYT mi gösterileceği bu alandan türetildiği için (bkz. subjects.js) kayıt
    // aşamasında zorunlu — sonradan admin panelinden düzeltilebilir ama boş bırakılamaz.
    const gradeLevelNum = Number(gradeLevel);
    assert(GRADE_LEVELS.includes(gradeLevelNum), "Geçerli bir sınıf düzeyi seç (7-12)");
    resolvedGradeLevel = gradeLevelNum;
  }

  const user = await prisma.user.create({
    data: {
      role,
      name: String(name).trim(),
      email: cleanEmail,
      phone: phone ? String(phone).trim() : null,
      className: role === "STUDENT" && className ? String(className).trim() : null,
      teacherId: resolvedTeacherId,
      gradeLevel: resolvedGradeLevel,
    },
  });
  const token = await issueAccountSetupToken(user.id);
  sendAccountSetupEmail(cleanEmail, token, user.name).catch((e) => console.error("[mailer] gönderilemedi:", e.message));
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
        results.push({ email: row.email, ok: true, id: user.id });
      } catch (e) {
        results.push({ email: row.email, ok: false, error: e.message || "Bilinmeyen hata" });
      }
    }
    res.json({ results, successCount: results.filter((r) => r.ok).length });
  } catch (e) {
    handleErr(res, e);
  }
});

adminRouter.patch("/users/:id", async (req, res) => {
  try {
    const { name, phone, className, gradeLevel } = req.body || {};
    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (phone !== undefined) data.phone = phone ? String(phone).trim() : null;
    if (className !== undefined) data.className = className ? String(className).trim() : null;
    if (gradeLevel !== undefined) {
      const gradeLevelNum = Number(gradeLevel);
      assert(GRADE_LEVELS.includes(gradeLevelNum), "Geçerli bir sınıf düzeyi seç (7-12)");
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
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { teacherId: teacherId || null } });
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
    const result = await prisma.user.updateMany({
      where: { id: { in: studentIds }, role: "STUDENT" },
      data: { teacherId: teacherId || null },
    });
    res.json({ ok: true, updatedCount: result.count });
  } catch (e) {
    handleErr(res, e);
  }
});

adminRouter.post("/users/:id/resend-activation", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    assert(user, "Kullanıcı bulunamadı", 404);
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
    assert(password && password.length >= 8, "Şifre en az 8 karakter olmalı");
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash, resetToken: null, resetTokenExpires: null, tokenVersion: { increment: 1 } },
    });
    res.json({ ok: true });
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
    const [assignmentsCreated, assignmentRecipients, studySessions] = await Promise.all([
      prisma.assignment.count({ where: { teacherId: req.params.id } }),
      prisma.assignmentRecipient.count({ where: { studentId: req.params.id } }),
      prisma.studySession.count({ where: { studentId: req.params.id } }),
    ]);
    if (assignmentsCreated + assignmentRecipients + studySessions > 0) {
      return res.status(409).json({ error: "Bu kullanıcının geçmiş ödev/çalışma kayıtları var — silmek yerine hesabı askıya al." });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});
