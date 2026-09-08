import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";

// server/src/app.js'de requireAuth + requireRole("TEACHER") ile mount edilir.
export const teacherRouter = Router();

teacherRouter.get("/students", async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { teacherId: req.userId, role: "STUDENT" },
      select: { id: true, name: true, email: true, className: true, gradeLevel: true, banned: true },
      orderBy: { name: "asc" },
    });

    // Her öğrenci için tamamlanma oranı — /stats/teacher'daki genel orandan farklı olarak öğrenci
    // bazında, listede kartın altında gösterilsin diye (yalnızca gönderilmiş ödevler sayılır).
    const recipients = await prisma.assignmentRecipient.findMany({
      where: { studentId: { in: students.map((s) => s.id) }, assignment: { teacherId: req.userId, status: "SENT" } },
      select: { studentId: true, completed: true },
    });
    const byStudent = new Map();
    for (const r of recipients) {
      const entry = byStudent.get(r.studentId) || { total: 0, completed: 0 };
      entry.total += 1;
      if (r.completed) entry.completed += 1;
      byStudent.set(r.studentId, entry);
    }
    const withRates = students.map((s) => {
      const entry = byStudent.get(s.id);
      return { ...s, completionRate: entry && entry.total ? Math.round((entry.completed / entry.total) * 100) : null };
    });

    res.json({ students: withRates });
  } catch (e) {
    handleErr(res, e);
  }
});

teacherRouter.get("/students/:id/overview", async (req, res) => {
  try {
    const student = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, className: true, gradeLevel: true, banned: true, teacherId: true, role: true },
    });
    assert(student && student.role === "STUDENT" && student.teacherId === req.userId, "Bu öğrenci sana atanmamış", 403);
    const [recipients, studySessions] = await Promise.all([
      prisma.assignmentRecipient.findMany({
        where: { studentId: student.id },
        include: { assignment: true, submission: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.studySession.findMany({ where: { studentId: student.id }, orderBy: { studyDate: "desc" } }),
    ]);
    res.json({ student, recipients, studySessions });
  } catch (e) {
    handleErr(res, e);
  }
});
