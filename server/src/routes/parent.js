import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { recipientStatus, trWeekRange } from "../weekStats.js";
import { trTodayAsDateOnly } from "../quietHours.js";

// Veli paneli (rol PARENT; app.js'de requireRole("PARENT")). KULLANICI İSTEĞİ (2026-10-14): veli YALNIZCA kendi öğrencisinin
// ödev takibini yapar ve toplam çözdüğü soru sayısını günlük/haftalık/aylık izler; DOĞRU/YANLIŞ GÖRMEZ — bu yüzden yanıtta
// doğru, yanlış, boş, net ya da başarı yüzdesi HİÇ yer almaz (yalnızca toplam).
// "Çözülen soru" = doğru + yanlış (öğrencinin işaretlediği); boş bırakılan çözülmüş sayılmaz. Ödev sonucu teslim gününe,
// serbest çalışma çalışma gününe (Türkiye takvimi) yazılır.
export const parentRouter = Router();

const DAY = 24 * 60 * 60 * 1000;
const TR = 3 * 60 * 60 * 1000;
const trDayKey = (d) => new Date(Math.floor((new Date(d).getTime() + TR) / DAY) * DAY).toISOString().slice(0, 10);
const ymd = (d) => d.toISOString().slice(0, 10);

// GET /api/parent/overview
parentRouter.get("/overview", async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { childId: true } });
    assert(me?.childId, "Bu hesaba bağlı öğrenci yok", 404);
    const now = new Date();
    const [child, recipients, sessions] = await Promise.all([
      prisma.user.findUnique({ where: { id: me.childId }, select: { id: true, name: true, className: true, gradeLevel: true, avatar: true, lastSeenAt: true, teacher: { select: { name: true } } } }),
      prisma.assignmentRecipient.findMany({
        where: { studentId: me.childId, assignment: { status: "SENT" } },
        select: {
          id: true, completed: true, completedAt: true, skippedAt: true,
          submission: { select: { correctCount: true, wrongCount: true, createdAt: true } },
          assignment: { select: { subject: true, topic: true, examType: true, scheduledDate: true, endDate: true, teacher: { select: { name: true } } } },
        },
        orderBy: { assignment: { endDate: "desc" } },
      }),
      prisma.studySession.findMany({ where: { studentId: me.childId }, select: { studyDate: true, correctCount: true, wrongCount: true } }),
    ]);

    // gün → çözülen soru
    const byDay = new Map();
    const addQ = (when, q) => { if (q > 0) { const k = trDayKey(when); byDay.set(k, (byDay.get(k) || 0) + q); } };
    for (const r of recipients) if (r.submission) addQ(r.completedAt || r.submission.createdAt, r.submission.correctCount + r.submission.wrongCount);
    for (const s of sessions) addQ(s.studyDate, s.correctCount + s.wrongCount);
    const sumRange = (from, toExcl) => { let n = 0; for (const [k, q] of byDay) { const t = Date.parse(k); if (t >= from.getTime() && t < toExcl.getTime()) n += q; } return n; };

    const today = trTodayAsDateOnly(now);
    const tomorrow = new Date(today.getTime() + DAY);
    const { mon } = trWeekRange(now);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(today.getTime() - (13 - i) * DAY); return { start: ymd(d), questions: byDay.get(ymd(d)) || 0 }; });
    const weeks = Array.from({ length: 8 }, (_, i) => { const s = new Date(mon.getTime() - (7 - i) * 7 * DAY); return { start: ymd(s), questions: sumRange(s, new Date(s.getTime() + 7 * DAY)) }; });
    const months = Array.from({ length: 6 }, (_, i) => {
      const s = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (5 - i), 1));
      return { start: ymd(s), questions: sumRange(s, new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1))) };
    });

    // Ödevler: yalnızca durum (tamamladı / pas geçti / gecikti / bekliyor) ve teslim zamanı — sonuç yok.
    const GRACE = 21 * 60 * 60 * 1000;
    const assignments = recipients.map((r) => {
      const status = recipientStatus({ ...r, assignment: r.assignment }, now);
      const doneAt = r.submission ? (r.completedAt || r.submission.createdAt) : null;
      return {
        id: r.id, subject: r.assignment.subject, topic: r.assignment.topic, examType: r.assignment.examType,
        scheduledDate: r.assignment.scheduledDate, endDate: r.assignment.endDate, teacherName: r.assignment.teacher?.name || null,
        status, completedAt: doneAt, late: doneAt ? new Date(doneAt).getTime() > r.assignment.endDate.getTime() + GRACE : false,
      };
    });
    const weekEnd = new Date(mon.getTime() + 7 * DAY);
    const thisWeek = assignments.filter((a) => a.endDate >= mon && a.endDate < weekEnd);
    const count = (list) => ({ total: list.length, done: list.filter((a) => a.status === "done").length, open: list.filter((a) => a.status === "open").length, missed: list.filter((a) => a.status === "missed").length, skipped: list.filter((a) => a.status === "skipped").length });

    res.json({
      child: { id: child.id, name: child.name, className: child.className, gradeLevel: child.gradeLevel, avatar: child.avatar, lastSeenAt: child.lastSeenAt, coachName: child.teacher?.name || null },
      questions: { today: sumRange(today, tomorrow), week: sumRange(mon, weekEnd), month: sumRange(monthStart, new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1))), days, weeks, months },
      summary: { week: count(thisWeek), all: count(assignments) },
      assignments,
    });
  } catch (e) {
    handleErr(res, e);
  }
});
