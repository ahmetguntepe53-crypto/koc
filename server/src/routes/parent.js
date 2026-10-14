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

// GET /api/parent/stats — öğrencinin ödevlerdeki genel durumu (KULLANICI İSTEĞİ 2026-10-14). Yine doğru/yanlış/net YOK.
//  • Tamamlama: süresi dolmuş ya da tamamlanmış ödevlerin yüzde kaçını tamamladı (Öğrencilerim ekranıyla aynı tanım).
//  • Zamanında: tamamlananların yüzde kaçını son gün bitmeden girdi.
//  • Çalıştığı gün: ödev ya da serbest çalışmada soru çözdüğü farklı gün sayısı; seri = bugünden (ya da dünden) geriye kesintisiz gün.
parentRouter.get("/stats", async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { childId: true } });
    assert(me?.childId, "Bu hesaba bağlı öğrenci yok", 404);
    const now = new Date();
    const GRACE = 21 * 60 * 60 * 1000;
    const [recipients, sessions] = await Promise.all([
      prisma.assignmentRecipient.findMany({
        where: { studentId: me.childId, assignment: { status: "SENT" } },
        select: {
          completed: true, completedAt: true, skippedAt: true,
          submission: { select: { correctCount: true, wrongCount: true, createdAt: true } },
          assignment: { select: { subject: true, examType: true, endDate: true } },
        },
      }),
      prisma.studySession.findMany({ where: { studentId: me.childId }, select: { studyDate: true, subject: true, correctCount: true, wrongCount: true } }),
    ]);

    const empty = () => ({ total: 0, due: 0, done: 0, onTime: 0, missed: 0, skipped: 0, open: 0, questions: 0 });
    const addTo = (g, r) => {
      const st = recipientStatus(r, now);
      g.total += 1;
      if (st !== "open") g.due += 1;
      if (st === "done") {
        g.done += 1;
        const at = r.completedAt || r.submission?.createdAt;
        if (at && new Date(at).getTime() <= r.assignment.endDate.getTime() + GRACE) g.onTime += 1;
      }
      if (st === "missed") g.missed += 1;
      if (st === "skipped") g.skipped += 1;
      if (st === "open") g.open += 1;
      if (r.submission) g.questions += r.submission.correctCount + r.submission.wrongCount;
    };
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
    const finish = (g) => ({ ...g, completionRate: pct(g.done, g.due), onTimeRate: pct(g.onTime, g.done) });

    const all = empty();
    const bySubject = new Map();
    for (const r of recipients) {
      addTo(all, r);
      const k = `${r.assignment.examType}|${r.assignment.subject}`;
      if (!bySubject.has(k)) bySubject.set(k, { examType: r.assignment.examType, subject: r.assignment.subject, ...empty(), studyQuestions: 0 });
      addTo(bySubject.get(k), r);
    }
    let studyQuestions = 0;
    for (const s of sessions) {
      const q = s.correctCount + s.wrongCount;
      studyQuestions += q;
      const hit = [...bySubject.values()].find((x) => x.subject === s.subject);
      if (hit) hit.studyQuestions += q;
    }

    // Haftalık (son 8 hafta, ödevin bitiş haftası): tamamlama
    const { mon } = trWeekRange(now);
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const s = new Date(mon.getTime() - (7 - i) * 7 * DAY);
      const e = new Date(s.getTime() + 7 * DAY);
      const g = empty();
      for (const r of recipients) if (r.assignment.endDate >= s && r.assignment.endDate < e) addTo(g, r);
      return { start: ymd(s), total: g.total, done: g.done, completionRate: pct(g.done, g.due) };
    });

    // Çalışılan günler ve seri
    const days = new Set();
    for (const r of recipients) if (r.submission && r.submission.correctCount + r.submission.wrongCount > 0) days.add(trDayKey(r.completedAt || r.submission.createdAt));
    for (const s of sessions) if (s.correctCount + s.wrongCount > 0) days.add(trDayKey(s.studyDate));
    const today = trTodayAsDateOnly(now);
    const last30 = [...days].filter((k) => Date.parse(k) > today.getTime() - 30 * DAY).length;
    let streak = 0;
    let cursor = days.has(ymd(today)) ? today : new Date(today.getTime() - DAY);
    while (days.has(ymd(cursor))) { streak += 1; cursor = new Date(cursor.getTime() - DAY); }

    res.json({
      overall: finish(all),
      studyQuestions,
      activeDays: { total: days.size, last30, streak },
      subjects: [...bySubject.values()].map(finish).sort((a, b) => b.total - a.total || a.subject.localeCompare(b.subject, "tr")),
      weeks,
    });
  } catch (e) {
    handleErr(res, e);
  }
});
