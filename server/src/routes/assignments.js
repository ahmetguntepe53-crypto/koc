import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { isValidSubject, trackForGrade, trackForExamType, EXAM_TYPES, branchOfSubject, GRADE_LEVELS } from "../subjects.js";
import { notifyUser } from "../notify.js";
import { netOf, questionCountOf } from "../weekStats.js";
import { trTodayAsDateOnly } from "../quietHours.js";

// Bu router server/src/app.js'de requireAuth ile mount edilir (rol karışık: TEACHER oluşturur/
// düzenler, ADMIN yalnızca okur) — her uç nokta kendi içinde req.userRole'e göre yetki kontrolü yapar.
export const assignmentsRouter = Router();

// Yeni kayıtta kabul edilen sınav türleri — tek kaynak subjects.js (LGS kaldırıldı).
export { EXAM_TYPES };
const PERIODS = ["WEEKLY", "MONTHLY", "YEARLY"];
const SEND_MODES = ["AUTO_ON_DATE", "AUTO_DAY_BEFORE", "MANUAL_NOW"];

export const recipientInclude = {
  recipients: {
    include: {
      student: { select: { id: true, name: true, className: true } },
      submission: true,
      photos: { orderBy: { createdAt: "asc" } },
    },
  },
};

// Bir ödevin "başarı yüzdesi" — branş öğretmeninin "Gönderdiğim Ödevler" listesinde ve detayında
// görünür (2026-09-30). Yalnızca TESLİM EDİLMİŞ (submission'ı olan) alıcılardan hesaplanır — henüz
// çözmemiş/pas geçmiş öğrenci bu ortalamayı aşağı çekmez, o zaten ayrı bir sinyal (bekliyor/gecikti).
// AYNI formül daha önce "Branş" ekranında kullanılmıştı (bkz. routes/branch.js > summarize) — iki yerde
// ayrı ayrı yazmak yerine burada da BİREBİR aynı hesap: alıcı başına net (D − Y/4) ortalanır, ödevin
// beklenen soru sayısına (pageRange'teki "N soru", yoksa girilen D+Y+B'lerin ortalaması) bölünür.
function successStats(recipients, pageRange) {
  const nets = [];
  let answered = 0;
  for (const r of recipients) {
    const net = netOf(r.submission);
    if (net == null) continue;
    nets.push(net);
    answered += r.submission.correctCount + r.submission.wrongCount + r.submission.blankCount;
  }
  const avgNet = nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : null;
  const q = questionCountOf(pageRange);
  const perStudentQ = q || (nets.length ? answered / nets.length : null);
  const successPct = avgNet != null && perStudentQ ? Math.round((avgNet / perStudentQ) * 100) : null;
  return { avgNet: avgNet != null ? Math.round(avgNet * 100) / 100 : null, successPct, completedCount: nets.length, questionCount: perStudentQ ? Math.round(perStudentQ) : null };
}
function withSuccessStats(assignment) {
  return { ...assignment, ...successStats(assignment.recipients, assignment.pageRange) };
}

// Bir ödev DRAFT'tan SENT'e geçtiğinde (elle "şimdi gönder" ya da scheduler.js'in otomatik akışı)
// her alıcıya kendi AssignmentRecipient.id'siyle bildirim gider — AssignmentSubmitScreen bu id ile
// açılır (bkz. src/App.jsx > goToNotificationTarget).
// Çağrıldığı noktada ödev zaten DB'ye SENT olarak yazılmış oluyor — bu adım yalnızca bildirimi
// dener. notifyUser'ın kendi DB yazımı (push'un aksine) sarmalanmamıştı; burada patlarsa çağıran
// route'un try/catch'i bunu yakalayıp istemciye 500 dönerdi, oysa ödev zaten gönderilmiş olurdu —
// öğretmen "hata oldu" sanıp tekrar denerse aynı ödev ikinci kez oluşturulup gönderilirdi. Bildirim
// best-effort'tur (push gönderimi zaten aynı şekilde sessizce yutuluyor, bkz. notify.js).
// Metin istemcide ayrıştırılıyor (src/screens/NotificationsScreen.jsx > NEW_ASSIGNMENT_RE) — biçim
// değişirse orası da güncellenmeli. Son gün, tarihlerin saklandığı UTC gece yarısından okunur.
export function newAssignmentText(teacherName, assignment) {
  const due = new Date(assignment.endDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });
  return `${teacherName} sana yeni bir ödev gönderdi: ${assignment.subject} — ${assignment.topic} (son gün: ${due})`;
}

