import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { assert } from "../validators.js";
import { trWeekRange } from "../weekStats.js";
import { trTodayAsDateOnly } from "../quietHours.js";

// Kurulum > "Sıralama" — öğrenci ADIYLA genel başarı sıralaması (tüm derslerin toplamı, ders bazlı
// değil). 2026-09-29: okulun BİLİNÇLİ kararıyla eklendi — "Okul analizi" (adminAnalytics.js) sekmesinin
// aksine burada öğrenci kimliği GİZLENMEZ; okul yönetimi kendi öğrencisinin adını görmek istedi.
// routes/admin.js'e alt yol olarak bağlanır (adminRouter.use("/leaderboard", …)); admin router zaten
// app.js'de requireAuth + requireRole("ADMIN") arkasında.
//
// Kaynak: bir öğrencinin TÜM zamanlardaki sonuçları — hem atanmış ödevlerin (Submission) hem serbest
// çalışmanın (StudySession) toplamı, tıpkı öğrencinin kendi raporundaki "genel" sekmesi gibi (bkz.
// routes/stats.js > full-report). Net oranı = (doğru − yanlış/4) / (doğru+yanlış+boş) × 100.
export const adminLeaderboardRouter = Router();

// Birkaç sorudan oluşan bir öğrencinin %100 ya da %0'ı istatistiksel olarak anlamsız — genel
// sıralamada MIN_QUESTIONS'ın altındaki öğrenciler listenin ALTINDA, "yeterli veri yok" diye ayrı
// gösterilir (silinmez, gizlenmez — sadece sıralamaya girmez). Tek bir ödevlik eşikten (stats.js'teki 10)
// daha yüksek: bu TÜM zamanların toplamı, bir ödevden çok daha fazla veri birikmesi beklenir.
export const LEADERBOARD_MIN_QUESTIONS = 30;

// Dönem (?period=day|week|month|all, varsayılan all): ödevde bitiş gününe, serbest çalışmada çalışma gününe göre.
// Kısa dönemde çözülen soru az olur — sıralamaya girme eşiği döneme göre küçülür (günlük 5, haftalık 10, aylık 20).
const DAY = 24 * 60 * 60 * 1000;
const PERIOD_MIN_QUESTIONS = { day: 5, week: 10, month: 20, all: LEADERBOARD_MIN_QUESTIONS };
function periodRange(period, now = new Date()) {
  const today = trTodayAsDateOnly(now);
  if (period === "day") return [today, new Date(today.getTime() + DAY)];
  if (period === "week") { const { mon } = trWeekRange(now); return [mon, new Date(mon.getTime() + 7 * DAY)]; }
  if (period === "month") return [new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1))];
  return null;
}

adminLeaderboardRouter.get("/", async (req, res) => {
  try {
    const period = req.query.period || "all";
    assert(period in PERIOD_MIN_QUESTIONS, "Geçersiz dönem (day, week, month ya da all)");
    const minQuestions = PERIOD_MIN_QUESTIONS[period];
    const range = periodRange(period);
    const [submissions, sessions, students] = await Promise.all([
      prisma.submission.findMany({
        where: range ? { recipient: { assignment: { endDate: { gte: range[0], lt: range[1] } } } } : undefined,
        select: { correctCount: true, wrongCount: true, blankCount: true, recipient: { select: { studentId: true } } },
      }),
      prisma.studySession.findMany({
        where: range ? { studyDate: { gte: range[0], lt: range[1] } } : undefined,
        select: { studentId: true, correctCount: true, wrongCount: true, blankCount: true },
      }),
      prisma.user.findMany({
        where: { role: "STUDENT", banned: false },
        select: { id: true, name: true, avatar: true, gradeLevel: true, className: true },
      }),
    ]);

    const totals = new Map(); // studentId -> { correct, wrong, blank }
    const add = (studentId, c, w, b) => {
      const t = totals.get(studentId) || { correct: 0, wrong: 0, blank: 0 };
      t.correct += c; t.wrong += w; t.blank += b;
      totals.set(studentId, t);
    };
    for (const s of submissions) add(s.recipient.studentId, s.correctCount, s.wrongCount, s.blankCount);
    for (const s of sessions) add(s.studentId, s.correctCount, s.wrongCount, s.blankCount);

    const rows = students.map((s) => {
      const t = totals.get(s.id) || { correct: 0, wrong: 0, blank: 0 };
      const totalQuestions = t.correct + t.wrong + t.blank;
      const netRate = totalQuestions > 0 ? Math.round(((t.correct - t.wrong / 4) / totalQuestions) * 1000) / 10 : null;
      return {
        id: s.id, name: s.name, avatar: s.avatar, gradeLevel: s.gradeLevel, className: s.className,
        totalQuestions, correct: t.correct, wrong: t.wrong, blank: t.blank, netRate,
        ranked: totalQuestions >= minQuestions,
      };
    });

    // Sıralanabilenler net oranına göre azalan; eşitlikte daha çok soru çözen önde. Sıralanamayanlar
    // (eşik altı) ayrı bir grupta, çözdüğü soru sayısına göre azalan — en azından "biraz daha az kaldı"
    // görünsün diye, ama ana sıralamanın dışında.
    rows.sort((a, b) => {
      if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
      if (a.ranked) return b.netRate - a.netRate || b.totalQuestions - a.totalQuestions;
      return b.totalQuestions - a.totalQuestions;
    });

    res.json({ period, minQuestions, students: rows });
  } catch (e) {
    handleErr(res, e);
  }
});
