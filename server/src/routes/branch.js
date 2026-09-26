import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { branchOfSubject, isValidSubject, EXAM_TYPES, trackForGrade } from "../subjects.js";
import { notifyUser } from "../notify.js";
import { recipientStatus, netOf, questionCountOf, trWeekRange } from "../weekStats.js";

// Branş öğretmeni ekranı (bkz. src/screens/teacher/BranchScreen.jsx). server/src/app.js'de requireAuth +
// requireRole("TEACHER") ile mount edilir; her uç nokta ayrıca isSubjectTeacher'ı ve dersin öğretmenin
// branşında olduğunu doğrular. ROL SINIRI: branş öğretmeni yalnızca KENDİ yayınladığı okul çapındaki
// ödevlerin toplu sonuçlarını görür — öğrenci adı yok, başka dersin verisi yok. Sonuç girmeyenlerin
// takibi koçlarındadır; buradan yalnızca koçlara özet gönderilebilir.
export const branchRouter = Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const COACH_REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

async function loadBranchTeacher(req) {
  const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, name: true, isSubjectTeacher: true, teachingSubjects: true } });
  assert(me?.isSubjectTeacher && me.teachingSubjects.length > 0, "Bu ekran branş öğretmenleri içindir", 403);
  return me;
}

// Öğretmenin branşındaki (sınav türü + ders) izler — ör. Ali Hoca: TYT Matematik, AYT Matematik.
// Yayınladığı okul çapındaki ödevlerden ve yıllık plan kayıtlarından toplanır.
branchRouter.get("/tracks", async (req, res) => {
  try {
    const me = await loadBranchTeacher(req);
    const [assignments, entries] = await Promise.all([
      prisma.assignment.findMany({ where: { teacherId: me.id, targetMode: "SCHOOL_WIDE" }, select: { examType: true, subject: true }, distinct: ["examType", "subject"] }),
      prisma.planEntry.findMany({ where: { teacherId: me.id, kind: "TOPIC" }, select: { examType: true, subject: true }, distinct: ["examType", "subject"] }),
    ]);
    const seen = new Map();
    for (const t of [...entries, ...assignments]) {
      if (!t.subject || !EXAM_TYPES.includes(t.examType)) continue;
      if (!me.teachingSubjects.includes(branchOfSubject(t.subject))) continue;
      seen.set(`${t.examType}|${t.subject}`, { examType: t.examType, subject: t.subject });
    }
    const tracks = [...seen.values()].sort((a, b) => a.examType.localeCompare(b.examType) || a.subject.localeCompare(b.subject, "tr"));
    res.json({ teacher: { name: me.name, teachingSubjects: me.teachingSubjects }, tracks });
  } catch (e) {
    handleErr(res, e);
  }
});

function summarize(assignment, now) {
  const q = questionCountOf(assignment.pageRange);
  const counts = { total: 0, done: 0, skipped: 0, missed: 0, open: 0 };
  const nets = [];
  const skipReasons = { KONU: 0, ZAMAN: 0, KAYNAK: 0, DIGER: 0 };
  let answered = 0;
  for (const r of assignment.recipients) {
    const status = recipientStatus({ ...r, assignment }, now);
    counts.total += 1;
    counts[status] += 1;
    if (status === "skipped" && skipReasons[r.skipReason] != null) skipReasons[r.skipReason] += 1;
    const net = netOf(r.submission);
    if (net != null) {
      nets.push(net);
      answered += r.submission.correctCount + r.submission.wrongCount + r.submission.blankCount;
    }
  }
  const avgNet = nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : null;
  // Başarı yüzdesi: soru sayıları haftadan haftaya değiştiği için (90–150) iki ödevin netini değil
  // yüzdesini karşılaştırmak anlamlı. Soru sayısı yazılmamışsa girilen D+Y+B toplamından.
  const perStudentQ = q || (nets.length ? answered / nets.length : null);
  const successPct = avgNet != null && perStudentQ ? Math.round((avgNet / perStudentQ) * 100) : null;
  return {
    id: assignment.id, topic: assignment.topic, subject: assignment.subject, examType: assignment.examType,
    scheduledDate: assignment.scheduledDate, endDate: assignment.endDate, questionCount: q,
    counts, nets, avgNet, successPct, skipReasons, coachReminderSentAt: assignment.coachReminderSentAt,
  };
}

// Net dağılımı: soru sayısını 6 eşit aralığa böler (şartnamedeki 0–5 … 25–30, 30 soruluk ödev içindir).
function histogram(nets, q) {
  const top = q || Math.max(6, ...nets.map((n) => Math.ceil(n)));
  const width = Math.max(1, Math.ceil(top / 6));
  const bins = Array.from({ length: 6 }, (_, i) => ({ from: i * width, to: (i + 1) * width, count: 0 }));
  for (const n of nets) {
    const i = Math.min(5, Math.max(0, Math.floor(Math.max(0, n) / width)));
    bins[i].count += 1;
  }
  return bins;
}

