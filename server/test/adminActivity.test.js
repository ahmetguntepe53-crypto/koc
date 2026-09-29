// Aktivite — GET /api/admin/activity (bkz. src/routes/adminActivity.js). Yalnız admin; günlük/haftalık
// giriş sayıları LoginDay tablosundan; requireAuth'un o tabloya gerçekten yazdığı da doğrulanır.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { resetDatabase, seedSchool, loginAll, api, prisma } from "./helpers.js";
import { trTodayAsDateOnly } from "../src/quietHours.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const today = trTodayAsDateOnly(new Date());
const daysAgo = (n) => new Date(today.getTime() - n * DAY_MS);

let w, t;
beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 3 }); // 6 öğrenci, admin + coachA + coachB + branch
  t = await loginAll({ admin: w.admin, coachA: w.coachA, student: w.grade12[0] });
});

describe("yetki", () => {
  it("yalnız admin çağırabilir", async () => {
    for (const token of [t.coachA, t.student]) {
      const r = await api(token).get("/api/admin/activity");
      expect(r.status).toBe(403);
    }
  });
});

describe("requireAuth gerçekten LoginDay yazıyor", () => {
  it("bir isteğin ardından bugüne ait bir LoginDay satırı açılır", async () => {
    const before = await prisma.loginDay.count({ where: { userId: w.coachB.id, day: today } });
    expect(before).toBe(0);
    const token = (await loginAll({ coachB: w.coachB })).coachB;
    await api(token).get("/api/auth/me");
    const after = await prisma.loginDay.count({ where: { userId: w.coachB.id, day: today } });
    expect(after).toBe(1);
  });
});

// Yukarıdaki iki grup, requireAuth'un kendi yan etkisiyle bazı kullanıcılara (coachA, öğrenci, coachB)
// zaten bugünkü LoginDay satırını açtı — sayım testleri bundan bağımsız, temiz bir tablo ister.
describe("sayılar", () => {
  beforeEach(async () => {
    await prisma.loginDay.deleteMany({});
    // Yukarıdaki gruplar bazı kullanıcılarda (coachA, öğrenci, coachB) requireAuth'un yan etkisiyle
    // lastSeenAt'i de doldurdu — inactive sayımı için bunu da sıfırlar, sayım testleri tamamen temiz başlasın.
    await prisma.user.updateMany({ where: { role: { in: ["STUDENT", "TEACHER"] } }, data: { lastSeenAt: null } });
  });

  it("bugünkü ve pencere içi günlük sayılar doğru, günü olmayan günler sıfır", async () => {
    // 2 öğrenci bugün, 1 öğretmen 3 gün önce, 1 öğrenci pencere DIŞINDA (10 gün önce, days=7 pencerede yok).
    await prisma.loginDay.createMany({
      data: [
        { userId: w.grade11[0].id, day: today },
        { userId: w.grade11[1].id, day: today },
        { userId: w.branch.id, day: daysAgo(3) },
        { userId: w.grade12[0].id, day: daysAgo(10) },
      ],
    });
    const r = await api(t.admin).get("/api/admin/activity?days=7");
    expect(r.status).toBe(200);
    expect(r.body.today.students).toBe(2);
    expect(r.body.today.teachers).toBe(0);
    expect(r.body.daily).toHaveLength(7);
    expect(r.body.daily[r.body.daily.length - 1].students).toBe(2); // bugün, sondaki gün
    const threeDaysAgoEntry = r.body.daily.find((d) => new Date(d.day).getTime() === daysAgo(3).getTime());
    expect(threeDaysAgoEntry.teachers).toBe(1);
    // Girişi olmayan bir gün (ör. 5 gün önce) sıfır olarak listede kalmalı, atlanmamalı.
    const fiveDaysAgoEntry = r.body.daily.find((d) => new Date(d.day).getTime() === daysAgo(5).getTime());
    expect(fiveDaysAgoEntry).toBeDefined();
    expect(fiveDaysAgoEntry.students).toBe(0);
    // 10 gün önceki öğrenci girişi 7 günlük pencerenin dışında.
    expect(r.body.daily.every((d) => d.students <= 2)).toBe(true);
    // activeThisWeek: yalnız pencere (son inactiveDays=7 gün) içindeki FARKLI kullanıcılar.
    expect(r.body.activeThisWeek.students).toBe(2); // grade11[0], grade11[1] — grade12[0] 10 gün önce, dışarıda
    expect(r.body.activeThisWeek.teachers).toBe(1); // branch
  });

  it("totals ve inactive doğru; askıya alınmış hesap sayılmaz", async () => {
    const banned = w.grade11[0];
    await prisma.user.update({ where: { id: banned.id }, data: { banned: true } });
    const totalStudentsBefore = w.grade11.length + w.grade12.length;

    const r = await api(t.admin).get("/api/admin/activity?days=7");
    expect(r.body.totals.students).toBe(totalStudentsBefore - 1); // askıdaki sayılmaz
    expect(r.body.totals.teachers).toBe(3); // coachA + coachB + branch
    // lastSeenAt hiçbirinde set edilmedi (seedSchool doğrudan Prisma ile oluşturuyor, giriş yapılmadı) —
    // askıda olmayan herkes "hiç girmedi" sayılır.
    expect(r.body.inactive.students).toBe(totalStudentsBefore - 1);
    expect(r.body.inactive.teachers).toBe(3);

    await prisma.user.update({ where: { id: banned.id }, data: { banned: false } });
  });

  it("geçersiz days sorgusu varsayılan 14'e düşer", async () => {
    const r = await api(t.admin).get("/api/admin/activity?days=999");
    expect(r.status).toBe(200);
    expect(r.body.days).toBe(14);
    expect(r.body.daily).toHaveLength(14);
  });
});
