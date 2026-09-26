import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { trWeekRange, recipientStatus, netOf } from "../weekStats.js";

// server/src/app.js'de requireAuth + requireRole("TEACHER") ile mount edilir.
export const teacherRouter = Router();

teacherRouter.get("/students", async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { teacherId: req.userId, role: "STUDENT" },
      select: { id: true, name: true, email: true, username: true, className: true, gradeLevel: true, banned: true },
      orderBy: { name: "asc" },
    });

    // Her öğrenci için tamamlanma oranı — /stats/teacher'daki genel orandan farklı olarak öğrenci
    // bazında, listede kartın altında gösterilsin diye (yalnızca gönderilmiş ödevler sayılır).
    // Öğrenciye kim gönderirse göndersin (koç, ders öğretmeninin okul çapındaki ödevi, önceki koç)
    // TÜM gönderilmiş ödevler sayılır — öğrenci özet ekranındaki oranla aynı kural, ikisi tutarlı kalsın.
    const recipients = await prisma.assignmentRecipient.findMany({
      where: { studentId: { in: students.map((s) => s.id) }, assignment: { status: "SENT" } },
      select: {
        id: true, studentId: true, completed: true, skippedAt: true, skipReason: true,
        submission: { select: { correctCount: true, wrongCount: true } },
        assignment: { select: { endDate: true, subject: true, topic: true, targetMode: true, teacherId: true } },
      },
    });
    // Koç panosu (bkz. TeacherStudentsScreen): bu haftanın (Pzt–Paz, Türkiye) ödevleri durumlarıyla,
    // haftalık net ve geçen haftaya göre değişim, koçun kendi ödevleri (x/y), toplam geciken.
    // Geciken: tamamlanmamış, pas geçilmemiş ve bitiş gününün Türkiye'deki sonu geçmiş — istemcideki
    // "X gün gecikti" ve zamanlayıcının gecikme kuralıyla aynı (bkz. scheduler.js).
    const now = new Date();
    const { mon, sun, prevMon } = trWeekRange(now);
    const byStudent = new Map();
    for (const r of recipients) {
      const e = byStudent.get(r.studentId) || { total: 0, completed: 0, overdue: 0, week: [], weekNet: 0, prevWeekNet: null, mineDone: 0, mineTotal: 0 };
      const status = recipientStatus(r, now);
      const end = r.assignment.endDate.getTime();
      const net = netOf(r.submission);
      e.total += 1;
      if (r.completed) e.completed += 1;
      else if (status === "missed") e.overdue += 1;
      if (end >= mon.getTime() && end <= sun.getTime()) {
        const schoolWide = r.assignment.targetMode === "SCHOOL_WIDE";
        e.week.push({ id: r.id, subject: r.assignment.subject, topic: r.assignment.topic, schoolWide, status, net, skipReason: r.skipReason });
        if (net != null) e.weekNet += net;
        if (!schoolWide && r.assignment.teacherId === req.userId) {
          e.mineTotal += 1;
          if (r.completed) e.mineDone += 1;
        }
      } else if (end >= prevMon.getTime() && end < mon.getTime() && net != null) {
        e.prevWeekNet = (e.prevWeekNet || 0) + net;
      }
      byStudent.set(r.studentId, e);
    }
    const withRates = students.map((s) => {
      const e = byStudent.get(s.id);
      return {
        ...s,
        completionRate: e && e.total ? Math.round((e.completed / e.total) * 100) : null,
        assignmentCount: e?.total || 0,
        overdueCount: e?.overdue || 0,
        week: e?.week || [],
        weekNet: e?.week.some((w) => w.net != null) ? e.weekNet : null,
        prevWeekNet: e?.prevWeekNet ?? null,
        mine: { done: e?.mineDone || 0, total: e?.mineTotal || 0 },
      };
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
      select: { id: true, name: true, email: true, username: true, className: true, gradeLevel: true, banned: true, teacherId: true, role: true, coachNote: true },
    });
    assert(student && student.role === "STUDENT" && student.teacherId === req.userId, "Bu öğrenci sana atanmamış", 403);
    const [recipients, studySessions] = await Promise.all([
      // Başka öğretmenlerin TASLAKLARI (öğrenciye henüz gitmemiş) gösterilmez; kendi taslakları ve
      // herkesin gönderilmiş ödevleri gösterilir. assignment.teacher, istemcinin başkasına ait ödevi
      // "X tarafından verildi" diye işaretleyebilmesi için.
      prisma.assignmentRecipient.findMany({
        where: { studentId: student.id, assignment: { OR: [{ status: "SENT" }, { teacherId: req.userId }] } },
        include: { assignment: { include: { teacher: { select: { id: true, name: true } } } }, submission: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.studySession.findMany({ where: { studentId: student.id }, orderBy: { studyDate: "desc" } }),
    ]);
    res.json({ student, recipients, studySessions });
  } catch (e) {
    handleErr(res, e);
  }
});

// Koçun bir öğrenci için tuttuğu serbest metin not — öğrenciye asla gösterilmez (bkz. schema.prisma
// > User.coachNote). Boş string kaydedilirse "not silindi" anlamına gelir, null'a normalize edilir.
teacherRouter.put("/students/:id/note", async (req, res) => {
  try {
    const { note } = req.body || {};
    const student = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true, teacherId: true } });
    assert(student && student.role === "STUDENT" && student.teacherId === req.userId, "Bu öğrenci sana atanmamış", 403);
    const cleanNote = note && String(note).trim() ? String(note).trim() : null;
    await prisma.user.update({ where: { id: req.params.id }, data: { coachNote: cleanNote } });
    res.json({ coachNote: cleanNote });
  } catch (e) {
    handleErr(res, e);
  }
});
