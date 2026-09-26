import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { trWeekRange, recipientStatus, netOf } from "../weekStats.js";
import { buildMonthlySummary, monthBounds } from "../monthlySummary.js";

// server/src/app.js'de requireAuth + requireRole("TEACHER") ile mount edilir.
export const teacherRouter = Router();

teacherRouter.get("/students", async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { teacherId: req.userId, role: "STUDENT" },
      select: { id: true, name: true, email: true, username: true, className: true, gradeLevel: true, banned: true, lastSeenAt: true, createdAt: true },
      orderBy: { name: "asc" },
    });

    // Her öğrenci için tamamlanma oranı — /stats/teacher'daki genel orandan farklı olarak öğrenci
    // bazında, listede kartın altında gösterilsin diye (yalnızca gönderilmiş ödevler sayılır).
    // Öğrenciye kim gönderirse göndersin (koç, ders öğretmeninin okul çapındaki ödevi, önceki koç)
    // TÜM gönderilmiş ödevler sayılır — öğrenci özet ekranındaki oranla aynı kural, ikisi tutarlı kalsın.
    const recipients = await prisma.assignmentRecipient.findMany({
      where: { studentId: { in: students.map((s) => s.id) }, assignment: { status: "SENT" } },
      select: {
        id: true, studentId: true, completed: true, skippedAt: true, skipReason: true,
        submission: { select: { correctCount: true, wrongCount: true } },
        assignment: { select: { endDate: true, subject: true, topic: true, targetMode: true, teacherId: true } },
      },
    });
    // Koç panosu (bkz. TeacherStudentsScreen): bu haftanın (Pzt–Paz, Türkiye) ödevleri durumlarıyla,
    // haftalık net ve geçen haftaya göre değişim, koçun kendi ödevleri (x/y), toplam geciken.
    // Geciken: tamamlanmamış, pas geçilmemiş ve bitiş gününün Türkiye'deki sonu geçmiş — istemcideki
    // "X gün gecikti" ve zamanlayıcının gecikme kuralıyla aynı (bkz. scheduler.js).
    const now = new Date();
    const { mon, sun, prevMon } = trWeekRange(now);
    const byStudent = new Map();
    for (const r of recipients) {
      const e = byStudent.get(r.studentId) || { total: 0, completed: 0, overdue: 0, week: [], weekNet: 0, prevWeekNet: null, mineDone: 0, mineTotal: 0 };
      const status = recipientStatus(r, now);
      const end = r.assignment.endDate.getTime();
      const net = netOf(r.submission);
      e.total += 1;
      if (r.completed) e.completed += 1;
      else if (status === "missed") e.overdue += 1;
      if (end >= mon.getTime() && end <= sun.getTime()) {
        const schoolWide = r.assignment.targetMode === "SCHOOL_WIDE";
        e.week.push({ id: r.id, subject: r.assignment.subject, topic: r.assignment.topic, schoolWide, status, net, skipReason: r.skipReason });
        if (net != null) e.weekNet += net;
        if (!schoolWide && r.assignment.teacherId === req.userId) {
          e.mineTotal += 1;
          if (r.completed) e.mineDone += 1;
        }
      } else if (end >= prevMon.getTime() && end < mon.getTime() && net != null) {
        e.prevWeekNet = (e.prevWeekNet || 0) + net;
      }
      byStudent.set(r.studentId, e);
    }
    const withRates = students.map((s) => {
      const e = byStudent.get(s.id);
      return {
        ...s,
        completionRate: e && e.total ? Math.round((e.completed / e.total) * 100) : null,
        assignmentCount: e?.total || 0,
        overdueCount: e?.overdue || 0,
        week: e?.week || [],
        weekNet: e?.week.some((w) => w.net != null) ? e.weekNet : null,
        prevWeekNet: e?.prevWeekNet ?? null,
        mine: { done: e?.mineDone || 0, total: e?.mineTotal || 0 },
      };
    });

    res.json({ students: withRates });
  } catch (e) {
    handleErr(res, e);
  }
});

