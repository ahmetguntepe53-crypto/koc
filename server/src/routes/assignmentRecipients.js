import { Router } from "express";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { photoUpload, recipientPhotosDir, hasValidImageSignature } from "../uploads.js";

// server/src/app.js'de requireAuth ile mount edilir — sahiplik kontrolleri handler içinde yapılır.
export const assignmentRecipientsRouter = Router();

// 6: tasarım dokümanı — 20 fotoğraf ne öğrencinin yükleyeceği ne koçun bakacağı bir sayıydı.
const MAX_PHOTOS_PER_RECIPIENT = 6;
// Submission.correctCount/wrongCount/blankCount Int (32 bit) — çok büyük bir sayı DB'de taşıp 500'e
// dönüşürdü; gerçekçi hiçbir ödev bu kadar soru içermez.
const MAX_ANSWER_COUNT = 10000;

const assignmentInclude = {
  assignment: { include: { teacher: { select: { id: true, name: true } } } },
  submission: true,
  photos: { orderBy: { createdAt: "asc" } },
};

assignmentRecipientsRouter.get("/mine", async (req, res) => {
  try {
    assert(req.userRole === "STUDENT", "Bu işlem için yetkin yok", 403);
    const { completed, subject } = req.query || {};
    const where = { studentId: req.userId };
    if (completed === "true") where.completed = true;
    if (completed === "false") where.completed = false;
    if (subject) where.assignment = { subject };
    const recipients = await prisma.assignmentRecipient.findMany({
      where,
      include: assignmentInclude,
      orderBy: { createdAt: "desc" },
    });
    // Öğrenci henüz gönderilmemiş (DRAFT) ödevleri hiç görmemeli — sadece SENT olanlar listelenir.
    res.json({ recipients: recipients.filter((r) => r.assignment.status === "SENT") });
  } catch (e) {
    handleErr(res, e);
  }
});

assignmentRecipientsRouter.get("/:id", async (req, res) => {
  try {
    const recipient = await prisma.assignmentRecipient.findUnique({
      where: { id: req.params.id },
      include: { ...assignmentInclude, student: { select: { id: true, name: true, avatar: true, className: true } } },
    });
    assert(recipient, "Bulunamadı", 404);
    const isOwner = req.userRole === "STUDENT" && recipient.studentId === req.userId;
    const isTeacherOwner = req.userRole === "TEACHER" && recipient.assignment.teacherId === req.userId;
    assert(isOwner || isTeacherOwner || req.userRole === "ADMIN", "Bu işlem için yetkin yok", 403);
    // Öğrenci, GET /mine ile aynı kurala tabi: henüz gönderilmemiş (DRAFT) bir ödevin detayını asla
    // görmemeli — koç/admin kendi yönetim görünümü için DRAFT'ı da görebilir.
    if (isOwner) assert(recipient.assignment.status === "SENT", "Bulunamadı", 404);
    res.json({ recipient });
  } catch (e) {
    handleErr(res, e);
  }
});

