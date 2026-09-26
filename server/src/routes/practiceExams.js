import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { trackForGrade } from "../subjects.js";
import { validatePracticeExam, serializePracticeExam } from "../practiceExams.js";

// Deneme sınavları (TYT/AYT). server/src/app.js'de requireAuth ile mount edilir — roller karışık kullanır, yetki her
// handler'da kontrol edilir:
//  • Öğrenci: yalnızca KENDİ denemelerini görür ve ekler; yalnızca kendi girdiği kaydı düzenler/siler (koçun girdiği
//    kayıt — ör. okulun resmî deneme sonucu — öğrencinin elinden değişmesin; düzeltmeyi koçu yapar).
//  • Koç: yalnızca kendi öğrencisi (student.teacherId === koç) için görür, ekler, düzenler, siler — kaydı kim girmiş
//    olursa olsun (öğrencinin yazım hatasını düzeltebilsin). Branş öğretmeninin koçluk ettiği öğrenci yoksa hep 403.
//  • Admin: okur (liste/tekil), yazamaz.
// Kaydı giren hesap createdById'de tutulur (yanıtta yalnızca byStudent/canEdit olarak).
export const practiceExamsRouter = Router();

const viewerOf = (req) => ({ role: req.userRole, userId: req.userId });

// Hangi öğrencinin denemeleri: öğrenci için kendisi; koç/admin için ?studentId (ya da gövdedeki studentId).
// write: yazma isteği mi (admin yazamaz).
async function resolveStudent(req, studentId, { write }) {
  if (req.userRole === "STUDENT") {
    assert(!studentId || studentId === req.userId, "Bu işlem için yetkin yok", 403);
    return prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, gradeLevel: true } });
  }
  assert(req.userRole === "TEACHER" || (req.userRole === "ADMIN" && !write), "Bu işlem için yetkin yok", 403);
  assert(typeof studentId === "string" && studentId, "studentId gerekli");
  const student = await prisma.user.findUnique({ where: { id: studentId }, select: { id: true, role: true, teacherId: true, gradeLevel: true } });
  if (req.userRole === "TEACHER") {
    assert(student && student.role === "STUDENT" && student.teacherId === req.userId, "Bu öğrenci sana atanmamış", 403);
  } else {
    assert(student && student.role === "STUDENT", "Bulunamadı", 404);
  }
  return student;
}

// Tekil kayıt + erişim: okuma herkes için resolveStudent kuralıyla; yazmada öğrenci yalnızca kendi girdiğini değiştirir.
async function loadExam(req, { write }) {
  const exam = await prisma.practiceExam.findUnique({ where: { id: req.params.id }, include: { results: true } });
  assert(exam, "Bulunamadı", 404);
  await resolveStudent(req, exam.studentId, { write });
  if (write && req.userRole === "STUDENT") {
    assert(exam.createdById === req.userId, "Bu denemeyi koçun girdi; düzeltmek için koçuna yaz", 403);
  }
  return exam;
}

// Yalnızca YKS (TYT/AYT) öğrencisi: sınıf düzeyi girilmemişse serbest (studySessions.js > assertMatchesOwnTrack ile aynı).
function assertYks(student) {
  const track = trackForGrade(student?.gradeLevel);
  assert(track === null || track === "YKS", "Bu öğrencinin sınıf düzeyi TYT/AYT denemesiyle uyuşmuyor");
}

practiceExamsRouter.get("/", async (req, res) => {
  try {
    const student = await resolveStudent(req, req.query?.studentId, { write: false });
    const exams = await prisma.practiceExam.findMany({
      where: { studentId: student.id },
      include: { results: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    res.json({ exams: exams.map((e) => serializePracticeExam(e, viewerOf(req))) });
  } catch (e) {
    handleErr(res, e);
  }
});

practiceExamsRouter.get("/:id", async (req, res) => {
  try {
    const exam = await loadExam(req, { write: false });
    res.json({ exam: serializePracticeExam(exam, viewerOf(req)) });
  } catch (e) {
    handleErr(res, e);
  }
});

practiceExamsRouter.post("/", async (req, res) => {
  try {
    const student = await resolveStudent(req, req.body?.studentId, { write: true });
    assertYks(student);
    const data = validatePracticeExam(req.body);
    const exam = await prisma.practiceExam.create({
      data: {
        studentId: student.id, createdById: req.userId, examType: data.examType, date: data.date, name: data.name,
        results: { create: data.results },
      },
      include: { results: true },
    });
    res.status(201).json({ exam: serializePracticeExam(exam, viewerOf(req)) });
  } catch (e) {
    handleErr(res, e);
  }
});

// Tam değiştirme: sınav türü, tarih, ad ve ders sonuçlarının TAMAMI yeniden gönderilir (form her zaman tüm dersleri
// yollar). Eski ders satırları aynı transaction'da silinip yenileri yazılır — yarım kalmış bir düzenleme olmaz.
practiceExamsRouter.put("/:id", async (req, res) => {
  try {
    const exam = await loadExam(req, { write: true });
    const data = validatePracticeExam(req.body);
    const [, updated] = await prisma.$transaction([
      prisma.practiceExamResult.deleteMany({ where: { examId: exam.id } }),
      prisma.practiceExam.update({
        where: { id: exam.id },
        data: { examType: data.examType, date: data.date, name: data.name, results: { create: data.results } },
        include: { results: true },
      }),
    ]);
    res.json({ exam: serializePracticeExam(updated, viewerOf(req)) });
  } catch (e) {
    handleErr(res, e);
  }
});

practiceExamsRouter.delete("/:id", async (req, res) => {
  try {
    const exam = await loadExam(req, { write: true });
    await prisma.practiceExam.delete({ where: { id: exam.id } });
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});