// Aylık raporlar ekranı (koç): her öğrencinin o ayki özeti — yapay zekâ incelemesiyle AYNI hesap
// (monthlySummary.js), ekran ve inceleme aynı sayıları görsün. Ayrıntı öğrenci raporunda.
teacherRouter.get("/monthly-reports", async (req, res) => {
  try {
    const { month } = req.query || {};
    assert(monthBounds(month), "Geçersiz ay");
    const students = await prisma.user.findMany({
      where: { teacherId: req.userId, role: "STUDENT", banned: false },
      select: { id: true, name: true, className: true },
      orderBy: { name: "asc" },
    });
    const analyses = await prisma.aiAnalysis.findMany({ where: { month, studentId: { in: students.map((s) => s.id) } }, select: { studentId: true } });
    const withAi = new Set(analyses.map((a) => a.studentId));
    const rows = [];
    for (const st of students) {
      const s = await buildMonthlySummary(st.id, month);
      rows.push({
        id: st.id, name: st.name, className: st.className,
        toplam: s.toplam, oncekiAyToplam: s.oncekiAyToplam, odevDuzeni: s.odevDuzeni, aktifGunSayisi: s.aktifGunSayisi,
        serbestCalisma: { kayit: s.serbestCalisma.kayit, soru: s.serbestCalisma.soru },
        // Ham net oranı eşikleri (65 / 40) — ayrıntılı etiket (küçültme + okul düzeltmesi) öğrenci raporunda.
        odakDersler: s.dersler.filter((d) => !d.veriAz && d.netOrani != null && d.netOrani < 40).map((d) => d.ders),
        gucluDersler: s.dersler.filter((d) => !d.veriAz && d.netOrani != null && d.netOrani >= 65).map((d) => d.ders),
        aiHazir: withAi.has(st.id),
      });
    }
    res.json({ month, students: rows });
  } catch (e) {
    handleErr(res, e);
  }
});

teacherRouter.get("/students/:id/overview", async (req, res) => {
  try {
    const student = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, username: true, className: true, gradeLevel: true, banned: true, teacherId: true, role: true, lastSeenAt: true, createdAt: true },
    });
    assert(student && student.role === "STUDENT" && student.teacherId === req.userId, "Bu öğrenci sana atanmamış", 403);
    const [recipients, studySessions, notes] = await Promise.all([
      // Başka öğretmenlerin TASLAKLARI (öğrenciye henüz gitmemiş) gösterilmez; kendi taslakları ve
      // herkesin gönderilmiş ödevleri gösterilir. assignment.teacher, istemcinin başkasına ait ödevi
      // "X tarafından verildi" diye işaretleyebilmesi için.
      prisma.assignmentRecipient.findMany({
        where: { studentId: student.id, assignment: { OR: [{ status: "SENT" }, { teacherId: req.userId }] } },
        include: { assignment: { include: { teacher: { select: { id: true, name: true } } } }, submission: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.studySession.findMany({ where: { studentId: student.id }, orderBy: { studyDate: "desc" } }),
      // Yalnızca BU koçun yazdığı notlar (bkz. schema.prisma > CoachNote).
      prisma.coachNote.findMany({ where: { studentId: student.id, teacherId: req.userId }, orderBy: { createdAt: "desc" }, select: NOTE_SELECT }),
    ]);
    // coachNote: eski uygulama sürümleri tek not alanı bekliyor — en son notun metni.
    res.json({ student: { ...student, coachNote: notes[0]?.text ?? null }, recipients, studySessions, notes });
  } catch (e) {
    handleErr(res, e);
  }
});

