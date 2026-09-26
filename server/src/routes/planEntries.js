import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert, MAX_QUESTIONS_PER_DAY, maxQuestionCount } from "../validators.js";
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
// Birden çok günü kapsayan kayıtta (ör. branş öğretmeninin haftalık planı) sınır gün başınadır —
// bkz. validators.js > maxQuestionCount.
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
  const { examType, date, endDate, kind, subject, topic, sourceBook, pageRange, questionCount, note, autoSend, schoolWide } = body || {};
  assert(EXAM_TYPES.includes(examType), "Geçersiz sınav türü");
  assert(KINDS.includes(kind), "Geçersiz tür");
  assert(topic && String(topic).trim(), "Konu/başlık gerekli");
  if (kind === "TOPIC") assert(isValidSubject(examType, subject), "Geçersiz ders");

  let cleanDate = null;
  if (date) cleanDate = parseDateOnly(date);
  assert(!requireDate || cleanDate, "Geçerli bir tarih gir");

  // Bitiş günü opsiyonel — boş ya da başlangıçla aynıysa tek günlük kayıt olarak (null) saklanır.
  let cleanEndDate = null;
  if (endDate) {
    cleanEndDate = parseDateOnly(endDate);
    assert(cleanEndDate, "Geçerli bir bitiş tarihi gir");
    assert(cleanDate && cleanEndDate >= cleanDate, "Bitiş tarihi başlangıç tarihinden önce olamaz");
    if (cleanEndDate.getTime() === cleanDate.getTime()) cleanEndDate = null;
  }

  let cleanQuestionCount = null;
  if (questionCount !== undefined && questionCount !== null && questionCount !== "") {
    cleanQuestionCount = Number(questionCount);
    const max = maxQuestionCount(cleanDate, cleanEndDate);
    assert(Number.isInteger(cleanQuestionCount) && cleanQuestionCount > 0 && cleanQuestionCount <= max,
      max === MAX_QUESTIONS_PER_DAY ? `Soru sayısı en fazla ${max} olabilir` : `Soru sayısı bu tarih aralığı için en fazla ${max} olabilir (günde ${MAX_QUESTIONS_PER_DAY})`);
  }

  const cleanAutoSend = autoSend === undefined ? "OFF" : autoSend;
  assert(AUTO_SEND_MODES.includes(cleanAutoSend), "Geçersiz gönderim modu");
  assert(cleanAutoSend === "OFF" || cleanDate, "Otomatik gönderim için bir tarih seçmelisin");

  return {
    examType, date: cleanDate, endDate: cleanEndDate, kind,
    subject: kind === "TOPIC" ? subject : null,
    topic: String(topic).trim(),
    sourceBook: sourceBook ? String(sourceBook).trim() : null,
    pageRange: pageRange ? String(pageRange).trim() : null,
    questionCount: cleanQuestionCount,
    note: note ? String(note).trim() : null,
    autoSend: cleanAutoSend,
    schoolWide: !!schoolWide,
  };
}

// schoolWide=true yalnızca admin tarafından "ders öğretmeni" işaretlenmiş hesaplara açık — bu
// kontrol client'ta gizlense bile burada tekrar doğrulanır (bkz. schema.prisma > isSubjectTeacher).
async function assertCanUseSchoolWide(req, data) {
  if (!data.schoolWide) return;
  const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { isSubjectTeacher: true } });
  assert(me?.isSubjectTeacher, "Okul çapında ortak ödev gönderme yetkin yok", 403);
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
    await assertCanUseSchoolWide(req, data);
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
    await assertCanUseSchoolWide(req, data);
    const updated = await prisma.planEntry.updateMany({ where: { id: existing.id, assignmentId: null }, data });
    assert(updated.count === 1, ALREADY_PUBLISHED_MESSAGE, 409);
    const entry = await prisma.planEntry.findUnique({ where: { id: existing.id } });
    res.json({ entry });
  } catch (e) {
    handleErr(res, e);
  }
});

