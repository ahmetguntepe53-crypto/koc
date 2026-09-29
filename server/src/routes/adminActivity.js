import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";
import { trTodayAsDateOnly } from "../quietHours.js";

// Kurulum > "Aktivite" — kaç öğrenci/öğretmenin bugün ve son N günde giriş yaptığı, kimin hiç girmediği.
// routes/admin.js'e alt yol olarak bağlanır (adminRouter.use("/activity", …)); admin router zaten
// app.js'de requireAuth + requireRole("ADMIN") arkasında.
//
// Kaynak: LoginDay (bkz. schema.prisma, middleware/auth.js) — bir kullanıcının bir Türkiye takvim
// gününde en az bir isteği en fazla 10 dakikalık gecikmeyle işaretlenir. lastSeenAt'in aksine geçmişe
// dönük kalır, bu yüzden "geçen hafta her gün giriş yaptı mı" gibi sorular buradan cevaplanabilir.
// GİZLİLİK: burada da tek tek öğrenci ADI dönmez — yalnızca toplam sayılar (kaç kişi). Kimin hiç
// girmediğini görmek isteyen admin zaten Hesaplar sekmesinde her hesabın "son giriş" satırını görüyor;
// bu ekran onun aksine TEK TEK değil TOPLU bir özet.
export const adminActivityRouter = Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOWS = [7, 14, 30];
const DEFAULT_DAYS = 14;
// "Bu hafta hiç girmedi" ve "N günden uzun süredir giriş yok" aynı pencereyi kullanır — Hesaplar
// listesindeki amber uyarıyla tutarlı olsun diye (bkz. src/work.js > lastSeenInfo, INACTIVE_DAYS).
const INACTIVE_DAYS = 7;
const ROLES = ["STUDENT", "TEACHER"];

adminActivityRouter.get("/", async (req, res) => {
  try {
    const days = WINDOWS.includes(Number(req.query.days)) ? Number(req.query.days) : DEFAULT_DAYS;
    const today = trTodayAsDateOnly(new Date());
    const from = new Date(today.getTime() - (days - 1) * DAY_MS);
    const inactiveCutoff = new Date(today.getTime() - INACTIVE_DAYS * DAY_MS);

    const [totals, loginRows, weekRows] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], where: { role: { in: ROLES }, banned: false }, _count: true }),
      // Pencere içindeki tüm giriş günleri, rolüyle birlikte — küçük veri (≈ kullanıcı × gün), JS'te toplanır.
      prisma.loginDay.findMany({
        where: { day: { gte: from }, user: { role: { in: ROLES } } },
        select: { day: true, userId: true, user: { select: { role: true } } },
      }),
      // Son 7 gün: kaç FARKLI kullanıcı en az bir kez giriş yapmış — "bu hafta aktif" sayısı için ayrı,
      // çünkü aynı kullanıcının birden fazla LoginDay satırı olabilir (gün başına bir).
      prisma.loginDay.findMany({
        where: { day: { gte: new Date(today.getTime() - (INACTIVE_DAYS - 1) * DAY_MS) }, user: { role: { in: ROLES } } },
        select: { userId: true, user: { select: { role: true } } },
      }),
    ]);

    const totalOf = (role) => totals.find((t) => t.role === role)?._count || 0;

    // Gün başına sayı — LoginDay olmayan günler de (ör. hafta sonu tatili) sıfır olarak listede kalsın.
    const byDay = new Map();
    for (let t = from.getTime(); t <= today.getTime(); t += DAY_MS) byDay.set(t, { STUDENT: 0, TEACHER: 0 });
    for (const r of loginRows) {
      const bucket = byDay.get(r.day.getTime());
      if (bucket) bucket[r.user.role] += 1;
    }
    const daily = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([t, counts]) => ({
      day: new Date(t).toISOString(),
      students: counts.STUDENT,
      teachers: counts.TEACHER,
    }));
    const todayCounts = daily[daily.length - 1] || { students: 0, teachers: 0 };

    const activeThisWeek = { STUDENT: new Set(), TEACHER: new Set() };
    for (const r of weekRows) activeThisWeek[r.user.role].add(r.userId);

    const inactiveCounts = await prisma.user.groupBy({
      by: ["role"],
      where: { role: { in: ROLES }, banned: false, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: inactiveCutoff } }] },
      _count: true,
    });
    const inactiveOf = (role) => inactiveCounts.find((t) => t.role === role)?._count || 0;

    res.json({
      days,
      inactiveDays: INACTIVE_DAYS,
      today: { day: today.toISOString(), students: todayCounts.students, teachers: todayCounts.teachers },
      daily,
      totals: { students: totalOf("STUDENT"), teachers: totalOf("TEACHER") },
      activeThisWeek: { students: activeThisWeek.STUDENT.size, teachers: activeThisWeek.TEACHER.size },
      inactive: { students: inactiveOf("STUDENT"), teachers: inactiveOf("TEACHER") },
    });
  } catch (e) {
    handleErr(res, e);
  }
});