async function submitHandler(req, res) {
  try {
    assert(req.userRole === "STUDENT", "Bu işlem için yetkin yok", 403);
    const recipient = await prisma.assignmentRecipient.findUnique({ where: { id: req.params.id }, include: { assignment: true } });
    assert(recipient, "Bulunamadı", 404);
    assert(recipient.studentId === req.userId, "Bu işlem için yetkin yok", 403);
    assert(recipient.assignment.status === "SENT", "Bu ödev henüz sana gönderilmedi", 409);

    const { correctCount, wrongCount, blankCount, note, questionNumbers } = req.body || {};
    const nums = [correctCount, wrongCount, blankCount];
    assert(nums.every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_ANSWER_COUNT), `Doğru/yanlış/boş sayıları 0-${MAX_ANSWER_COUNT} arasında birer tam sayı olmalı`);
    const cleanQuestionNumbers = Array.isArray(questionNumbers) ? questionNumbers.filter((n) => Number.isInteger(n) && n >= 0 && n <= MAX_ANSWER_COUNT) : [];

    const submission = await prisma.$transaction(async (tx) => {
      // Sonuç girilen ödev artık "pas geçildi" değil — ama pas geçilip sonra teslim edildiği bilgisi korunur
      // (priorSkippedAt): rapor bunu gecikme değil düzeltme sayar. Zaten girilmiş bir sonucun düzenlenmesi teslim
      // zamanını DEĞİŞTİRMEZ; önceden düzenleme anı yeni teslim zamanı oluyor, zamanında ödev geriye dönük "geç"e dönüyordu.
      const firstCompletion = !recipient.completed;
      await tx.assignmentRecipient.update({
        where: { id: recipient.id },
        data: {
          completed: true,
          ...(firstCompletion || !recipient.completedAt ? { completedAt: new Date() } : {}),
          ...(firstCompletion && recipient.skippedAt ? { priorSkippedAt: recipient.skippedAt, priorSkipReason: recipient.skipReason } : {}),
          skippedAt: null, skipReason: null, skipNote: null,
        },
      });
      return tx.submission.upsert({
        where: { recipientId: recipient.id },
        update: { correctCount, wrongCount, blankCount, note: note ? String(note).trim() : null, questionNumbers: cleanQuestionNumbers },
        create: { recipientId: recipient.id, correctCount, wrongCount, blankCount, note: note ? String(note).trim() : null, questionNumbers: cleanQuestionNumbers },
      });
    });
    res.json({ submission });
  } catch (e) {
    handleErr(res, e);
  }
}

assignmentRecipientsRouter.post("/:id/submit", submitHandler);
assignmentRecipientsRouter.patch("/:id/submit", submitHandler);

// "Pas geç": öğrenci ödevi çözemediğini sebebiyle bildirir — boş bırakmaktan farklıdır, koçu ve branş
// öğretmeni sebebi görür (bkz. schema.prisma > AssignmentRecipient.skipReason). Sonucu girilmiş ödev pas
// geçilemez; pas geri alınabilir, sonradan sonuç girilirse de kendiliğinden kalkar.
export const SKIP_REASONS = ["KONU", "ZAMAN", "KAYNAK", "DIGER"];

assignmentRecipientsRouter.post("/:id/skip", async (req, res) => {
  try {
    assert(req.userRole === "STUDENT", "Bu işlem için yetkin yok", 403);
    const recipient = await prisma.assignmentRecipient.findUnique({ where: { id: req.params.id }, include: { assignment: true } });
    assert(recipient && recipient.studentId === req.userId, "Bulunamadı", 404);
    assert(recipient.assignment.status === "SENT", "Bu ödev henüz sana gönderilmedi", 409);
    assert(!recipient.completed, "Sonucunu girdiğin ödev pas geçilemez", 409);
    const { reason, note } = req.body || {};
    assert(SKIP_REASONS.includes(reason), "Bir sebep seç");
    const cleanNote = reason === "DIGER" && note ? String(note).trim().slice(0, 300) || null : null;
    const updated = await prisma.assignmentRecipient.update({
      where: { id: recipient.id },
      data: { skippedAt: new Date(), skipReason: reason, skipNote: cleanNote },
      select: { id: true, skippedAt: true, skipReason: true, skipNote: true },
    });
    res.json({ recipient: updated });
  } catch (e) {
    handleErr(res, e);
  }
});