// "Okul çapında" hedefi seçildiğinde onay diyaloğunda gerçek alıcı sayısını göstermek için —
// yalnızca isSubjectTeacher=true hesaplar çağırabilir (bkz. assertCanUseSchoolWide).
planEntriesRouter.get("/school-wide-count", async (req, res) => {
  try {
    const { examType } = req.query || {};
    assert(EXAM_TYPES.includes(examType), "Geçersiz sınav türü");
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { isSubjectTeacher: true } });
    assert(me?.isSubjectTeacher, "Bu işlem için yetkin yok", 403);
    const targetTrack = trackForExamType(examType);
    const candidates = await prisma.user.findMany({ where: { role: "STUDENT", banned: false }, select: { gradeLevel: true } });
    const count = candidates.filter((s) => trackForGrade(s.gradeLevel) === targetTrack).length;
    res.json({ count });
  } catch (e) {
    handleErr(res, e);
  }
});

// "Ertele": öğretmen bir hafta (hastalık, izin...) geride kaldığında, seçilen günden itibaren yayınlanmamış
// konu kayıtları KENDİ planındaki sıradaki haftaya kayar — her ders (sınav türü + ders) kendi sırasında:
// n. konu n+hafta. kaydın tarihine geçer, son konular plan bitiminden sonra haftada bir ileri eklenir.
// Tatil / ortak sınav haftaları planda zaten boş olduğu için ayrı bir okul takvimine gerek kalmadan
// atlanır. Deneme/tatil ödevi kayıtları tarihe bağlıdır, kaymaz; yayınlanmış ödevlere dokunulmaz.
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SHIFT_WEEKS = 8;

