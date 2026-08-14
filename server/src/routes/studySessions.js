import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { isValidSubject, trackForGrade, trackForExamType } from "../subjects.js";

// server/src/app.js'de requireAuth ile mount edilir — sahiplik kontrolleri handler içinde yapılır.
export const studySessionsRouter = Router();

const EXAM_TYPES = ["TYT", "AYT", "LGS"];

// Öğrenci kendi sınıf düzeyine ait olmayan bir sınav türünde (ör. 8. sınıfken AYT) kayıt
// girmesin diye — gradeLevel henüz belirlenmemişse (null) serbest bırakılır.
async function assertMatchesOwnTrack(studentId, examType) {
  const student = await prisma.user.findUnique({ where: { id: studentId }, select: { gradeLevel: true } });
  const track = trackForGrade(student?.gradeLevel);
  assert(track === null || track === trackForExamType(examType), "Bu sınav türü senin sınıf düzeyinle uyuşmuyor");
}

function validateFields(body) {
  const { examType, subject, topic, sourceBook, pageRange, correctCount, wrongCount, blankCount, note, questionNumbers, studyDate } = body || {};
  assert(EXAM_TYPES.includes(examType), "Geçersiz sınav türü");
  assert(isValidSubject(examType, subject), "Geçersiz ders");
  assert(topic && String(topic).trim(), "Konu gerekli");
  const nums = [correctCount, wrongCount, blankCount];
  assert(nums.every((n) => Number.isInteger(n) && n >= 0), "Doğru/yanlış/boş sayıları geçerli birer tam sayı olmalı");
  return {
    examType, subject, topic: String(topic).trim(),
    sourceBook: sourceBook ? String(sourceBook).trim() : null,
    pageRange: pageRange ? String(pageRange).trim() : null,
    correctCount, wrongCount, blankCount,
    note: note ? String(note).trim() : null,
    questionNumbers: Array.isArray(questionNumbers) ? questionNumbers.filter((n) => Number.isInteger(n)) : [],
    ...(studyDate ? { studyDate: new Date(studyDate) } : {}),
  };
}

studySessionsRouter.post("/", async (req, res) => {
  try {
    assert(req.userRole === "STUDENT", "Bu işlem için yetkin yok", 403);
    const data = validateFields(req.body);
    await assertMatchesOwnTrack(req.userId, data.examType);
    const session = await prisma.studySession.create({ data: { ...data, studentId: req.userId } });
    res.status(201).json({ session });
  } catch (e) {
    handleErr(res, e);
  }
});

async function resolveStudentIdFilter(req) {
  if (req.userRole === "STUDENT") return req.userId;
  const { studentId } = req.query || {};
  assert(studentId, "studentId gerekli", 400);
  if (req.userRole === "TEACHER") {
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    assert(student && student.teacherId === req.userId, "Bu öğrenci sana atanmamış", 403);
  } else {
    assert(req.userRole === "ADMIN", "Bu işlem için yetkin yok", 403);
  }
  return studentId;
}

studySessionsRouter.get("/", async (req, res) => {
  try {
    const studentId = await resolveStudentIdFilter(req);
    const sessions = await prisma.studySession.findMany({ where: { studentId }, orderBy: { studyDate: "desc" } });
    res.json({ sessions });
  } catch (e) {
    handleErr(res, e);
  }
});

async function loadOwnedSession(req) {
  const session = await prisma.studySession.findUnique({ where: { id: req.params.id } });
  assert(session, "Bulunamadı", 404);
  assert(req.userRole === "STUDENT" && session.studentId === req.userId, "Bu işlem için yetkin yok", 403);
  return session;
}

studySessionsRouter.get("/:id", async (req, res) => {
  try {
    const session = await prisma.studySession.findUnique({ where: { id: req.params.id } });
    assert(session, "Bulunamadı", 404);
    const isOwner = req.userRole === "STUDENT" && session.studentId === req.userId;
    let allowed = isOwner || req.userRole === "ADMIN";
    if (!allowed && req.userRole === "TEACHER") {
      const student = await prisma.user.findUnique({ where: { id: session.studentId } });
      allowed = student && student.teacherId === req.userId;
    }
    assert(allowed, "Bu işlem için yetkin yok", 403);
    res.json({ session });
  } catch (e) {
    handleErr(res, e);
  }
});

studySessionsRouter.patch("/:id", async (req, res) => {
  try {
    await loadOwnedSession(req);
    const data = validateFields({ ...req.body, examType: req.body.examType, subject: req.body.subject });
    await assertMatchesOwnTrack(req.userId, data.examType);
    const session = await prisma.studySession.update({ where: { id: req.params.id }, data });
    res.json({ session });
  } catch (e) {
    handleErr(res, e);
  }
});

studySessionsRouter.delete("/:id", async (req, res) => {
  try {
    await loadOwnedSession(req);
    await prisma.studySession.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});