export async function notifyRecipientsAssignmentSent(assignment, teacherName) {
  const text = newAssignmentText(teacherName, assignment);
  try {
    await Promise.all(assignment.recipients.map((r) =>
      notifyUser(r.studentId, text, { type: "assignment", data: { screen: "assignmentSubmit", recipientId: r.id, subject: assignment.subject } })
    ));
  } catch (e) {
    console.error(`[assignments] gönderim bildirimi yazılamadı (assignment ${assignment.id}):`, e.message);
  }
}

// Ödevi kimin atayabileceği ve hangi öğrencileri hedefleyebileceği — 2026-09-28'de okulun kararıyla
// değişti: ödev YALNIZCA branş öğretmenlerinden gider, koçlar takip eder. Branş öğretmeni kendi
// koçluk ettiği öğrencilerle sınırlı değildir, okuldaki HERKESİ (ya da bir sınıf düzeyini / şubeyi)
// hedefleyebilir; buna karşılık yalnızca KENDİ branşındaki dersten ödev verebilir (Coğrafya öğretmeni
// Coğrafya-1/2 ve TYT Coğrafya). İstemci de aynı kuralı uygular (Ata sekmesi yalnızca branş
// öğretmenlerinde görünür), burası eski sürüm uygulamalar için son sınır.
async function assertCanAssign(userId, subject) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, isSubjectTeacher: true, teachingSubjects: true } });
  assert(me?.isSubjectTeacher && me.teachingSubjects.length > 0, "Ödev atama yetkisi branş öğretmenlerinde — koçlar ödevlerin takibini yapar", 403);
  assert(me.teachingSubjects.includes(branchOfSubject(subject)), "Bu ders senin branşında değil", 403);
  return me;
}

assignmentsRouter.post("/", async (req, res) => {
  try {
    assert(req.userRole === "TEACHER", "Bu işlem için yetkin yok", 403);
    const body = req.body || {};
    const { examType, subject, topic, sourceBook, pageRange, endDate, studentIds, audienceLabel } = body;
    // Varsayılanlar (2026-09-30, yeni "Ödev ata" ekranı): periyot gönderilmezse haftalık, başlangıç gönderilmezse
    // bugün (Türkiye), gönderim gönderilmezse hemen. Sayfa/soru artık istenmiyor; eski sürümler gönderirse saklanır.
    const period = body.period ?? "WEEKLY";
    const sendMode = body.sendMode ?? "MANUAL_NOW";
    const scheduledDate = body.scheduledDate ?? trTodayAsDateOnly(new Date());
    assert(EXAM_TYPES.includes(examType), "Geçersiz sınav türü");
    assert(isValidSubject(examType, subject), "Geçersiz ders");
    const me = await assertCanAssign(req.userId, subject);
    assert(topic && String(topic).trim(), "Konu gerekli");
    assert(sourceBook && String(sourceBook).trim(), "Kaynak kitap seçmelisin");
    // "Tüm okul" hedefi kaldırıldı — eski sürümün bu seçenekle gönderdiği istek reddedilir.
    assert(body.targetMode !== "SCHOOL_WIDE" && audienceLabel !== "Tüm okul", "Tüm okula ödev gönderme kaldırıldı — sınıf düzeyi, şube ya da öğrenci seç");
    assert(PERIODS.includes(period), "Geçersiz periyot");
    assert(!Number.isNaN(new Date(scheduledDate).getTime()), "Geçerli bir başlangıç tarihi gerekli");
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
    // teacherId filtresi YOK: branş öğretmeni okuldaki her öğrenciyi hedefleyebilir (yetki yukarıda
    // assertCanAssign ile doğrulandı). Sınıf düzeyi girilmemiş öğrenci seçilemez — o öğrencinin hangi
    // sınav türüne hazırlandığı bilinmiyor demektir (bkz. trackForGrade).
    const candidates = await prisma.user.findMany({
      where: { id: { in: uniqueIds }, role: "STUDENT", banned: false },
      select: { id: true, gradeLevel: true },
    });
    assert(candidates.length === uniqueIds.length, "Seçilen öğrencilerden bazıları bulunamadı ya da askıya alınmış — listeyi yenileyip tekrar dene");
    const mismatched = candidates.filter((s) => trackForGrade(s.gradeLevel) !== targetTrack);
    assert(mismatched.length === 0, "Seçilen öğrencilerden birinin sınıf düzeyi bu sınav türüyle uyuşmuyor — listeyi yenileyip tekrar dene");

    // targetMode yalnızca arayüzde "kime gönderildi" bilgisini özetlemek için — 1 kişiyse tekil,
    // o sınav türündeki TÜM okul seçiliyse okul çapı, aksi halde seçilmiş bir alt küme.
    const schoolCount = await prisma.user.count({ where: { role: "STUDENT", banned: false, gradeLevel: { in: GRADE_LEVELS } } });
    const targetMode = uniqueIds.length === 1 ? "SINGLE_STUDENT" : uniqueIds.length >= schoolCount ? "SCHOOL_WIDE" : "SELECTED_STUDENTS";

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
        // Yalnızca görüntüleme etiketi (bkz. schema.prisma > Assignment.audienceLabel) — hiçbir yetki/
        // hedefleme kararı buna dayanmaz, o yüzden istemciden geldiği gibi (uzunluğu sınırlanarak) kabul
        // edilir. "Seçerek" modunda istemci bunu BİLEREK göndermez (null kalır).
        audienceLabel: audienceLabel ? String(audienceLabel).trim().slice(0, 80) : null,
        status: publishNow ? "SENT" : "DRAFT",
        sentAt: publishNow ? new Date() : null,
        recipients: { create: candidates.map((s) => ({ studentId: s.id })) },
      },
      include: recipientInclude,
    });
    if (publishNow) await notifyRecipientsAssignmentSent(assignment, me.name);
    res.status(201).json({ assignment });
  } catch (e) {
    handleErr(res, e);
  }
});

