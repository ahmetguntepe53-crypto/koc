import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { isValidSubject, trackForGrade, trackForExamType } from "../subjects.js";

// Bu router server/src/app.js'de requireAuth ile mount edilir (rol karışık: TEACHER oluşturur/
// düzenler, ADMIN yalnızca okur) — her uç nokta kendi içinde req.userRole'e göre yetki kontrolü yapar.
export const assignmentsRouter = Router();

const EXAM_TYPES = ["TYT", "AYT", "LGS"];
const PERIODS = ["WEEKLY", "MONTHLY", "YEARLY"];
const SEND_MODES = ["AUTO_ON_DATE", "AUTO_DAY_BEFORE", "MANUAL_NOW"];

const recipientInclude = {
  recipients: { include: { student: { select: { id: true, name: true, className: true } }, submission: true } },
};

assignmentsRouter.post("/", async (req, res) => {
  try {
    assert(req.userRole === "TEACHER", "Bu işlem için yetkin yok", 403);
    const { examType, subject, topic, sourceBook, pageRange, period, scheduledDate, endDate, sendMode, studentIds } = req.body || {};
    assert(EXAM_TYPES.includes(examType), "Geçersiz sınav türü");
    assert(isValidSubject(examType, subject), "Geçersiz ders");
    assert(topic && String(topic).trim(), "Konu gerekli");
    assert(PERIODS.includes(period), "Geçersiz periyot");
    assert(scheduledDate && !Number.isNaN(new Date(scheduledDate).getTime()), "Geçerli bir başlangıç tarihi gerekli");
    const start = new Date(scheduledDate);
    // Bitiş tarihi verilmezse (ör. eski istemci) başlangıçla aynı kabul edilir — tek günlük ödev.
    let end = start;
    if (endDate) {
      assert(!Number.isNaN(new Date(endDate).getTime()), "Geçerli bir bitiş tarihi gerekli");
      end = new Date(endDate);
      assert(end >= start, "Bitiş tarihi başlangıç tarihinden önce olamaz");
    }
    assert(SEND_MODES.includes(sendMode), "Geçersiz gönderim modu");
    assert(Array.isArray(studentIds) && studentIds.length > 0, "En az bir öğrenci seçmelisin");

    // Ödevin sınav türü (LGS ya da TYT/AYT) hangi "sınav grubuna" ait — hedefteki öğrenci(ler)in
    // gradeLevel'ından türeyen grupla eşleşmesi gerekir, aksi halde 8. sınıf bir öğrenciye yanlışlıkla
    // AYT ödevi gitmez (ya da tam tersi). İstemci zaten yalnızca uyumlu öğrencileri tikletilebilir
    // yapıyor — burası son bir güvenlik kontrolü (ör. gradeLevel form açıkken değiştiyse).
    const targetTrack = trackForExamType(examType);
    const uniqueIds = [...new Set(studentIds)];
    const candidates = await prisma.user.findMany({
      where: { id: { in: uniqueIds }, role: "STUDENT", teacherId: req.userId, banned: false },
      select: { id: true, gradeLevel: true },
    });
    assert(candidates.length === uniqueIds.length, "Seçilen öğrencilerden bazıları sana atanmamış ya da askıda");
    const mismatched = candidates.filter((s) => { const t = trackForGrade(s.gradeLevel); return t !== null && t !== targetTrack; });
    assert(mismatched.length === 0, "Seçilen öğrencilerden biri farklı bir sınav türüne hazırlanıyor — listeyi yenileyip tekrar dene");

    // targetMode yalnızca arayüzde "kime gönderildi" bilgisini özetlemek için — 1 kişiyse tekil,
    // roster'daki (aynı sınav türündeki) HERKES seçiliyse toplu, aksi halde tik ile yapılmış bir seçim.
    const activeRosterCount = await prisma.user.count({ where: { role: "STUDENT", teacherId: req.userId, banned: false } });
    const targetMode = uniqueIds.length === 1 ? "SINGLE_STUDENT" : uniqueIds.length === activeRosterCount ? "WHOLE_GROUP" : "SELECTED_STUDENTS";

    // Elle-şimdi-gönder seçilirse ödev DRAFT aşamasını hiç görmeden doğrudan yayınlanır — koç
    // "Takvime Kaydet" yerine bilinçli olarak anında göndermeyi seçmiş demektir.
    const publishNow = sendMode === "MANUAL_NOW";
    const assignment = await prisma.assignment.create({
      data: {
        teacherId: req.userId,
        examType,
        subject,
        topic: String(topic).trim(),
        sourceBook: sourceBook ? String(sourceBook).trim() : null,
        pageRange: pageRange ? String(pageRange).trim() : null,
        period,
        scheduledDate: start,
        endDate: end,
        sendMode,
        targetMode,
        status: publishNow ? "SENT" : "DRAFT",
        sentAt: publishNow ? new Date() : null,
        recipients: { create: candidates.map((s) => ({ studentId: s.id })) },
      },
      include: recipientInclude,
    });
    res.status(201).json({ assignment });
  } catch (e) {
    handleErr(res, e);
  }
});

// /:id ile çakışmaması için parametreli rotadan ÖNCE tanımlanmalı.
assignmentsRouter.get("/source-books", async (req, res) => {
  try {
    assert(req.userRole === "TEACHER", "Bu işlem için yetkin yok", 403);
    const { examType } = req.query || {};
    const where = { teacherId: req.userId, sourceBook: { not: null } };
    if (examType) where.examType = examType;
    const rows = await prisma.assignment.findMany({ where, distinct: ["sourceBook"], select: { sourceBook: true }, take: 20, orderBy: { createdAt: "desc" } });
    res.json({ sourceBooks: rows.map((r) => r.sourceBook).filter(Boolean) });
  } catch (e) {
    handleErr(res, e);
  }
});