async function buildShiftPlan(teacherId, body) {
  const { from, weeks, examType, subject } = body || {};
  const fromDate = from ? parseDateOnly(from) : null;
  assert(fromDate, "Geçerli bir başlangıç tarihi gir");
  const n = Number(weeks);
  assert(Number.isInteger(n) && n >= 1 && n <= MAX_SHIFT_WEEKS, `En fazla ${MAX_SHIFT_WEEKS} hafta ertelenebilir`);
  const only = examType !== undefined && examType !== null;
  if (only) assert(EXAM_TYPES.includes(examType) && isValidSubject(examType, subject), "Geçersiz ders");

  const entries = await prisma.planEntry.findMany({
    where: { teacherId, kind: "TOPIC", assignmentId: null, date: { gte: fromDate }, ...(only ? { examType, subject } : {}) },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  const groups = new Map();
  for (const e of entries) {
    const key = `${e.examType}|${e.subject}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const moves = [];
  const summary = [];
  for (const list of groups.values()) {
    const last = list[list.length - 1];
    let lastNewDate = null;
    list.forEach((e, i) => {
      const j = i + n;
      const date = j < list.length ? list[j].date : new Date(last.date.getTime() + (j - list.length + 1) * 7 * DAY_MS);
      // Kayıt kendi süresini korur (haftalık konu haftalık kalır, soru sınırı da geçerli kalır).
      const endDate = e.endDate ? new Date(date.getTime() + (e.endDate.getTime() - e.date.getTime())) : null;
      moves.push({ id: e.id, date, endDate, before: { date: e.date, endDate: e.endDate } });
      lastNewDate = date;
    });
    summary.push({ examType: list[0].examType, subject: list[0].subject, count: list.length, firstDate: list[0].date, lastNewDate });
  }
  summary.sort((a, b) => a.examType.localeCompare(b.examType) || a.subject.localeCompare(b.subject, "tr"));
  return { moves, summary };
}

// Önizleme — hiçbir şey yazmaz; arayüz "hangi dersler, kaç konu, son konu nereye düşüyor" gösterir.
planEntriesRouter.post("/shift/preview", async (req, res) => {
  try {
    const { summary } = await buildShiftPlan(req.userId, req.body);
    res.json({ groups: summary, total: summary.reduce((s, g) => s + g.count, 0) });
  } catch (e) {
    handleErr(res, e);
  }
});

planEntriesRouter.post("/shift", async (req, res) => {
  try {
    const { moves, summary } = await buildShiftPlan(req.userId, req.body);
    assert(moves.length > 0, "Bu tarihten sonra ertelenecek (yayınlanmamış) konu kaydı yok");
    await prisma.$transaction(async (tx) => {
      for (const m of moves) {
        const r = await tx.planEntry.updateMany({ where: { id: m.id, teacherId: req.userId, assignmentId: null }, data: { date: m.date, endDate: m.endDate } });
        assert(r.count === 1, "Bir kayıt bu sırada yayınlandı — takvimi yenileyip tekrar dene", 409);
      }
    }, { timeout: 30000 });
    // "Geri al" için eski tarihler — istemci /restore-dates'e aynen geri gönderir.
    res.json({ groups: summary, total: moves.length, undo: moves.map((m) => ({ id: m.id, date: m.before.date, endDate: m.before.endDate })) });
  } catch (e) {
    handleErr(res, e);
  }
});

// Ertelemeyi geri alma: kayıtları verilen tarihlere döndürür. Yalnızca öğretmenin kendi, hâlâ
// yayınlanmamış kayıtları değişir (arada yayınlanan olduysa o kayıt atlanır).
planEntriesRouter.post("/restore-dates", async (req, res) => {
  try {
    const { items } = req.body || {};
    assert(Array.isArray(items) && items.length > 0 && items.length <= 1000, "Geçersiz istek");
    const clean = items.map((it) => {
      const date = parseDateOnly(it?.date);
      const endDate = it?.endDate ? parseDateOnly(it.endDate) : null;
      assert(typeof it?.id === "string" && date && (!it.endDate || (endDate && endDate >= date)), "Geçersiz istek");
      return { id: it.id, date, endDate };
    });
    let restored = 0;
    await prisma.$transaction(async (tx) => {
      for (const it of clean) {
        const r = await tx.planEntry.updateMany({ where: { id: it.id, teacherId: req.userId, assignmentId: null }, data: { date: it.date, endDate: it.endDate } });
        restored += r.count;
      }
    }, { timeout: 30000 });
    res.json({ restored });
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
  // "Ders öğretmeni" yetkisi yalnızca kayıt oluşturulurken/düzenlenirken kontrol ediliyordu — admin
  // yetkiyi sonradan geri alsa bile önceden kaydedilmiş okul çapındaki kayıtlar (elle ya da otomatik)
  // yine tüm okula gidiyordu. Yayın anında tekrar doğrulanır.
  if (entry.schoolWide) {
    const owner = await prisma.user.findUnique({ where: { id: entry.teacherId }, select: { isSubjectTeacher: true } });
    assert(owner?.isSubjectTeacher, "Okul çapında ödev gönderme yetkin artık yok — kaydı düzenleyip okul çapı seçeneğini kaldır", 403);
  }

  // Yalnızca gerçekten bu sınav türüne (LGS ya da YKS) hazırlanan öğrenciler — sınıf düzeyi HENÜZ
  // girilmemiş (trackForGrade -> null) öğrenciler burada BİLEREK dahil edilmez: routes/assignments.js
  // POST /'ta bu durum sorun değil çünkü koç zaten yalnızca arayüzde tikletilebilen (aynı track'teki)
  // öğrencileri seçebiliyor, ama publish burada TÜM track'e otomatik gönderim yaptığı için gradeLevel'ı
  // eksik bir öğrenciyi (yanlışlıkla) hem LGS hem YKS yayınına dahil etmemek için eşleşme TAM olmalı.
  // schoolWide=true ise (yalnızca isSubjectTeacher hesaplardan gelebilir, bkz. assertCanUseSchoolWide)
  // teacherId filtresi TAMAMEN kaldırılır — okuldaki TÜM track'teki öğrenciler hedeflenir.
  const targetTrack = trackForExamType(entry.examType);
  const candidates = await prisma.user.findMany({
    where: entry.schoolWide
      ? { role: "STUDENT", banned: false }
      : { role: "STUDENT", teacherId: entry.teacherId, banned: false },
    select: { id: true, gradeLevel: true },
  });
  const matching = candidates.filter((s) => trackForGrade(s.gradeLevel) === targetTrack);
  assert(matching.length > 0, entry.schoolWide ? "Bu sınav türünde okulda henüz öğrenci yok" : "Bu sınav türünde henüz öğrencin yok (sınıf düzeyi girilmiş olmalı)");

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
        // Soru sayısı, sayfa aralığı da girilmişse önceden kayboluyordu — ikisi birlikte yazılır.
        pageRange: [entry.pageRange, entry.questionCount ? `${entry.questionCount} soru` : null].filter(Boolean).join(" · ") || null,
        note: entry.note,
        period: "WEEKLY",
        scheduledDate: entry.date,
        endDate: entry.endDate || entry.date,
        sendMode: "MANUAL_NOW",
        // Takvim kaydı her zaman TÜM track'i hedefler, öğrenci bazlı kısmi seçim yok — schoolWide
        // ise bu, kendi öğrencilerinin ötesinde okuldaki TÜM track'i kapsar (bkz. targetTrack yukarıda).
        targetMode: entry.schoolWide ? "SCHOOL_WIDE" : "WHOLE_GROUP",
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
