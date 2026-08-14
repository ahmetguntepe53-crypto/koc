import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";

// server/src/app.js'de requireAuth ile mount edilir.
export const statsRouter = Router();

statsRouter.get("/teacher", async (req, res) => {
  try {
    assert(req.userRole === "TEACHER", "Bu işlem için yetkin yok", 403);
    const [studentCount, draftCount, sentCount, recipients] = await Promise.all([
      prisma.user.count({ where: { role: "STUDENT", teacherId: req.userId } }),
      prisma.assignment.count({ where: { teacherId: req.userId, status: "DRAFT" } }),
      prisma.assignment.count({ where: { teacherId: req.userId, status: "SENT" } }),
      prisma.assignmentRecipient.findMany({
        where: { assignment: { teacherId: req.userId, status: "SENT" } },
        select: { completed: true },
      }),
    ]);
    const completedCount = recipients.filter((r) => r.completed).length;
    res.json({
      studentCount, draftCount, sentCount,
      totalRecipients: recipients.length,
      completedCount,
      completionRate: recipients.length ? Math.round((completedCount / recipients.length) * 100) : null,
    });
  } catch (e) {
    handleErr(res, e);
  }
});

statsRouter.get("/student", async (req, res) => {
  try {
    assert(req.userRole === "STUDENT", "Bu işlem için yetkin yok", 403);
    const [recipients, studySessionCount] = await Promise.all([
      prisma.assignmentRecipient.findMany({
        where: { studentId: req.userId, assignment: { status: "SENT" } },
        include: { submission: true },
      }),
      prisma.studySession.count({ where: { studentId: req.userId } }),
    ]);
    const pendingCount = recipients.filter((r) => !r.completed).length;
    const submissions = recipients.map((r) => r.submission).filter(Boolean);
    const totals = submissions.reduce((acc, s) => ({
      correct: acc.correct + s.correctCount, wrong: acc.wrong + s.wrongCount, blank: acc.blank + s.blankCount,
    }), { correct: 0, wrong: 0, blank: 0 });
    res.json({
      pendingCount, completedCount: submissions.length, studySessionCount,
      totals: submissions.length ? totals : null,
    });
  } catch (e) {
    handleErr(res, e);
  }
});