branchRouter.get("/overview", async (req, res) => {
  try {
    const me = await loadBranchTeacher(req);
    const { examType, subject } = req.query || {};
    assert(EXAM_TYPES.includes(examType) && isValidSubject(examType, subject), "Geçersiz ders");
    assert(me.teachingSubjects.includes(branchOfSubject(subject)), "Bu ders senin branşında değil", 403);
    const now = new Date();

    const assignments = await prisma.assignment.findMany({
      where: { teacherId: me.id, targetMode: "SCHOOL_WIDE", status: "SENT", examType, subject },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
      include: {
        recipients: {
          select: {
            completed: true, skippedAt: true, skipReason: true,
            submission: { select: { correctCount: true, wrongCount: true, blankCount: true } },
            student: { select: { teacherId: true } },
          },
        },
      },
    });
    // Bu haftanın ödevi: bugün süresi içinde olan (birden çoksa en son başlayan); yoksa en son yayınlanan.
    const today = now.getTime();
    let currentIdx = -1;
    assignments.forEach((a, i) => {
      if (a.scheduledDate.getTime() <= today + DAY_MS && a.endDate.getTime() + 21 * 3600e3 >= today) currentIdx = i;
    });
    if (currentIdx === -1) currentIdx = assignments.length - 1;
    const current = currentIdx >= 0 ? assignments[currentIdx] : null;
    const previous = currentIdx > 0 ? assignments[currentIdx - 1] : null;

    let currentSummary = null;
    let nonSubmitters = null;
    if (current) {
      currentSummary = summarize(current, now);
      currentSummary.histogram = histogram(currentSummary.nets, currentSummary.questionCount);
      delete currentSummary.nets;
      // Sonuç girmeyenler (pas geçenler sebebini bildirdi, onlar hariç) — adları değil yalnızca sayıları:
      // takipleri koçlarında.
      const missing = current.recipients.filter((r) => !r.completed && !r.skippedAt);
      const coachIds = new Set(missing.map((r) => r.student?.teacherId).filter(Boolean));
      nonSubmitters = { count: missing.length, coachCount: coachIds.size, withoutCoach: missing.filter((r) => !r.student?.teacherId).length };
    }
    const previousSummary = previous ? (({ nets, ...rest }) => rest)(summarize(previous, now)) : null;

    // Yıllık plan: bu izin kayıtları, durumlarıyla (kapandı / açık / taslak).
    const entries = await prisma.planEntry.findMany({
      where: { teacherId: me.id, examType, subject, kind: "TOPIC" },
      orderBy: { date: "asc" },
      include: { assignment: { select: { endDate: true } } },
    });
    const plan = entries.map((e) => {
      let state = "taslak";
      if (e.assignmentId) state = (e.assignment?.endDate || e.endDate || e.date).getTime() + 21 * 3600e3 < today ? "kapandı" : "açık";
      return { id: e.id, date: e.date, endDate: e.endDate, topic: e.topic, questionCount: e.questionCount, state, autoSend: e.autoSend, schoolWide: e.schoolWide };
    });
    // Sıradaki yayınlanacak konu: bu haftadan itibaren ilk taslak.
    const { mon } = trWeekRange(now);
    const nextDraft = plan.find((p) => p.state === "taslak" && (p.endDate || p.date).getTime() >= mon.getTime()) || null;

    const students = await prisma.user.findMany({ where: { role: "STUDENT", banned: false }, select: { gradeLevel: true } });
    const studentCount = students.filter((s) => trackForGrade(s.gradeLevel) === "YKS").length;

    res.json({ teacher: { name: me.name }, studentCount, current: currentSummary, previous: previousSummary, nonSubmitters, plan, nextDraft });
  } catch (e) {
    handleErr(res, e);
  }
});

// "Koçlara özet gönder": ödevin sonucunu girmeyen öğrencilerin koçlarına, kendi öğrencilerinden kaçının
// eksik olduğunu bildirir (adları koç kendi ekranında görür). Aynı ödev için günde bir kez.
branchRouter.post("/assignments/:id/remind-coaches", async (req, res) => {
  try {
    const me = await loadBranchTeacher(req);
    const a = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { recipients: { select: { completed: true, skippedAt: true, student: { select: { teacherId: true } } } } },
    });
    assert(a && a.teacherId === me.id && a.targetMode === "SCHOOL_WIDE" && a.status === "SENT", "Bulunamadı", 404);
    const now = new Date();
    assert(!a.coachReminderSentAt || now - a.coachReminderSentAt > COACH_REMINDER_COOLDOWN_MS, "Bu ödev için koçlara bugün zaten özet gönderdin", 429);
    const perCoach = new Map();
    for (const r of a.recipients) {
      const coachId = r.student?.teacherId;
      if (r.completed || r.skippedAt || !coachId || coachId === me.id) continue;
      perCoach.set(coachId, (perCoach.get(coachId) || 0) + 1);
    }
    for (const [coachId, n] of perCoach) {
      await notifyUser(coachId, `${me.name}: "${a.subject} — ${a.topic}" ödevinde ${n} öğrencin henüz sonuç girmedi.`, { type: "branch_reminder", data: { screen: "home" } });
    }
    await prisma.assignment.update({ where: { id: a.id }, data: { coachReminderSentAt: now } });
    res.json({ coaches: perCoach.size, students: [...perCoach.values()].reduce((x, y) => x + y, 0) });
  } catch (e) {
    handleErr(res, e);
  }
});
