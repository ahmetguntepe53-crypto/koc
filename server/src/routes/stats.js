import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { questionCountOf } from "../weekStats.js";
import { serializePracticeExam } from "../practiceExams.js";

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
// Raporu kimin görebileceği: öğrenci yalnızca kendini, koç yalnızca kendi öğrencisini, admin herkesi.
async function resolveReportStudent(req, queryStudentId) {
  if (req.userRole === "STUDENT") {
    assert(!queryStudentId || queryStudentId === req.userId, "Bu işlem için yetkin yok", 403);
    return req.userId;
  }
  if (req.userRole === "TEACHER") {
    assert(queryStudentId, "studentId gerekli", 400);
    const student = await prisma.user.findUnique({ where: { id: queryStudentId } });
    assert(student && student.role === "STUDENT" && student.teacherId === req.userId, "Bu öğrenci sana atanmamış", 403);
    return queryStudentId;
  }
  // Okul müdürü ve yönetici: okuldaki herhangi bir öğrencinin raporu (müdür yalnızca okur).
  assert(req.userRole === "ADMIN" || req.userRole === "PRINCIPAL", "Bu işlem için yetkin yok", 403);
  assert(queryStudentId, "studentId gerekli", 400);
  return queryStudentId;
}

// Ayrıntılı başarı raporu v2 (src/reportModel.js hesaplar; ekran ve PDF aynı modeli kullanır). Sunucu yalnızca
// öğrencinin KENDİ kayıtlarını ve okul geneli ödevlerde TOPLU karşılaştırmayı döndürür:
//  • Karşılaştırma grubu: aynı sınıf düzeyinde (11/12) bu ödevi geçerli teslim etmiş DİĞER öğrenciler (öğrencinin
//    kendisi ve kısmi teslimler hariç; geçerli = beklenen soru E biliniyorsa Q ≥ 0,8·E, bilinmiyorsa Q ≥ 10).
//    10'dan azsa tüm okul; orada da 10'dan azsa karşılaştırma yok (k-anonimlik).
//  • Ödev başına yalnızca medyan, Q1, Q3, n, alıcı sayısı, katılım ve öğrencinin kendi yüzdeliği gider; ayrıca okul
//    genelindeki "konuyu bilmiyorum" pas oranı (alıcı ≥ 10 ise).
//    Başka öğrencinin tekil değeri, adı, min/max ya da tam sıra ASLA dönmez.
//  • Koça özel alanlar (teslim/pas notları, fotoğraf sayısı, son giriş) yalnızca koç ve admin yanıtında bulunur.
const MIN_COMPARE = 10;
const ratePct = (c, w, b) => { const q = c + w + b; return q ? ((c - w / 4) / q) * 100 : null; };
const isValidSubmission = (q, expected) => (expected ? q >= 0.8 * expected : q >= 10);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
function quantile(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function schoolComparison(group, mine, expected) {
  const rates = [];
  let completed = 0;
  for (const o of group) {
    if (!o.submission) continue;
    completed += 1;
    const { correctCount: c, wrongCount: w, blankCount: b } = o.submission;
    if (!isValidSubmission(c + w + b, expected)) continue;
    const r = ratePct(c, w, b);
    if (r != null) rates.push(r);
  }
  if (rates.length < MIN_COMPARE) return null;
  rates.sort((a, b) => a - b);
  let pct = null;
  if (mine != null) {
    const below = rates.filter((r) => r < mine - 1e-9).length;
    const equal = rates.filter((r) => Math.abs(r - mine) <= 1e-9).length;
    pct = Math.round((100 * (below + 0.5 * equal)) / rates.length);
  }
  return {
    n: rates.length,
    recipients: group.length,
    participation: group.length ? Math.round((completed / group.length) * 100) : null,
    median: r1(quantile(rates, 0.5)),
    q1: r1(quantile(rates, 0.25)),
    q3: r1(quantile(rates, 0.75)),
    pct,
  };
}

statsRouter.get("/full-report", async (req, res) => {
  try {
    const studentId = await resolveReportStudent(req, req.query?.studentId);
    const isCoachView = req.userRole !== "STUDENT";
    const [student, recipients, sessions, settings, practiceExams] = await Promise.all([
      prisma.user.findUnique({ where: { id: studentId }, select: { id: true, name: true, className: true, gradeLevel: true, field: true, lastSeenAt: true, createdAt: true, teacher: { select: { name: true } } } }),
      prisma.assignmentRecipient.findMany({
        where: { studentId, assignment: { status: "SENT", examType: { in: ["TYT", "AYT"] } } },
        include: {
          assignment: { select: { id: true, examType: true, subject: true, topic: true, sourceBook: true, pageRange: true, scheduledDate: true, endDate: true, targetMode: true, teacher: { select: { name: true } } } },
          submission: { select: { correctCount: true, wrongCount: true, blankCount: true, note: true, questionNumbers: true, createdAt: true } },
          _count: { select: { photos: true } },
        },
        orderBy: { assignment: { endDate: "asc" } },
      }),
      prisma.studySession.findMany({ where: { studentId, examType: { in: ["TYT", "AYT"] } }, orderBy: { studyDate: "asc" } }),
      prisma.schoolSettings.findUnique({ where: { id: "singleton" } }),
      // Deneme sınavları — öğrencinin kendi kaydı (başkasının denemesi hiçbir görünümde dönmez); eskiden yeniye.
      prisma.practiceExam.findMany({
        where: { studentId, examType: { in: ["TYT", "AYT"] } }, include: { results: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    // Okul geneli ödevlerin diğer alıcıları — yalnızca toplu hesap için; istemciye tekil satır gitmez.
    const schoolWideIds = recipients.filter((r) => r.assignment.targetMode === "SCHOOL_WIDE").map((r) => r.assignment.id);
    const others = schoolWideIds.length ? await prisma.assignmentRecipient.findMany({
      where: { assignmentId: { in: schoolWideIds }, studentId: { not: studentId } },
      select: {
        assignmentId: true, completed: true, skipReason: true,
        student: { select: { gradeLevel: true } },
        submission: { select: { correctCount: true, wrongCount: true, blankCount: true } },
      },
    }) : [];
    const othersByAssignment = new Map();
    for (const o of others) {
      const l = othersByAssignment.get(o.assignmentId) || [];
      l.push(o);
      othersByAssignment.set(o.assignmentId, l);
    }

    const items = recipients.map((r) => {
      const a = r.assignment;
      const sub = r.submission;
      const expected = questionCountOf(a.pageRange);
      let school = null;
      let konuSkipRate = null;
      if (a.targetMode === "SCHOOL_WIDE") {
        const all = othersByAssignment.get(a.id) || [];
        if (all.length + 1 >= MIN_COMPARE) {
          const konu = all.filter((o) => !o.completed && o.skipReason === "KONU").length + (!r.completed && r.skipReason === "KONU" ? 1 : 0);
          konuSkipRate = Math.round((konu / (all.length + 1)) * 100);
        }
        const q = sub ? sub.correctCount + sub.wrongCount + sub.blankCount : 0;
        const mine = sub && isValidSubmission(q, expected) ? ratePct(sub.correctCount, sub.wrongCount, sub.blankCount) : null;
        const sameGrade = student.gradeLevel ? all.filter((o) => o.student.gradeLevel === student.gradeLevel) : [];
        school = schoolComparison(sameGrade, mine, expected);
        if (school) school.scope = "grade";
        else {
          school = schoolComparison(all, mine, expected);
          if (school) school.scope = "school";
        }
      }
      const item = {
        id: r.id,
        assignmentId: a.id,
        examType: a.examType,
        subject: a.subject,
        topic: a.topic,
        sourceBook: a.sourceBook,
        source: a.targetMode === "SCHOOL_WIDE" ? "branch" : "coach",
        teacher: a.teacher?.name || null,
        expected,
        scheduledDate: a.scheduledDate,
        endDate: a.endDate,
        completed: r.completed,
        completedAt: r.completedAt,
        skippedAt: r.completed ? null : r.skippedAt,
        skipReason: r.completed ? null : r.skipReason,
        // Pas geçilip sonra teslim edildiyse pasın zamanı/sebebi — rapor bunu gecikme saymaz (bkz. reportModel.js).
        priorSkippedAt: r.completed ? r.priorSkippedAt : null,
        priorSkipReason: r.completed ? r.priorSkipReason : null,
        reminderAt: r.overdueReminderSentAt,
        correct: sub?.correctCount ?? null,
        wrong: sub?.wrongCount ?? null,
        blank: sub?.blankCount ?? null,
        questionNumbers: sub?.questionNumbers || [],
        school,
        konuSkipRate,
      };
      if (isCoachView) {
        item.note = sub?.note || null;
        item.skipNote = r.completed ? null : r.skipNote || null;
        item.photos = r._count.photos;
      }
      return item;
    });

    res.json({
      viewer: isCoachView ? "coach" : "student",
      student: {
        id: student.id, name: student.name, className: student.className, gradeLevel: student.gradeLevel,
        // YKS alanı (SAY/EA/SOZ/DIL, null = bilinmiyor) — model AYT'de hangi derslerin izleneceğini buradan bilir.
        field: student.field ?? null,
        createdAt: student.createdAt, coach: student.teacher?.name || null,
        ...(isCoachView ? { lastSeenAt: student.lastSeenAt } : {}),
      },
      generatedAt: new Date(),
      yksExamDate: settings?.yksExamDate || null,
      items,
      sessions: sessions.map((s) => ({
        id: s.id, examType: s.examType, subject: s.subject, topic: s.topic, sourceBook: s.sourceBook, date: s.studyDate,
        correct: s.correctCount, wrong: s.wrongCount, blank: s.blankCount, questionNumbers: s.questionNumbers || [],
        ...(isCoachView ? { note: s.note || null } : {}),
      })),
      // Deneme sınavları (ders ders D/Y/B) — model "Denemeler" bölümünü buradan kurar (src/reportModel.js > denemeler).
      // Yeni alan, yalnızca ekleme: eski uygulama sürümleri tanımadığı alanı yok sayar.
      practiceExams: practiceExams.map((e) => serializePracticeExam(e, { role: req.userRole, userId: req.userId })),
    });
  } catch (e) {
    handleErr(res, e);
  }
});

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
