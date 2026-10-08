import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { recipientStatus, netOf, questionCountOf } from "../weekStats.js";
import { trTodayAsDateOnly } from "../quietHours.js";
import { adminLeaderboardRouter } from "./adminLeaderboard.js";
import { adminActivityRouter } from "./adminActivity.js";
import { adminAnalyticsRouter } from "./adminAnalytics.js";
import { principalStatsRouter } from "./principalStats.js";
import { DAY, periodRange, parsePeriod, emptyAgg, add, finish, bump, loadRecipients } from "../principalAgg.js";

// Okul müdürü paneli — YALNIZCA okur (app.js'de requireRole("PRINCIPAL", "ADMIN")). Sınıf, öğrenci, ders ve öğretmen
// bazında ödev takibi. Tanımlar Öğrencilerim ekranıyla aynı:
//  • Tamamlama: öğrencinin sorumlu olduğu (tamamladığı ya da süresi dolmuş) ödevlerin yüzde kaçını tamamladığı.
//  • Başarı: teslim edilen ödevlerde toplam net / toplam soru (soru sayısı "N soru"dan, yoksa girilen D+Y+B).
//  • Gecikti: süresi dolmuş, sonucu girilmemiş ve pas geçilmemiş.
// Dönem, ödevin bitiş gününe göre: bu hafta (Pzt–Paz), bu ay ya da tüm dönem.
export const principalRouter = Router();