// Branş öğretmeninin ödev gönderebileceği öğrenciler — kendi koçluk ettikleriyle sınırlı DEĞİL,
// okuldaki tüm (sınıf düzeyi girilmiş, askıda olmayan) öğrenciler. İstemci bunları "tümü / sınıf
// düzeyi / şube / tek tek seç" olarak gruplar. Koç hesapları bu listeyi göremez (403) — ödev atama
// yetkisi onlarda yok (bkz. assertCanAssign). /:id ile çakışmaması için ondan ÖNCE tanımlanmalı.
assignmentsRouter.get("/audience", async (req, res) => {
  try {
    assert(req.userRole === "TEACHER", "Bu işlem için yetkin yok", 403);
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { isSubjectTeacher: true, teachingSubjects: true } });
    assert(me?.isSubjectTeacher && me.teachingSubjects.length > 0, "Ödev atama yetkisi branş öğretmenlerinde — koçlar ödevlerin takibini yapar", 403);
    const students = await prisma.user.findMany({
      where: { role: "STUDENT", banned: false, gradeLevel: { in: GRADE_LEVELS } },
      select: { id: true, name: true, gradeLevel: true, className: true },
      orderBy: [{ gradeLevel: "asc" }, { className: "asc" }, { name: "asc" }],
    });
    res.json({ students, teachingSubjects: me.teachingSubjects });
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
    if (examType) { assert(EXAM_TYPES.includes(examType), "Geçersiz sınav türü"); where.examType = examType; }
    if (req.query.subject) where.subject = String(req.query.subject);
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
    // Geçersiz enum değeri Prisma'ya ulaşırsa 500 dönüyordu — burada 400'e çevrilir.
    if (status) { assert(["DRAFT", "SENT"].includes(status), "Geçersiz durum"); where.status = status; }
    if (examType) { assert(EXAM_TYPES.includes(examType), "Geçersiz sınav türü"); where.examType = examType; }
    if (subject) where.subject = String(subject);
    const assignments = await prisma.assignment.findMany({ where, orderBy: { scheduledDate: "desc" }, include: recipientInclude });
    res.json({ assignments: assignments.map(withSuccessStats) });
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
    const isOwner = req.userRole === "TEACHER" && assignment.teacherId === req.userId;
    if (isOwner || req.userRole === "ADMIN") {
      // readOnly: "Şimdi Gönder"/"Sil" yalnızca ödevin sahibi öğretmene açık (bkz. loadOwnedDraftAssignment).
      return res.json({ assignment: { ...withSuccessStats(assignment), readOnly: !isOwner } });
    }
    // Koç, öğrencisinin özet ekranında BAŞKA bir öğretmenin (ör. ders öğretmeninin okul çapındaki ya
    // da önceki koçun) gönderdiği ödevleri de görür — tıklayınca 403 yerine salt okunur açılır, ama
    // yalnızca kendi öğrencilerinin satırlarını görür, diğer öğrencilerin sonuçları sızmaz.
    assert(req.userRole === "TEACHER" && assignment.status === "SENT", "Bu işlem için yetkin yok", 403);
    const coached = await prisma.user.findMany({
      where: { teacherId: req.userId, id: { in: assignment.recipients.map((r) => r.studentId) } },
      select: { id: true },
    });
    const coachedIds = new Set(coached.map((s) => s.id));
    assert(coachedIds.size > 0, "Bu işlem için yetkin yok", 403);
    // Başarı yüzdesi de yalnızca kendi öğrencilerinin sonuçlarından — okulun tamamının ortalaması
    // buraya sızmaz (bkz. yukarıdaki gizlilik notu).
    const own = assignment.recipients.filter((r) => coachedIds.has(r.studentId));
    res.json({ assignment: { ...assignment, recipients: own, ...successStats(own, assignment.pageRange), readOnly: true } });
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

// Gönderilmiş ödevde yalnızca öğrencinin elindeki ödevi bozmayan alanlar düzenlenebilir: konu, kaynak,
// sayfa/soru, not ve son gün. Ders/sınav türü/başlangıç/gönderim modu alıcılar sabitlendikten sonra değişmez.
const SENT_EDITABLE = ["topic", "sourceBook", "pageRange", "note", "endDate"];
const DAY_MS = 24 * 60 * 60 * 1000;

async function patchSentAssignment(req, existing) {
  const body = req.body || {};
  const locked = Object.keys(body).filter((k) => body[k] !== undefined && !SENT_EDITABLE.includes(k));
  assert(locked.length === 0, "Gönderilmiş ödevde yalnızca konu, kaynak, sayfa/soru, not ve son gün değiştirilebilir", 409);
  const { topic, sourceBook, pageRange, note, endDate } = body;
  const data = {};
  if (topic !== undefined) { assert(String(topic).trim(), "Konu gerekli"); data.topic = String(topic).trim(); }
  if (sourceBook !== undefined) data.sourceBook = sourceBook ? String(sourceBook).trim() : null;
  if (pageRange !== undefined) data.pageRange = pageRange ? String(pageRange).trim() : null;
  if (note !== undefined) data.note = note ? String(note).trim() : null;
  let extended = false;
  if (endDate !== undefined) {
    const end = new Date(endDate);
    assert(!Number.isNaN(end.getTime()), "Geçerli bir bitiş tarihi gerekli");
    assert(end >= existing.scheduledDate, "Bitiş tarihi başlangıç tarihinden önce olamaz");
    extended = end > existing.endDate;
    data.endDate = end;
  }
  const assignment = await prisma.$transaction(async (tx) => {
    // Son gün ileri alındıysa, bitirmemiş öğrencilere "son gün" ve "gecikti" hatırlatmaları yeni tarihe
    // göre yeniden gidebilsin.
    if (extended) {
      await tx.assignmentRecipient.updateMany({
        where: { assignmentId: existing.id, completed: false },
        data: { overdueReminderSentAt: null, dueReminderSentAt: null },
      });
    }
    return tx.assignment.update({ where: { id: existing.id }, data, include: recipientInclude });
  });
  if (data.endDate && data.endDate.getTime() !== existing.endDate.getTime()) {
    const due = data.endDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });
    const pending = assignment.recipients.filter((r) => !r.completed);
    try {
      await Promise.all(pending.map((r) => notifyUser(r.studentId, `"${assignment.subject} — ${assignment.topic}" ödevinin son günü ${due} olarak güncellendi.`, {
        type: "assignment", data: { screen: "assignmentSubmit", recipientId: r.id, subject: assignment.subject },
      })));
    } catch (e) {
      console.error(`[assignments] son gün bildirimi yazılamadı (assignment ${existing.id}):`, e.message);
    }
  }
  return assignment;
}