// --- Koçun tarihli özel notları (bkz. schema.prisma > CoachNote) ---
// Yalnızca yazan koç görür; not eklemek için öğrenci şu an o koça atanmış olmalı. Düzenleme/silme
// yalnızca notun yazarına açık. Öğrenci başka koça geçince eski koçun notları silinir (routes/admin.js).
const NOTE_SELECT = { id: true, text: true, createdAt: true, updatedAt: true };
const MAX_NOTE_LENGTH = 2000;

// maxLength: var olan bir not düzenlenirken eskisinden kısa olmaya zorlanmaz — eski tek not alanında sınır
// yoktu, taşınan uzun bir not 2000 sınırı yüzünden hiç düzenlenemez hâle gelmesin.
function cleanNoteText(text, maxLength = MAX_NOTE_LENGTH) {
  const t = typeof text === "string" ? text.trim() : "";
  assert(t, "Not boş olamaz");
  assert(t.length <= maxLength, `Not en fazla ${maxLength} karakter olabilir`);
  return t;
}

async function assertMyStudent(req) {
  const student = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true, teacherId: true } });
  assert(student && student.role === "STUDENT" && student.teacherId === req.userId, "Bu öğrenci sana atanmamış", 403);
  return student;
}

async function loadMyNote(req) {
  const note = await prisma.coachNote.findUnique({ where: { id: req.params.noteId } });
  // Başkasının notunun varlığı bile sızmasın — yazarı değilse "bulunamadı".
  assert(note && note.teacherId === req.userId, "Not bulunamadı", 404);
  return note;
}

teacherRouter.post("/students/:id/notes", async (req, res) => {
  try {
    const student = await assertMyStudent(req);
    const text = cleanNoteText(req.body?.text);
    const note = await prisma.coachNote.create({ data: { studentId: student.id, teacherId: req.userId, text }, select: NOTE_SELECT });
    res.status(201).json({ note });
  } catch (e) {
    handleErr(res, e);
  }
});

teacherRouter.patch("/notes/:noteId", async (req, res) => {
  try {
    const existing = await loadMyNote(req);
    const text = cleanNoteText(req.body?.text, Math.max(MAX_NOTE_LENGTH, existing.text.length));
    // Metin değişmediyse yazılmaz — updatedAt ilerleyip not "düzenlendi" görünmesin.
    const note = text === existing.text
      ? await prisma.coachNote.findUnique({ where: { id: existing.id }, select: NOTE_SELECT })
      : await prisma.coachNote.update({ where: { id: existing.id }, data: { text }, select: NOTE_SELECT });
    res.json({ note });
  } catch (e) {
    handleErr(res, e);
  }
});

teacherRouter.delete("/notes/:noteId", async (req, res) => {
  try {
    const existing = await loadMyNote(req);
    await prisma.coachNote.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

// Eski uygulama sürümleri (tek not alanı) için uyumluluk: gönderilen metin koçun EN SON notunu günceller
// (yoksa yeni not açılır); boş metin en son notu siler. Yanıt eskisi gibi { coachNote }.
teacherRouter.put("/students/:id/note", async (req, res) => {
  try {
    const student = await assertMyStudent(req);
    const raw = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    const latest = await prisma.coachNote.findFirst({ where: { studentId: student.id, teacherId: req.userId }, orderBy: { createdAt: "desc" } });
    if (!raw) {
      if (latest) await prisma.coachNote.delete({ where: { id: latest.id } });
      const next = await prisma.coachNote.findFirst({ where: { studentId: student.id, teacherId: req.userId }, orderBy: { createdAt: "desc" }, select: { text: true } });
      return res.json({ coachNote: next?.text ?? null });
    }
    const text = cleanNoteText(raw, Math.max(MAX_NOTE_LENGTH, latest?.text.length || 0));
    if (latest && latest.text !== text) await prisma.coachNote.update({ where: { id: latest.id }, data: { text } });
    else await prisma.coachNote.create({ data: { studentId: student.id, teacherId: req.userId, text } });
    res.json({ coachNote: text });
  } catch (e) {
    handleErr(res, e);
  }
});
