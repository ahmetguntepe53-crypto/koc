import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";

// server/src/app.js'de requireAuth ile mount edilir — sahiplik kontrolleri handler içinde yapılır.
export const assignmentRecipientsRouter = Router();

const assignmentInclude = { assignment: { include: { teacher: { select: { id: true, name: true } } } }, submission: true };

assignmentRecipientsRouter.get("/mine", async (req, res) => {
  try {
    assert(req.userRole === "STUDENT", "Bu işlem için yetkin yok", 403);
    const { completed, subject } = req.query || {};
    const where = { studentId: req.userId };
    if (completed === "true") where.completed = true;
    if (completed === "false") where.completed = false;
    if (subject) where.assignment = { subject };
    const recipients = await prisma.assignmentRecipient.findMany({
      where,
      include: assignmentInclude,
      orderBy: { createdAt: "desc" },
    });
    // Öğrenci henüz gönderilmemiş (DRAFT) ödevleri hiç görmemeli — sadece SENT olanlar listelenir.
    res.json({ recipients: recipients.filter((r) => r.assignment.status === "SENT") });
  } catch (e) {
    handleErr(res, e);
  }
});

assignmentRecipientsRouter.get("/:id", async (req, res) => {
  try {
    const recipient = await prisma.assignmentRecipient.findUnique({
      where: { id: req.params.id },
      include: { ...assignmentInclude, student: { select: { id: true, name: true, className: true } } },
    });
    assert(recipient, "Bulunamadı", 404);
    const isOwner = req.userRole === "STUDENT" && recipient.studentId === req.userId;
    const isTeacherOwner = req.userRole === "TEACHER" && recipient.assignment.teacherId === req.userId;
    assert(isOwner || isTeacherOwner || req.userRole === "ADMIN", "Bu işlem için yetkin yok", 403);
    res.json({ recipient });
  } catch (e) {
    handleErr(res, e);
  }
});

async function submitHandler(req, res) {
  try {
    assert(req.userRole === "STUDENT", "Bu işlem için yetkin yok", 403);
    const recipient = await prisma.assignmentRecipient.findUnique({ where: { id: req.params.id }, include: { assignment: true } });
    assert(recipient, "Bulunamadı", 404);
    assert(recipient.studentId === req.userId, "Bu işlem için yetkin yok", 403);
    assert(recipient.assignment.status === "SENT", "Bu ödev henüz sana gönderilmedi", 409);

    const { correctCount, wrongCount, blankCount, note, questionNumbers } = req.body || {};
    const nums = [correctCount, wrongCount, blankCount];
    assert(nums.every((n) => Number.isInteger(n) && n >= 0), "Doğru/yanlış/boş sayıları geçerli birer tam sayı olmalı");
    const cleanQuestionNumbers = Array.isArray(questionNumbers) ? questionNumbers.filter((n) => Number.isInteger(n)) : [];

    const submission = await prisma.$transaction(async (tx) => {
      await tx.assignmentRecipient.update({ where: { id: recipient.id }, data: { completed: true, completedAt: new Date() } });
      return tx.submission.upsert({
        where: { recipientId: recipient.id },
        update: { correctCount, wrongCount, blankCount, note: note ? String(note).trim() : null, questionNumbers: cleanQuestionNumbers },
        create: { recipientId: recipient.id, correctCount, wrongCount, blankCount, note: note ? String(note).trim() : null, questionNumbers: cleanQuestionNumbers },
      });
    });
    res.json({ submission });
  } catch (e) {
    handleErr(res, e);
  }
}

assignmentRecipientsRouter.post("/:id/submit", submitHandler);
assignmentRecipientsRouter.patch("/:id/submit", submitHandler);