assignmentRecipientsRouter.delete("/:id/skip", async (req, res) => {
  try {
    assert(req.userRole === "STUDENT", "Bu işlem için yetkin yok", 403);
    const recipient = await prisma.assignmentRecipient.findUnique({ where: { id: req.params.id } });
    assert(recipient && recipient.studentId === req.userId, "Bulunamadı", 404);
    // Pası geri alıp sonra sonucunu giren öğrenci de pasını "düzeltmiş" sayılır — pasın zamanı/sebebi saklanır ki süresi
    // içinde verilmiş bir pas, geri alınınca sonraki teslimi "geç"e çevirmesin (rapor yalnızca teslim edilmişse kullanır).
    await prisma.assignmentRecipient.update({
      where: { id: recipient.id },
      data: {
        skippedAt: null, skipReason: null, skipNote: null,
        ...(recipient.skippedAt && !recipient.completed ? { priorSkippedAt: recipient.skippedAt, priorSkipReason: recipient.skipReason } : {}),
      },
    });
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

// Yalnızca ödevin sahibi öğrenci fotoğraf ekleyebilir/silebilir — koç ve admin yalnızca görüntüler
// (bkz. GET /:id). Silme, sonucu gönderdikten sonra da (yanlış fotoğrafı kaldırmak için) açık kalır.
async function assertPhotoOwner(req) {
  assert(req.userRole === "STUDENT", "Bu işlem için yetkin yok", 403);
  const recipient = await prisma.assignmentRecipient.findUnique({ where: { id: req.params.id }, include: { assignment: true } });
  assert(recipient, "Bulunamadı", 404);
  assert(recipient.studentId === req.userId, "Bu işlem için yetkin yok", 403);
  assert(recipient.assignment.status === "SENT", "Bu ödev henüz sana gönderilmedi", 409);
  return recipient;
}

assignmentRecipientsRouter.post("/:id/photos", async (req, res) => {
  try {
    const recipient = await assertPhotoOwner(req);

    await new Promise((resolve, reject) => {
      photoUpload(req, res, (err) => {
        if (!err) return resolve();
        const message = err.code === "LIMIT_FILE_SIZE" ? "Fotoğraf çok büyük (en fazla 10MB)" : err.message;
        reject(Object.assign(new Error(message), { status: err.status || 400 }));
      });
    });
    assert(req.file, "Fotoğraf bulunamadı", 400);
    if (!(await hasValidImageSignature(req.file))) {
      await unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: "Yalnızca JPG veya PNG fotoğraf yükleyebilirsin" });
    }

    // Sayım kasıtlı olarak yükleme TAMAMLANDIKTAN hemen önce, create'e bitişik tekrar yapılır —
    // yükleme (ağ+disk I/O) süresince değil. Bu, iki eşzamanlı isteğin ikisinin de limitin altında
    // sayıp limiti aşmasına yol açan pencereyi (check-then-act) pratikte anlamsız hale getirir.
    const existingCount = await prisma.recipientPhoto.count({ where: { recipientId: recipient.id } });
    if (existingCount >= MAX_PHOTOS_PER_RECIPIENT) {
      await unlink(path.join(recipientPhotosDir(recipient.id), req.file.filename)).catch(() => {});
      return res.status(409).json({ error: `En fazla ${MAX_PHOTOS_PER_RECIPIENT} fotoğraf ekleyebilirsin` });
    }

    const photo = await prisma.recipientPhoto.create({
      data: { recipientId: recipient.id, filename: req.file.filename, mimeType: req.file.mimetype, size: req.file.size },
    });
    res.status(201).json({ photo });
  } catch (e) {
    handleErr(res, e);
  }
});

assignmentRecipientsRouter.delete("/:id/photos/:photoId", async (req, res) => {
  try {
    const recipient = await assertPhotoOwner(req);
    const photo = await prisma.recipientPhoto.findUnique({ where: { id: req.params.photoId } });
    assert(photo && photo.recipientId === recipient.id, "Bulunamadı", 404);
    await prisma.recipientPhoto.delete({ where: { id: photo.id } });
    // DB kaydı silindikten sonra dosya silinir — dosya silme başarısız olsa bile (ör. zaten yoksa)
    // kullanıcı için işlem tamamlanmış sayılır, artık kayıp bir dosya diskte kalması zararsızdır.
    await unlink(path.join(recipientPhotosDir(recipient.id), photo.filename)).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});
