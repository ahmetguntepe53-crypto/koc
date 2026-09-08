import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { isValidSubject, trackForGrade, trackForExamType } from "../subjects.js";
import { EXAM_TYPES, recipientInclude, notifyRecipientsAssignmentSent } from "./assignments.js";

// server/src/app.js'de requireAuth + requireRole("TEACHER") ile mount edilir — yıllık takvim
// yalnızca koçun kendi planıdır, admin/öğrenci burada işlem yapmaz.
export const planEntriesRouter = Router();

const KINDS = ["TOPIC", "PRACTICE_TEST", "HOLIDAY"];
const AUTO_SEND_MODES = ["OFF", "ON_DATE", "DAY_BEFORE"];
// Okul idaresinin belirlediği kural: günlük ödev başına en fazla 30 soru (bkz. koordinatörün notu —
// "her gün bir dersten en fazla 20-30 soru arası ödevlendirme"). Alt sınır esnek bırakılır, arayüzde
// 20-30 aralığı ÖNERİ olarak gösterilir; burada yalnızca üst sınır sert kural olarak zorlanır. Aynı
// güne BİRDEN FAZLA satır eklenebildiği için (bkz. schema.prisma > PlanEntry) bu sınır satır
// başınadır, bir günün TOPLAMını sınırlamaz — koç bilerek aynı gün 2-3 farklı ders ekleyebilir.
const MAX_QUESTION_COUNT = 30;
const ALREADY_PUBLISHED_MESSAGE = "Bu kayıt zaten yayınlandı — ödevi Ödevlerim'den düzenle";

