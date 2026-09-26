// Aylık rapor bildirimi (scheduler.js > notifyMonthlyReports), runSchedulerTick(sahteAn) ile:
//  • ayın ilk 7 günü, Türkiye saatiyle 08:00'den sonraki ilk turda, öğrencisi olan her koça BİR bildirim,
//  • aynı ay için ikinci kez gönderilmez (MonthlyReportRun), ilk haftadan sonra hiç gönderilmez,
//  • yarıda kalmış tur 15 dakika sonra devralınır ve bildirim almamış koçlara tamamlanır; süren tur devralınmaz.
// Push kapalı (FIREBASE_SERVICE_ACCOUNT_PATH boş, bkz. test/env.js) — yalnız Notification satırları yazılır.
import { describe, it, expect, beforeAll } from "vitest";
import { runSchedulerTick } from "../src/scheduler.js";
import { prisma, resetDatabase, seedSchool, createUser, trTime } from "./helpers.js";

let w;
let coachIds; // bildirim alması gerekenler
const monthly = (month) => prisma.notification.findMany({
  where: { type: "monthly_report", ...(month ? { data: { path: ["month"], equals: month } } : {}) },
  orderBy: { createdAt: "asc" },
});

beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 2 });
  // Bildirim ALMAMASI gerekenler: öğrencisi olmayan branş öğretmeni (seedSchool'da zaten var), yalnız askıya
  // alınmış öğrencisi olan koç, askıya alınmış koç.
  const lonely = await createUser({ role: "TEACHER", name: "Test Koç Askıdaki Öğrencili", email: "koc.c@okul.test", username: null });
  await createUser({ role: "STUDENT", name: "Test Öğrenci Askıda", username: "ogr-askida", gradeLevel: 12, teacherId: lonely.id, banned: true });
  const bannedCoach = await createUser({ role: "TEACHER", name: "Test Koç Askıda", email: "koc.d@okul.test", username: null, banned: true });
  await createUser({ role: "STUDENT", name: "Test Öğrenci Koçu Askıda", username: "ogr-kocu-askida", gradeLevel: 11, teacherId: bannedCoach.id });
  coachIds = [w.coachA.id, w.coachB.id].sort();
});

describe("aylık rapor bildirimi", () => {
  it("başlangıçta yok; 1 Ekim 07:30 (TR) erken", async () => {
    expect(await monthly()).toHaveLength(0);
    await runSchedulerTick(trTime("2026-10-01", "07:30"));
    expect(await monthly()).toHaveLength(0);
    expect(await prisma.monthlyReportRun.count()).toBe(0);
  });

  it("09:00'da öğrencisi olan her koça tek bildirim (Eylül raporları)", async () => {
    await runSchedulerTick(trTime("2026-10-01", "09:00"));
    const list = await monthly();
    expect(list.map((n) => n.userId).sort()).toEqual(coachIds);
    const coachAN = list.find((n) => n.userId === w.coachA.id);
    expect(coachAN.text).toMatch(/^Eylül ayı raporları hazır — 2 öğrencinin/);
    expect(coachAN.data).toEqual({ screen: "monthlyReports", month: "2026-09" });
    expect(coachAN.pushPending).toBe(false);
    const run = await prisma.monthlyReportRun.findUnique({ where: { month: "2026-09" } });
    expect(run.completedAt).toBeInstanceOf(Date);
  });

  it("aynı ay için ikinci kez gönderilmez", async () => {
    await runSchedulerTick(trTime("2026-10-01", "10:00"));
    await runSchedulerTick(trTime("2026-10-03", "10:00"));
    expect(await monthly()).toHaveLength(2);
  });

  it("ilk haftadan sonra (ayın 9'u) gönderilmez", async () => {
    await runSchedulerTick(trTime("2026-11-09", "10:00"));
    expect(await monthly("2026-10")).toHaveLength(0);
    expect(await prisma.monthlyReportRun.findUnique({ where: { month: "2026-10" } })).toBeNull();
  });

  it("sonraki ay, ilk hafta içinde yeniden gönderilir (sunucu 1'inde kapalı olsa bile)", async () => {
    await runSchedulerTick(trTime("2026-11-02", "10:00"));
    const oct = await monthly("2026-10");
    expect(oct.map((n) => n.userId).sort()).toEqual(coachIds);
    expect(oct[0].text).toMatch(/^Ekim ayı raporları hazır/);
  });

  it("sessiz saatlerde (23:00–07:00) zamanlayıcı hiçbir şey yapmaz", async () => {
    await runSchedulerTick(trTime("2026-12-01", "06:59"));
    expect(await prisma.monthlyReportRun.findUnique({ where: { month: "2026-11" } })).toBeNull();
  });
});

describe("yarıda kalmış tur", () => {
  beforeAll(async () => {
    // Kasım turu 09:00'da başlamış, yalnız Koç A'ya ulaşmış ve süreç çökmüş (completedAt boş).
    await prisma.notification.create({ data: { userId: w.coachA.id, text: "önceki turdan", type: "monthly_report", data: { screen: "monthlyReports", month: "2026-11" } } });
    await prisma.monthlyReportRun.create({ data: { month: "2026-11", sentAt: trTime("2026-12-01", "09:00") } });
  });

  it("15 dakikadan yeni tur devralınmaz", async () => {
    await runSchedulerTick(trTime("2026-12-01", "09:05"));
    expect(await monthly("2026-11")).toHaveLength(1);
    expect((await prisma.monthlyReportRun.findUnique({ where: { month: "2026-11" } })).completedAt).toBeNull();
  });

  it("30 dakika sonra devralınır: eksik koça gider, aynı koça ikinci bildirim gitmez", async () => {
    await runSchedulerTick(trTime("2026-12-01", "09:30"));
    const nov = await monthly("2026-11");
    expect(nov.map((n) => n.userId).sort()).toEqual(coachIds);
    const run = await prisma.monthlyReportRun.findUnique({ where: { month: "2026-11" } });
    expect(run.completedAt).toBeInstanceOf(Date);
    expect(run.sentAt.getTime()).toBe(trTime("2026-12-01", "09:30").getTime());
  });

  it("tamamlanmış tur bir daha çalışmaz", async () => {
    await runSchedulerTick(trTime("2026-12-02", "09:30"));
    expect(await monthly("2026-11")).toHaveLength(2);
  });
});
