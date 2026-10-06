import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { trWeekRange } from "../weekStats.js";
import { trTodayAsDateOnly } from "../quietHours.js";
import { DAY, periodRange, parsePeriod, emptyAgg, add, finish, bump, loadRecipients, loadRecipientsInRange } from "../principalAgg.js";

// Müdür > İstatistik (KULLANICI İSTEĞİ 2026-10-06: "tüm okul, sınıf, öğrenci istatistikleri, admin panelindeki gibi detaylı").
// principalRouter'a bağlıdır (app.js'de requireRole("PRINCIPAL", "ADMIN")). Tek uçta okul geneli, sınıf düzeyi, şube ve ders
// kırılımları + son 8 haftanın eğilimi. Öğrenci öğrenci döküm /principal/students'ta (şube ayrıntısı oradan süzülür).
//
// Tanımlar principalAgg.js ile aynı (tamamlama, başarı, gecikti). Ek ölçüler:
//  • Aktif: o pencerede (bugün / son 7 gün) en az bir kez giriş yapan öğrenci (LoginDay — geçmişe dönük doğru).
//  • Serbest çalışma: öğrencinin kendi girdiği çalışmalar (StudySession), dönem çalışma gününe göre.
//  • Pas sebepleri: KONU / ZAMAN / KAYNAK / DIGER (tanınmayan eski değer DIGER'e sayılır).
export const principalStatsRouter = Router();

const WEEKS = 8;
const SKIP_KEYS = ["KONU", "ZAMAN", "KAYNAK", "DIGER"];
const emptySkips = () => ({ KONU: 0, ZAMAN: 0, KAYNAK: 0, DIGER: 0 });
const questionsOf = (s) => s.correctCount + s.wrongCount + s.blankCount;
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);

// Bir grubun (okul, sınıf düzeyi, şube) öğrenci ve etkinlik sayıları.
function peopleOf(ids, { activeToday, activeWeek, lastSeen, weekAgo }) {
  let today = 0, week = 0, inactive = 0, never = 0;
  for (const id of ids) {
    if (activeToday.has(id)) today += 1;
    if (activeWeek.has(id)) week += 1;
    const seen = lastSeen.get(id);
    if (!seen) never += 1;
    if (!seen || seen.getTime() < weekAgo) inactive += 1;
  }
  return { students: ids.length, activeToday: today, activeWeek: week, activeWeekPct: pct(week, ids.length), inactive, never };
}