function parseDateOnly(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // Saat/dakika kısmı hiçbir zaman kullanılmaz (yalnızca takvim günü anlamlı) — tutarlı saklamak için
  // günün başına (UTC gece yarısı) sabitlenir, aksi halde tarayıcının saat dilimine göre kaydırılmış
  // bir tarih string'i (ör. "2026-09-06") sunucuda bir önceki/sonraki güne yuvarlanabilirdi.
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function validateBody(body, { requireDate }) {
  const { examType, date, kind, subject, topic, sourceBook, pageRange, questionCount, note, autoSend } = body || {};
  assert(EXAM_TYPES.includes(examType), "Geçersiz sınav türü");
  assert(KINDS.includes(kind), "Geçersiz tür");
  assert(topic && String(topic).trim(), "Konu/başlık gerekli");
  if (kind === "TOPIC") assert(isValidSubject(examType, subject), "Geçersiz ders");

  let cleanDate = null;
  if (date) cleanDate = parseDateOnly(date);
  assert(!requireDate || cleanDate, "Geçerli bir tarih gir");

  let cleanQuestionCount = null;
  if (questionCount !== undefined && questionCount !== null && questionCount !== "") {
    cleanQuestionCount = Number(questionCount);
    assert(Number.isInteger(cleanQuestionCount) && cleanQuestionCount > 0 && cleanQuestionCount <= MAX_QUESTION_COUNT, `Soru sayısı en fazla ${MAX_QUESTION_COUNT} olabilir`);
  }

  const cleanAutoSend = autoSend === undefined ? "OFF" : autoSend;
  assert(AUTO_SEND_MODES.includes(cleanAutoSend), "Geçersiz gönderim modu");
  assert(cleanAutoSend === "OFF" || cleanDate, "Otomatik gönderim için bir tarih seçmelisin");

  return {
    examType, date: cleanDate, kind,
    subject: kind === "TOPIC" ? subject : null,
    topic: String(topic).trim(),
    sourceBook: sourceBook ? String(sourceBook).trim() : null,
    pageRange: pageRange ? String(pageRange).trim() : null,
    questionCount: cleanQuestionCount,
    note: note ? String(note).trim() : null,
    autoSend: cleanAutoSend,
  };
}

planEntriesRouter.get("/", async (req, res) => {
  try {
    const { examType } = req.query || {};
    assert(EXAM_TYPES.includes(examType), "Geçersiz sınav türü");
    const entries = await prisma.planEntry.findMany({
      where: { teacherId: req.userId, examType },
      include: { assignment: { select: { id: true, status: true, sentAt: true } } },
      orderBy: { date: "asc" },
    });
    res.json({ entries });
  } catch (e) {
    handleErr(res, e);
  }
});

async function loadOwnedUnpublishedEntry(req) {
  const entry = await prisma.planEntry.findUnique({ where: { id: req.params.id } });
  assert(entry, "Bulunamadı", 404);
  assert(entry.teacherId === req.userId, "Bu işlem için yetkin yok", 403);
  assert(!entry.assignmentId, ALREADY_PUBLISHED_MESSAGE, 409);
  return entry;
}

planEntriesRouter.post("/", async (req, res) => {
  try {
    const data = validateBody(req.body, { requireDate: true });
    const entry = await prisma.planEntry.create({ data: { teacherId: req.userId, ...data } });
    res.status(201).json({ entry });
  } catch (e) {
    handleErr(res, e);
  }
});

planEntriesRouter.put("/:id", async (req, res) => {
  try {
    const existing = await loadOwnedUnpublishedEntry(req);
    const data = validateBody(req.body, { requireDate: true });
    const updated = await prisma.planEntry.updateMany({ where: { id: existing.id, assignmentId: null }, data });
    assert(updated.count === 1, ALREADY_PUBLISHED_MESSAGE, 409);
    const entry = await prisma.planEntry.findUnique({ where: { id: existing.id } });
    res.json({ entry });
  } catch (e) {
    handleErr(res, e);
  }
});

planEntriesRouter.delete("/:id", async (req, res) => {
  try {
    const existing = await loadOwnedUnpublishedEntry(req);
    const deleted = await prisma.planEntry.deleteMany({ where: { id: existing.id, assignmentId: null } });
    assert(deleted.count === 1, ALREADY_PUBLISHED_MESSAGE, 409);
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

// Bir PlanEntry'yi gerçek bir Assignment'a dönüştürür — hem "Yayınla" uç noktasından (koç elle
// tetikler) hem scheduler.js'ten (autoSend ON_DATE/DAY_BEFORE zamanı gelince otomatik tetiklenir)
// ÇAĞRILIR. Tek yer, tek mantık: ikisi de aynı transaction/yarış korumasından geçer.
export async function publishPlanEntry(entry) {
  assert(entry.topic, "Önce bu kaydı doldur", 400);
  assert(entry.date, "Bu kayıt için bir tarih seç", 400);

  // Yalnızca gerçekten bu sınav türüne (LGS ya da YKS) hazırlanan öğrenciler — sınıf düzeyi HENÜZ
  // girilmemiş (trackForGrade -> null) öğrenciler burada BİLEREK dahil edilmez: routes/assignments.js
  // POST /'ta bu durum sorun değil çünkü koç zaten yalnızca arayüzde tikletilebilen (aynı track'teki)
  // öğrencileri seçebiliyor, ama publish burada TÜM track'e otomatik gönderim yaptığı için gradeLevel'ı
  // eksik bir öğrenciyi (yanlışlıkla) hem LGS hem YKS yayınına dahil etmemek için eşleşme TAM olmalı.
  const targetTrack = trackForExamType(entry.examType);
  const candidates = await prisma.user.findMany({
    where: { role: "STUDENT", teacherId: entry.teacherId, banned: false },
    select: { id: true, gradeLevel: true },
  });
  const matching = candidates.filter((s) => trackForGrade(s.gradeLevel) === targetTrack);
  assert(matching.length > 0, "Bu sınav türünde henüz öğrencin yok (sınıf düzeyi girilmiş olmalı)");

  // Assignment oluşturma + PlanEntry'yi "yayınlandı" olarak işaretleme TEK bir transaction içinde —
  // (çift tetikleyici -> çift ödev/bildirim riski — bkz. yayınla uç noktasının/scheduler'ın kullanımı)
  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.assignment.create({
      data: {
        teacherId: entry.teacherId,
        examType: entry.examType,
        subject: entry.subject || (entry.kind === "PRACTICE_TEST" ? "Deneme" : "Tatil Ödevi"),
        topic: entry.topic,
        sourceBook: entry.sourceBook,
        pageRange: entry.pageRange || (entry.questionCount ? `${entry.questionCount} soru` : null),
        period: "WEEKLY",
        scheduledDate: entry.date,
        endDate: entry.date,
        sendMode: "MANUAL_NOW",
        // Takvim kaydı her zaman TÜM track'i hedefler, öğrenci bazlı kısmi seçim yok.
        targetMode: "WHOLE_GROUP",
        status: "SENT",
        sentAt: new Date(),
        recipients: { create: matching.map((s) => ({ studentId: s.id })) },
      },
      include: recipientInclude,
    });
    const claim = await tx.planEntry.updateMany({ where: { id: entry.id, assignmentId: null }, data: { assignmentId: created.id } });
    assert(claim.count === 1, "Bu kayıt az önce başka bir istekle yayınlandı", 409);
    return created;
  });

  const teacher = await prisma.user.findUnique({ where: { id: entry.teacherId }, select: { name: true } });
  await notifyRecipientsAssignmentSent(assignment, teacher.name);

  const updatedEntry = await prisma.planEntry.findUnique({ where: { id: entry.id } });
  return { entry: updatedEntry, assignment };
}

planEntriesRouter.post("/:id/publish", async (req, res) => {
  try {
    const entry = await loadOwnedUnpublishedEntry(req);
    res.json(await publishPlanEntry(entry));
  } catch (e) {
    handleErr(res, e);
  }
});