assignmentsRouter.get("/", async (req, res) => {
  try {
    const { status, examType, teacherId, subject } = req.query || {};
    const where = {};
    if (req.userRole === "TEACHER") where.teacherId = req.userId;
    else if (req.userRole === "ADMIN") { if (teacherId) where.teacherId = teacherId; }
    else return res.status(403).json({ error: "Bu işlem için yetkin yok" });
    if (status) where.status = status;
    if (examType) where.examType = examType;
    if (subject) where.subject = subject;
    const assignments = await prisma.assignment.findMany({ where, orderBy: { scheduledDate: "desc" }, include: recipientInclude });
    res.json({ assignments });
  } catch (e) {
    handleErr(res, e);
  }
});

assignmentsRouter.get("/:id", async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { ...recipientInclude, teacher: { select: { id: true, name: true } } },
    });
    assert(assignment, "Ödev bulunamadı", 404);
    assert(req.userRole === "ADMIN" || (req.userRole === "TEACHER" && assignment.teacherId === req.userId), "Bu işlem için yetkin yok", 403);
    res.json({ assignment });
  } catch (e) {
    handleErr(res, e);
  }
});

async function loadOwnedDraftAssignment(req) {
  const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
  assert(assignment, "Ödev bulunamadı", 404);
  assert(req.userRole === "TEACHER" && assignment.teacherId === req.userId, "Bu işlem için yetkin yok", 403);
  assert(assignment.status === "DRAFT", "Yalnızca gönderilmemiş (taslak) ödevler düzenlenebilir", 409);
  return assignment;
}

assignmentsRouter.patch("/:id", async (req, res) => {
  try {
    const existing = await loadOwnedDraftAssignment(req);
    const { examType, subject, topic, sourceBook, pageRange, scheduledDate, endDate, sendMode, period } = req.body || {};
    const finalExamType = examType !== undefined ? examType : existing.examType;
    const data = {};
    if (examType !== undefined) {
      assert(EXAM_TYPES.includes(examType), "Geçersiz sınav türü");
      // Hedef öğrenciler ödev oluşturulduğu anda sabitlendiği için (recipients) sınav türü sonradan
      // değiştirilirse mevcut hedeflerin hâlâ uyumlu olduğu doğrulanmalı — aksi halde ör. YKS için
      // seçilmiş bir öğrenciye taslak düzenlemesiyle sessizce LGS ödevi kalabilir.
      if (examType !== existing.examType) {
        const recipients = await prisma.assignmentRecipient.findMany({ where: { assignmentId: existing.id }, include: { student: { select: { gradeLevel: true } } } });
        const newTrack = trackForExamType(examType);
        const mismatched = recipients.some((r) => { const t = trackForGrade(r.student.gradeLevel); return t !== null && t !== newTrack; });
        assert(!mismatched, "Bu ödevin hedef öğrencilerinden biri farklı bir sınav türüne hazırlanıyor — sınav türünü değiştiremezsin");
      }
      data.examType = examType;
    }
    if (subject !== undefined) { assert(isValidSubject(finalExamType, subject), "Geçersiz ders"); data.subject = subject; }
    if (topic !== undefined) { assert(String(topic).trim(), "Konu gerekli"); data.topic = String(topic).trim(); }
    if (sourceBook !== undefined) data.sourceBook = sourceBook ? String(sourceBook).trim() : null;
    if (pageRange !== undefined) data.pageRange = pageRange ? String(pageRange).trim() : null;
    if (scheduledDate !== undefined) { assert(!Number.isNaN(new Date(scheduledDate).getTime()), "Geçerli bir başlangıç tarihi gerekli"); data.scheduledDate = new Date(scheduledDate); }
    if (endDate !== undefined) { assert(!Number.isNaN(new Date(endDate).getTime()), "Geçerli bir bitiş tarihi gerekli"); data.endDate = new Date(endDate); }
    if (data.scheduledDate || data.endDate) {
      const finalStart = data.scheduledDate || existing.scheduledDate;
      const finalEnd = data.endDate || existing.endDate;
      assert(finalEnd >= finalStart, "Bitiş tarihi başlangıç tarihinden önce olamaz");
    }
    if (sendMode !== undefined) { assert(SEND_MODES.includes(sendMode), "Geçersiz gönderim modu"); data.sendMode = sendMode; }
    if (period !== undefined) { assert(PERIODS.includes(period), "Geçersiz periyot"); data.period = period; }
    const assignment = await prisma.assignment.update({ where: { id: req.params.id }, data, include: recipientInclude });
    res.json({ assignment });
  } catch (e) {
    handleErr(res, e);
  }
});

assignmentsRouter.delete("/:id", async (req, res) => {
  try {
    await loadOwnedDraftAssignment(req);
    await prisma.assignment.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

assignmentsRouter.post("/:id/send-now", async (req, res) => {
  try {
    await loadOwnedDraftAssignment(req);
    const assignment = await prisma.assignment.update({
      where: { id: req.params.id },
      data: { status: "SENT", sentAt: new Date() },
      include: recipientInclude,
    });
    res.json({ assignment });
  } catch (e) {
    handleErr(res, e);
  }
});