// GET /api/principal/stats?period=week|month|all
principalStatsRouter.get("/", async (req, res) => {
  try {
    const period = parsePeriod(req);
    const now = new Date();
    const range = periodRange(period, now);
    const today = trTodayAsDateOnly(now);
    const weekAgoDay = new Date(today.getTime() - 6 * DAY);
    const { mon } = trWeekRange(now);
    const trendFrom = new Date(mon.getTime() - (WEEKS - 1) * 7 * DAY);
    const trendTo = new Date(mon.getTime() + 7 * DAY);
    const studyWhere = (r) => ({ student: { role: "STUDENT", banned: false }, ...(r ? { studyDate: { gte: r[0], lt: r[1] } } : {}) });

    const [students, recipients, study, trendRecipients, trendStudy, logins, exams] = await Promise.all([
      prisma.user.findMany({ where: { role: "STUDENT", banned: false }, select: { id: true, className: true, gradeLevel: true, lastSeenAt: true } }),
      loadRecipients(period, now),
      prisma.studySession.findMany({ where: studyWhere(range), select: { studentId: true, examType: true, subject: true, correctCount: true, wrongCount: true, blankCount: true } }),
      loadRecipientsInRange([trendFrom, trendTo]),
      prisma.studySession.findMany({ where: studyWhere([trendFrom, trendTo]), select: { studyDate: true, correctCount: true, wrongCount: true, blankCount: true } }),
      prisma.loginDay.findMany({ where: { day: { gte: trendFrom }, user: { role: "STUDENT", banned: false } }, select: { day: true, userId: true } }),
      prisma.practiceExam.findMany({
        where: { student: { role: "STUDENT", banned: false }, ...(range ? { date: { gte: range[0], lt: range[1] } } : {}) },
        select: { studentId: true, examType: true, results: { select: { correct: true, wrong: true } } },
      }),
    ]);

    const info = new Map(students.map((s) => [s.id, s]));
    const lastSeen = new Map(students.map((s) => [s.id, s.lastSeenAt]));
    const activeToday = new Set(logins.filter((l) => l.day.getTime() === today.getTime()).map((l) => l.userId));
    const activeWeek = new Set(logins.filter((l) => l.day.getTime() >= weekAgoDay.getTime()).map((l) => l.userId));
    const ctx = { activeToday, activeWeek, lastSeen, weekAgo: now.getTime() - 7 * DAY };

    // ---- ödevler: okul, sınıf düzeyi, şube, ders
    const school = emptyAgg();
    const schoolSkips = emptySkips();
    const assignmentIds = new Set();
    const byGrade = new Map(), byClass = new Map(), bySubject = new Map();
    for (const r of recipients) {
      add(school, r, now);
      assignmentIds.add(r.assignment.id);
      const g = r.student.gradeLevel ?? "Diğer";
      add(bump(byGrade, g, {}).agg, r, now);
      add(bump(byClass, r.student.className || "Şubesiz", {}).agg, r, now);
      const sk = `${r.assignment.examType}|${r.assignment.subject}`;
      const sub = bump(bySubject, sk, { examType: r.assignment.examType, subject: r.assignment.subject, assignments: new Set(), skips: emptySkips(), studyQuestions: 0 });
      add(sub.agg, r, now);
      sub.assignments.add(r.assignment.id);
      if (r.skippedAt) {
        const key = SKIP_KEYS.includes(r.skipReason) ? r.skipReason : "DIGER";
        schoolSkips[key] += 1;
        sub.skips[key] += 1;
      }
    }

    // ---- serbest çalışma
    const studyByStudent = new Map();
    let studyQuestions = 0;
    for (const s of study) {
      const q = questionsOf(s);
      studyQuestions += q;
      studyByStudent.set(s.studentId, (studyByStudent.get(s.studentId) || 0) + q);
      const sub = bySubject.get(`${s.examType}|${s.subject}`) || bump(bySubject, `${s.examType}|${s.subject}`, { examType: s.examType, subject: s.subject, assignments: new Set(), skips: emptySkips(), studyQuestions: 0 });
      sub.studyQuestions += q;
    }
    const studyOfGroup = (ids) => ids.reduce((n, id) => n + (studyByStudent.get(id) || 0), 0);

    // ---- denemeler: deneme başına toplam net (D − Y/4), sınav türüne göre ortalama
    const examAvg = {};
    for (const t of ["TYT", "AYT"]) {
      const list = exams.filter((e) => e.examType === t).map((e) => e.results.reduce((n, x) => n + x.correct - x.wrong / 4, 0));
      examAvg[t] = list.length ? { count: list.length, avgNet: Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100 } : { count: 0, avgNet: null };
    }

    // ---- gruplar
    const groupIds = (pred) => students.filter(pred).map((s) => s.id);
    const grades = [...new Set(students.map((s) => s.gradeLevel ?? "Diğer"))]
      .sort((a, b) => (a === "Diğer" ? 1 : b === "Diğer" ? -1 : a - b))
      .map((g) => {
        const ids = groupIds((s) => (s.gradeLevel ?? "Diğer") === g);
        return { gradeLevel: g === "Diğer" ? null : g, ...peopleOf(ids, ctx), ...finish(byGrade.get(g)?.agg || emptyAgg()), studyQuestions: studyOfGroup(ids) };
      });
    const classes = [...new Set([...students.map((s) => s.className || "Şubesiz"), ...byClass.keys()])]
      .map((cls) => {
        const ids = groupIds((s) => (s.className || "Şubesiz") === cls);
        const gradeLevel = students.find((s) => (s.className || "Şubesiz") === cls)?.gradeLevel ?? null;
        return { className: cls, gradeLevel, ...peopleOf(ids, ctx), ...finish(byClass.get(cls)?.agg || emptyAgg()), studyQuestions: studyOfGroup(ids) };
      })
      .sort((a, b) => (a.gradeLevel ?? 99) - (b.gradeLevel ?? 99) || a.className.localeCompare(b.className, "tr"));
    const subjects = [...bySubject.values()]
      .map((x) => ({ examType: x.examType, subject: x.subject, assignments: x.assignments.size, ...finish(x.agg), skips: x.skips, studyQuestions: x.studyQuestions }))
      .sort((a, b) => (a.examType === b.examType ? 0 : a.examType === "TYT" ? -1 : 1) || a.subject.localeCompare(b.subject, "tr"));

    // ---- son 8 hafta (dönemden bağımsız): tamamlama, başarı, çözülen soru, aktif öğrenci
    const weekIdx = (d) => Math.floor((d.getTime() - trendFrom.getTime()) / (7 * DAY));
    const weeks = Array.from({ length: WEEKS }, (_, i) => ({ start: new Date(trendFrom.getTime() + i * 7 * DAY).toISOString().slice(0, 10), agg: emptyAgg(), studyQuestions: 0, active: new Set() }));
    for (const r of trendRecipients) {
      if (!info.has(r.studentId)) continue;
      const w = weeks[weekIdx(r.assignment.endDate)];
      if (w) add(w.agg, r, now);
    }
    for (const s of trendStudy) {
      const w = weeks[weekIdx(s.studyDate)];
      if (w) w.studyQuestions += questionsOf(s);
    }
    for (const l of logins) {
      const w = weeks[weekIdx(l.day)];
      if (w) w.active.add(l.userId);
    }

    const all = students.map((s) => s.id);
    res.json({
      period,
      people: peopleOf(all, ctx),
      school: {
        ...finish(school),
        assignments: assignmentIds.size,
        skipped: Object.values(schoolSkips).reduce((a, b) => a + b, 0),
        skips: schoolSkips,
        studyQuestions,
        studySessions: study.length,
        studyStudents: new Set(study.map((s) => s.studentId)).size,
        exams: examAvg,
        examStudents: new Set(exams.map((e) => e.studentId)).size,
      },
      grades,
      classes,
      subjects,
      weeks: weeks.map((w) => ({ start: w.start, ...finish(w.agg), studyQuestions: w.studyQuestions, activeStudents: w.active.size })),
    });
  } catch (e) {
    handleErr(res, e);
  }
});