// GET /api/principal/overview?period=week|month|all — okul geneli, sınıf, ders ve öğretmen özetleri.
principalRouter.get("/overview", async (req, res) => {
  try {
    const period = parsePeriod(req);
    const now = new Date();
    const [students, teachers, recipients] = await Promise.all([
      prisma.user.findMany({ where: { role: "STUDENT", banned: false }, select: { id: true, className: true, gradeLevel: true, lastSeenAt: true, teacherId: true } }),
      prisma.user.findMany({ where: { role: "TEACHER", banned: false }, select: { id: true, name: true, isSubjectTeacher: true, teachingSubjects: true, lastSeenAt: true } }),
      loadRecipients(period, now),
    ]);
    const school = emptyAgg();
    const byClass = new Map();
    const bySubject = new Map();
    const byTeacher = new Map();
    const assignmentIds = new Set();
    for (const r of recipients) {
      add(school, r, now);
      assignmentIds.add(r.assignment.id);
      const cls = r.student.className || "Şubesiz";
      add(bump(byClass, cls, { className: cls, gradeLevel: r.student.gradeLevel }).agg, r, now);
      const sk = `${r.assignment.examType}|${r.assignment.subject}`;
      add(bump(bySubject, sk, { subject: r.assignment.subject, examType: r.assignment.examType, assignments: new Set() }).agg, r, now);
      bySubject.get(sk).assignments.add(r.assignment.id);
      const t = bump(byTeacher, r.assignment.teacherId, { assignments: new Set() });
      add(t.agg, r, now);
      t.assignments.add(r.assignment.id);
    }
    const weekAgo = now.getTime() - 7 * DAY;
    const classStudents = new Map();
    for (const s of students) {
      const cls = s.className || "Şubesiz";
      classStudents.set(cls, (classStudents.get(cls) || 0) + 1);
    }
    const coached = new Map();
    for (const s of students) if (s.teacherId) coached.set(s.teacherId, (coached.get(s.teacherId) || 0) + 1);

    res.json({
      period,
      students: { total: students.length, activeWeek: students.filter((s) => s.lastSeenAt && s.lastSeenAt.getTime() >= weekAgo).length },
      school: { ...finish(school), assignments: assignmentIds.size },
      classes: [...new Set([...classStudents.keys(), ...byClass.keys()])]
        .map((cls) => {
          const c = byClass.get(cls);
          return { className: cls, gradeLevel: c?.gradeLevel ?? students.find((s) => (s.className || "Şubesiz") === cls)?.gradeLevel ?? null, students: classStudents.get(cls) || 0, ...finish(c?.agg || emptyAgg()) };
        })
        .sort((a, b) => (a.gradeLevel ?? 99) - (b.gradeLevel ?? 99) || a.className.localeCompare(b.className, "tr")),
      subjects: [...bySubject.values()]
        .map((x) => ({ subject: x.subject, examType: x.examType, assignments: x.assignments.size, ...finish(x.agg) }))
        .sort((a, b) => (a.examType === b.examType ? 0 : a.examType === "TYT" ? -1 : 1) || a.subject.localeCompare(b.subject, "tr")),
      teachers: teachers
        .map((t) => {
          const x = byTeacher.get(t.id);
          return {
            id: t.id, name: t.name, isSubjectTeacher: t.isSubjectTeacher, teachingSubjects: t.teachingSubjects, lastSeenAt: t.lastSeenAt,
            coachedStudents: coached.get(t.id) || 0, assignmentsSent: x ? x.assignments.size : 0, ...finish(x?.agg || emptyAgg()),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    });
  } catch (e) {
    handleErr(res, e);
  }
});

// GET /api/principal/students?period= — öğrenci öğrenci tamamlama, başarı, gecikme.
principalRouter.get("/students", async (req, res) => {
  try {
    const period = parsePeriod(req);
    const now = new Date();
    const range = periodRange(period, now);
    const [students, recipients, study] = await Promise.all([
      prisma.user.findMany({
        where: { role: "STUDENT", banned: false },
        select: { id: true, name: true, avatar: true, className: true, gradeLevel: true, field: true, lastSeenAt: true, teacher: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      loadRecipients(period, now),
      // Serbest çalışmada çözülen soru (İstatistik > şube ayrıntısı).
      prisma.studySession.groupBy({
        by: ["studentId"],
        where: range ? { studyDate: { gte: range[0], lt: range[1] } } : {},
        _sum: { correctCount: true, wrongCount: true, blankCount: true },
      }),
    ]);
    const studyQ = new Map(study.map((x) => [x.studentId, (x._sum.correctCount || 0) + (x._sum.wrongCount || 0) + (x._sum.blankCount || 0)]));
    const by = new Map();
    for (const r of recipients) {
      if (!by.has(r.studentId)) by.set(r.studentId, emptyAgg());
      add(by.get(r.studentId), r, now);
    }
    res.json({
      period,
      students: students.map((s) => ({
        id: s.id, name: s.name, avatar: s.avatar, className: s.className, gradeLevel: s.gradeLevel, field: s.field, lastSeenAt: s.lastSeenAt,
        coachName: s.teacher?.name || null, ...finish(by.get(s.id) || emptyAgg()), studyQuestions: studyQ.get(s.id) || 0,
      })),
    });
  } catch (e) {
    handleErr(res, e);
  }
});

// ESKİ UÇ — yayındaki Android/iOS 2.0, müdür öğrenci detayını buradan okur; 2.1+ /overview'u kullanır.
// 2.0 kullanıcıları kalmayana kadar silme.
// GET /api/principal/students/:id?period= — tek öğrencinin ders ders durumu ve son ödevleri.
principalRouter.get("/students/:id", async (req, res) => {
  try {
    const period = parsePeriod(req);
    const now = new Date();
    const student = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, avatar: true, role: true, className: true, gradeLevel: true, field: true, lastSeenAt: true, teacher: { select: { name: true } } },
    });
    assert(student && student.role === "STUDENT", "Öğrenci bulunamadı", 404);
    const recipients = await loadRecipients(period, now, { studentId: student.id });
    const total = emptyAgg();
    const bySubject = new Map();
    for (const r of recipients) {
      add(total, r, now);
      const sk = `${r.assignment.examType}|${r.assignment.subject}`;
      add(bump(bySubject, sk, { subject: r.assignment.subject, examType: r.assignment.examType }).agg, r, now);
    }
    const recent = [...recipients]
      .sort((a, b) => b.assignment.endDate - a.assignment.endDate)
      .slice(0, 15)
      .map((r) => {
        const q = r.submission ? (questionCountOf(r.assignment.pageRange) || r.submission.correctCount + r.submission.wrongCount + r.submission.blankCount) : null;
        const net = netOf(r.submission);
        return {
          id: r.id, subject: r.assignment.subject, examType: r.assignment.examType, topic: r.assignment.topic, endDate: r.assignment.endDate,
          status: recipientStatus(r, now), net, successPct: net != null && q ? Math.round((net / q) * 100) : null,
        };
      });
    const { role, teacher, ...info } = student;
    res.json({
      period,
      student: { ...info, coachName: teacher?.name || null },
      total: finish(total),
      subjects: [...bySubject.values()]
        .map((x) => ({ subject: x.subject, examType: x.examType, ...finish(x.agg) }))
        .sort((a, b) => (a.examType === b.examType ? 0 : a.examType === "TYT" ? -1 : 1) || a.subject.localeCompare(b.subject, "tr")),
      recent,
    });
  } catch (e) {
    handleErr(res, e);
  }
});

// GET /api/principal/students/:id/overview — koçun öğrenci ekranıyla aynı veri (ödev geçmişi, serbest çalışma, sonuçlar),
// koçun ÖZEL NOTLARI hariç (onları yalnızca yazan koç görür) ve başka öğretmenlerin taslakları hariç.
principalRouter.get("/students/:id/overview", async (req, res) => {
  try {
    const student = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, avatar: true, email: true, username: true, className: true, gradeLevel: true, field: true, banned: true, teacherId: true, role: true, lastSeenAt: true, createdAt: true, teacher: { select: { name: true } } },
    });
    assert(student && student.role === "STUDENT", "Öğrenci bulunamadı", 404);
    const [recipients, studySessions] = await Promise.all([
      prisma.assignmentRecipient.findMany({
        where: { studentId: student.id, assignment: { status: "SENT" } },
        include: { assignment: { include: { teacher: { select: { id: true, name: true } } } }, submission: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.studySession.findMany({ where: { studentId: student.id }, orderBy: { studyDate: "desc" } }),
    ]);
    const { teacher, ...info } = student;
    res.json({ student: { ...info, coachName: teacher?.name || null, coachNote: null }, recipients, studySessions, notes: [] });
  } catch (e) {
    handleErr(res, e);
  }
});

// Öğrenci adıyla genel başarı sıralaması (yöneticinin "Sıralama" sekmesiyle aynı veri ve uç).
principalRouter.use("/leaderboard", adminLeaderboardRouter);
// İstatistik > Aktivite'deki kutulara dokununca: o gruptaki kişiler, son giriş zamanıyla (KULLANICI İSTEĞİ 2026-10-07:
// "6 öğretmen giriş yapmadı diyor, kim, en son ne zaman giriş yapmış"). Yöneticinin Aktivite ekranı yalnız sayı gösterir;
// bu liste müdür ekranı içindir (müdür öğrenci/öğretmen listelerinde kişileri zaten adıyla görüyor).
// GET /api/principal/activity-people?role=STUDENT|TEACHER&group=today|week|inactive
const PEOPLE_GROUPS = ["today", "week", "inactive"];
principalRouter.get("/activity-people", async (req, res) => {
  try {
    const { role, group } = req.query || {};
    assert(["STUDENT", "TEACHER"].includes(role), "Geçersiz rol");
    assert(PEOPLE_GROUPS.includes(group), "Geçersiz grup (today, week ya da inactive)");
    const today = trTodayAsDateOnly(new Date());
    const weekFrom = new Date(today.getTime() - 6 * DAY);
    // adminActivity.js ile aynı tanımlar: "son 7 gün" = bugün dahil 7 takvim günü (LoginDay); "girmeyen" = lastSeenAt yok
    // ya da 7 günden eski.
    const inactiveCutoff = new Date(today.getTime() - 7 * DAY);
    const [users, days] = await Promise.all([
      prisma.user.findMany({
        where: { role, banned: false },
        select: { id: true, name: true, avatar: true, className: true, gradeLevel: true, isSubjectTeacher: true, teachingSubjects: true, lastSeenAt: true, createdAt: true, teacher: { select: { name: true } } },
      }),
      prisma.loginDay.findMany({ where: { day: { gte: weekFrom }, user: { role } }, select: { userId: true, day: true } }),
    ]);
    const daysOf = new Map();
    const todayIds = new Set();
    for (const d of days) {
      daysOf.set(d.userId, (daysOf.get(d.userId) || 0) + 1);
      if (d.day.getTime() === today.getTime()) todayIds.add(d.userId);
    }
    const pick = group === "today" ? (u) => todayIds.has(u.id)
      : group === "week" ? (u) => daysOf.has(u.id)
      : (u) => !u.lastSeenAt || u.lastSeenAt < inactiveCutoff;
    const people = users.filter(pick).map((u) => ({
      id: u.id, name: u.name, avatar: u.avatar, className: u.className, gradeLevel: u.gradeLevel, coachName: u.teacher?.name || null,
      isSubjectTeacher: u.isSubjectTeacher, teachingSubjects: u.teachingSubjects,
      lastSeenAt: u.lastSeenAt, createdAt: u.createdAt, daysThisWeek: daysOf.get(u.id) || 0,
    }));
    // Girenler: en son gireni üstte. Girmeyenler: hiç girmeyenler üstte, sonra en uzun süredir girmeyen.
    const t = (u) => (u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0);
    people.sort((a, b) => (group === "inactive" ? t(a) - t(b) : t(b) - t(a)) || a.name.localeCompare(b.name, "tr"));
    res.json({ role, group, people });
  } catch (e) {
    handleErr(res, e);
  }
});

// İstatistik sekmesi: okul/sınıf/ders kırılımları + yöneticinin Aktivite ve Okul analizi uçları (aynı veri, toplu sayılar).
principalRouter.use("/stats", principalStatsRouter);
principalRouter.use("/activity", adminActivityRouter);
principalRouter.use("/analytics", adminAnalyticsRouter);