assignmentsRouter.patch("/:id", async (req, res) => {
  try {
    const owned = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    assert(owned, "Ödev bulunamadı", 404);
    assert(req.userRole === "TEACHER" && owned.teacherId === req.userId, "Bu işlem için yetkin yok", 403);
    if (owned.status === "SENT") return res.json({ assignment: withSuccessStats(await patchSentAssignment(req, owned)) });

    const existing = await loadOwnedDraftAssignment(req);
    const { examType, subject, topic, sourceBook, pageRange, scheduledDate, endDate, sendMode, period, note } = req.body || {};
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
        // Ders listesi sınav türüne göre değişir (bkz. subjects.js) — istek sınav türünü değiştirip
        // yeni bir subject GÖNDERMEMİŞSE, mevcut ders yeni türde geçersiz kalabilir (ör. TYT'den
        // LGS'ye geçince "Fizik" gibi LGS'de olmayan bir ders sessizce Assignment'ta kalırdı).
        if (subject === undefined) {
          assert(isValidSubject(examType, existing.subject), "Sınav türünü değiştirince ders de artık geçersiz oluyor — aynı istekte yeni bir ders de seç");
        }
      }
      data.examType = examType;
    }
    if (subject !== undefined) { assert(isValidSubject(finalExamType, subject), "Geçersiz ders"); data.subject = subject; }
    if (topic !== undefined) { assert(String(topic).trim(), "Konu gerekli"); data.topic = String(topic).trim(); }
    if (sourceBook !== undefined) data.sourceBook = sourceBook ? String(sourceBook).trim() : null;
    if (pageRange !== undefined) data.pageRange = pageRange ? String(pageRange).trim() : null;
    if (note !== undefined) data.note = note ? String(note).trim() : null;
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
    res.json({ assignment: withSuccessStats(assignment) });
  } catch (e) {
    handleErr(res, e);
  }
});

