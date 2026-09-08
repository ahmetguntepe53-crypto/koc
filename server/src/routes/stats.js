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

// Kayıtların gerçek zaman damgası (createdAt/studyDate) UTC olarak tutulur, ama "hangi güne ait"
// sorusu öğrenci/öğretmenin bulunduğu Türkiye saatine göre cevaplanmalı (DST yok, sabit UTC+3) —
// aksi halde gece yarısına yakın (00:00-03:00) girilen bir sonuç, ham UTC güne göre gruplanınca bir
// önceki güne/haftaya/aya sayılırdı. Instant'ı önce Türkiye saatine kaydırıp SONRA UTC alanlarını
// okumak, sunucunun kendi işletim sistemi saat diliminden (genelde UTC ama garanti değil) bağımsız
// hale getirir.
const TR_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
function toTurkeyShifted(date) {
  return new Date(new Date(date).getTime() + TR_UTC_OFFSET_MS);
}

// ISO 8601 hafta etiketi ("2026-H33") — Perşembe günü hangi yıla düşüyorsa o yıl/hafta sayılır
// (yıl sınırındaki haftaların yanlış yıla düşmesini engeller). `d` zaten toTurkeyShifted'ten geçmiş
// kabul edilir — bu yüzden UTC alanları okunur.
function isoWeekLabel(d) {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
  return `${day.getUTCFullYear()}-H${String(weekNo).padStart(2, "0")}`;
}

function periodLabel(date, groupBy) {
  const d = toTurkeyShifted(date);
  if (groupBy === "day") return d.toISOString().slice(0, 10);
  if (groupBy === "month") return d.toISOString().slice(0, 7);
  return isoWeekLabel(d);
}

// TYT/AYT/LGS'nin standart net hesaplama formülü: 4 yanlış 1 doğruyu götürür.
function net(correctCount, wrongCount) {
  return Math.round((correctCount - wrongCount / 4) * 100) / 100;
}

// Bir öğrencinin (ödev sonuçları + serbest çalışma kayıtları BİRLİKTE) ders bazlı ve zaman bazlı
// (günlük/haftalık/aylık) performans dökümü — koç bunu "rapor" olarak görür, öğrenci kendi
// verisini görür. DRAFT/gönderilmemiş ödevler ve henüz sonuç girilmemiş atamalar hariçtir (yalnızca
// gerçekten çözülmüş/girilmiş veriler raporlanır).
statsRouter.get("/report", async (req, res) => {
  try {
    const { studentId: queryStudentId, groupBy = "week" } = req.query || {};
    assert(["day", "week", "month"].includes(groupBy), "Geçersiz gruplama");

    let studentId;
    if (req.userRole === "STUDENT") {
      assert(!queryStudentId || queryStudentId === req.userId, "Bu işlem için yetkin yok", 403);
      studentId = req.userId;
    } else if (req.userRole === "TEACHER") {
      assert(queryStudentId, "studentId gerekli", 400);
      const student = await prisma.user.findUnique({ where: { id: queryStudentId } });
      assert(student && student.role === "STUDENT" && student.teacherId === req.userId, "Bu öğrenci sana atanmamış", 403);
      studentId = queryStudentId;
    } else {
      assert(req.userRole === "ADMIN", "Bu işlem için yetkin yok", 403);
      assert(queryStudentId, "studentId gerekli", 400);
      studentId = queryStudentId;
    }

    const [recipients, sessions] = await Promise.all([
      prisma.assignmentRecipient.findMany({
        where: { studentId, submission: { isNot: null } },
        include: { assignment: { select: { subject: true, topic: true } }, submission: true },
      }),
      prisma.studySession.findMany({ where: { studentId } }),
    ]);

    const records = [
      ...recipients.map((r) => ({
        subject: r.assignment.subject, topic: r.assignment.topic,
        correctCount: r.submission.correctCount, wrongCount: r.submission.wrongCount, blankCount: r.submission.blankCount,
        date: r.submission.createdAt,
      })),
      ...sessions.map((s) => ({
        subject: s.subject, topic: s.topic,
        correctCount: s.correctCount, wrongCount: s.wrongCount, blankCount: s.blankCount,
        date: s.studyDate,
      })),
    ];

    const bySubjectMap = new Map();
    const byPeriodMap = new Map();
    const overall = { correctCount: 0, wrongCount: 0, blankCount: 0, count: 0 };

    for (const r of records) {
      overall.correctCount += r.correctCount; overall.wrongCount += r.wrongCount; overall.blankCount += r.blankCount; overall.count += 1;

      const subjectEntry = bySubjectMap.get(r.subject) || { subject: r.subject, correctCount: 0, wrongCount: 0, blankCount: 0, count: 0 };
      subjectEntry.correctCount += r.correctCount; subjectEntry.wrongCount += r.wrongCount; subjectEntry.blankCount += r.blankCount; subjectEntry.count += 1;
      bySubjectMap.set(r.subject, subjectEntry);

      const label = periodLabel(r.date, groupBy);
      const periodEntry = byPeriodMap.get(label) || { period: label, correctCount: 0, wrongCount: 0, blankCount: 0, count: 0 };
      periodEntry.correctCount += r.correctCount; periodEntry.wrongCount += r.wrongCount; periodEntry.blankCount += r.blankCount; periodEntry.count += 1;
      byPeriodMap.set(label, periodEntry);
    }

    const withNet = (e) => ({ ...e, net: net(e.correctCount, e.wrongCount) });
    const bySubject = [...bySubjectMap.values()].map(withNet).sort((a, b) => b.net - a.net);
    const byPeriod = [...byPeriodMap.values()].map(withNet).sort((a, b) => a.period.localeCompare(b.period));

    res.json({ overall: withNet(overall), bySubject, byPeriod });
  } catch (e) {
    handleErr(res, e);
  }
});