// "Hatırlat": ödevin sahibi öğretmen, süresi geçmiş ve sonucunu girmemiş (pas da geçmemiş) bir öğrenciye
// elle bildirim gönderir. Aynı öğrenciye aynı ödev için günde en fazla bir kez.
assignmentsRouter.post("/:id/recipients/:recipientId/remind", async (req, res) => {
  try {
    const recipient = await prisma.assignmentRecipient.findUnique({
      where: { id: req.params.recipientId },
      include: { assignment: { include: { teacher: { select: { name: true } } } } },
    });
    assert(recipient && recipient.assignmentId === req.params.id, "Öğrenci bu ödevde bulunamadı", 404);
    const a = recipient.assignment;
    assert(req.userRole === "TEACHER" && a.teacherId === req.userId, "Bu işlem için yetkin yok", 403);
    const now = new Date();
    assert(a.status === "SENT" && a.endDate < now, "Bu ödevin süresi henüz dolmadı", 409);
    assert(!recipient.completed && !recipient.skippedAt, "Bu öğrenci ödevi zaten tamamladı ya da pas geçti", 409);
    assert(!recipient.manualReminderSentAt || now - recipient.manualReminderSentAt >= DAY_MS, "Bu öğrenciye bugün zaten hatırlatma gönderdin", 429);
    // Koşullu güncelleme: çift tıklamada ikinci istek bildirim göndermesin.
    const claim = await prisma.assignmentRecipient.updateMany({
      where: { id: recipient.id, manualReminderSentAt: recipient.manualReminderSentAt },
      data: { manualReminderSentAt: now },
    });
    assert(claim.count === 1, "Bu öğrenciye az önce hatırlatma gönderildi", 409);
    await notifyUser(recipient.studentId, `${a.teacher.name} hatırlatıyor: "${a.subject} — ${a.topic}" ödevinin süresi geçti, sonucunu henüz girmedin.`, {
      type: "assignment_overdue", data: { screen: "assignmentSubmit", recipientId: recipient.id }, now,
    });
    res.json({ manualReminderSentAt: now });
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
    const existing = await loadOwnedDraftAssignment(req);
    // status:"DRAFT" koşullu updateMany: çift tıklama ya da iki sekmeden aynı anda gelen "Şimdi
    // Gönder" isteklerinin ikisi de yukarıdaki DRAFT kontrolünü geçebilir, ama yalnızca biri satırı
    // gerçekten SENT'e çevirebilir — count 0 dönen istek bildirim GÖNDERMEZ (aksi halde her öğrenciye
    // aynı ödev için çift bildirim giderdi).
    const claim = await prisma.assignment.updateMany({ where: { id: existing.id, status: "DRAFT" }, data: { status: "SENT", sentAt: new Date() } });
    assert(claim.count === 1, "Bu ödev az önce başka bir istekle gönderildi", 409);
    const assignment = await prisma.assignment.findUnique({ where: { id: existing.id }, include: { ...recipientInclude, teacher: { select: { name: true } } } });
    await notifyRecipientsAssignmentSent(assignment, assignment.teacher.name);
    res.json({ assignment });
  } catch (e) {
    handleErr(res, e);
  }
});
