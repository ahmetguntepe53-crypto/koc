// Canlı hata izleme ve sağlık kontrolü:
//  • alerts.js: tür başına 30 dakikada bir e-posta, arada bastırılanların sayısı bir sonrakine eklenir, alıcı
//    ALERT_EMAIL → ADMIN_EMAIL, yapılandırma yoksa yalnız log, gönderim hatası fırlatmaz, gövdede kişisel veri yok,
//  • handleErr.js: yalnız BEKLENMEYEN 500'ler 10 dakikalık kayan pencerede sayılır, 5'te uyarı (4xx/P2025 sayılmaz),
//  • /api/health: DB'ye SELECT 1 (reddedilirse ya da 2 sn'de yanıt yoksa 503 {ok:false, db:false}), zamanlayıcı bu
//    süreçte çalışıyorsa son tur yaşı (10 dakikayı geçerse 503),
//  • scheduler.js: patlayan adım "scheduler:<adım>" uyarısı üretir, diğer adımlar sürer; lastTickAt/lastTickOk tutulur.
// E-posta gönderimi taklit edilir (mailer.sendAlertEmail) — Resend'e hiçbir şey gitmez.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("../src/mailer.js", async (importOriginal) => ({
  ...(await importOriginal()),
  sendAlertEmail: vi.fn(async () => true),
}));

import { sendAlertEmail } from "../src/mailer.js";
import { alert, describeError, _resetAlertsForTest, ALERT_RATE_WINDOW_MS } from "../src/alerts.js";
import { handleErr, recordUnexpected500, _reset500WindowForTest, ERROR_WINDOW_MS } from "../src/handleErr.js";
import { runSchedulerTick, getSchedulerHealth, markSchedulerRunning, SCHEDULER_STALE_MS } from "../src/scheduler.js";
import { prisma, resetDatabase, createUser, loginAs, api, trTime } from "./helpers.js";

const MIN = 60 * 1000;
const T0 = new Date("2026-10-05T07:00:00.000Z");
const lastMail = () => sendAlertEmail.mock.calls.at(-1)?.[0];
const subjects = () => sendAlertEmail.mock.calls.map(([m]) => m.subject);
// Sahte saat yalnız Date için: supertest/Prisma'nın gerçek zamanlayıcıları (setTimeout) çalışmaya devam eder.
const fakeNow = (d) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(d);
};

// Express'in yanıt nesnesinin handleErr'in kullandığı kadarı.
function fakeRes(route = { method: "GET", baseUrl: "/api/deneme", route: { path: "/:id" } }) {
  const res = { statusCode: 200, body: null, req: route };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
}

let studentToken;
beforeAll(async () => {
  await resetDatabase();
  const student = await createUser({ role: "STUDENT", name: "Test Öğrenci İzleme", username: "ogr-izleme", gradeLevel: 12 });
  studentToken = await loginAs(student);
});

beforeEach(() => {
  sendAlertEmail.mockReset();
  sendAlertEmail.mockImplementation(async () => true);
  _resetAlertsForTest();
  _reset500WindowForTest();
  vi.stubEnv("ALERT_EMAIL", "uyari@okul.test");
  vi.stubEnv("ADMIN_EMAIL", "yonetici@okul.test");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("alert(): hız sınırı ve alıcı", () => {
  it("ilk uyarı gider; 30 dakika içinde aynı tür bastırılır, başka tür ayrı sayılır", async () => {
    fakeNow(T0);
    expect(await alert("test:a", "birinci")).toBe(true);
    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
    expect(lastMail().to).toBe("uyari@okul.test");
    expect(lastMail().subject).toBe("[Koçluk uyarı] test:a");
    expect(lastMail().text).toContain("birinci");

    expect(await alert("test:a", "ikinci")).toBe(false);
    vi.setSystemTime(new Date(T0.getTime() + 29 * MIN));
    expect(await alert("test:a", "üçüncü")).toBe(false);
    expect(sendAlertEmail).toHaveBeenCalledTimes(1);

    expect(await alert("test:b", "başka tür")).toBe(true);
    expect(sendAlertEmail).toHaveBeenCalledTimes(2);
  });

  it("pencere dolunca yeniden gider ve bastırılanların sayısını söyler; sayaç sıfırlanır", async () => {
    fakeNow(T0);
    await alert("test:a", "birinci");
    await alert("test:a", "ikinci");
    await alert("test:a", "üçüncü");
    vi.setSystemTime(new Date(T0.getTime() + ALERT_RATE_WINDOW_MS + MIN));
    expect(await alert("test:a", "dördüncü")).toBe(true);
    expect(lastMail().subject).toBe("[Koçluk uyarı] test:a (+2)");
    expect(lastMail().text).toContain("son e-postadan beri 2 uyarı daha");
    expect(lastMail().text).toContain("dördüncü");
    vi.setSystemTime(new Date(T0.getTime() + 2 * ALERT_RATE_WINDOW_MS + 2 * MIN));
    await alert("test:a", "beşinci");
    expect(lastMail().subject).toBe("[Koçluk uyarı] test:a");
  });

  it("ALERT_EMAIL yoksa ADMIN_EMAIL'e; ikisi de yoksa yalnız loglanır", async () => {
    vi.stubEnv("ALERT_EMAIL", "");
    expect(await alert("test:alici", "x")).toBe(true);
    expect(lastMail().to).toBe("yonetici@okul.test");

    _resetAlertsForTest();
    vi.stubEnv("ADMIN_EMAIL", "");
    sendAlertEmail.mockClear();
    expect(await alert("test:alici", "y")).toBe(false);
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it("gönderim hatası fırlatmaz; gönderilemeyen uyarı bir sonraki e-postada sayılır", async () => {
    fakeNow(T0);
    sendAlertEmail.mockRejectedValueOnce(new Error("[Resend] application_error: ağ yok"));
    await expect(alert("test:c", "gitmeyecek")).resolves.toBe(false);
    vi.setSystemTime(new Date(T0.getTime() + ALERT_RATE_WINDOW_MS + MIN));
    expect(await alert("test:c", "gidecek")).toBe(true);
    expect(lastMail().subject).toBe("[Koçluk uyarı] test:c (+1)");
  });

  it("e-posta yapılandırılmamışsa gerçek mailer göndermez, false döner (testte RESEND_API_KEY boş)", async () => {
    const real = await vi.importActual("../src/mailer.js");
    await expect(real.sendAlertEmail({ to: "uyari@okul.test", subject: "s", text: "t" })).resolves.toBe(false);
  });

  it("gövdede kişisel veri yok: Prisma sorgu mesajı alınmaz, e-posta/telefon maskelenir, Error olmayan nesne yazılmaz", async () => {
    const prismaErr = new Prisma.PrismaClientValidationError(
      'Invalid `prisma.user.create()` invocation: { data: { name: "Test Öğrenci Gizli", email: "gizli@okul.test" } }',
      { clientVersion: "6.19.3" },
    );
    await alert("test:kvkk", "Kayıt oluşturulamadı", { error: prismaErr, studentId: "cm0ogrenci0001" });
    const { text } = lastMail();
    expect(text).toContain("PrismaClientValidationError");
    expect(text).toContain("studentId: cm0ogrenci0001");
    expect(text).not.toContain("Gizli");
    expect(text).not.toContain("gizli@okul.test");

    const plain = describeError(new Error("ogr.veli@okul.test ya da 0532 123 45 67 numarasına ulaşılamadı"));
    expect(plain).toContain("<e-posta>");
    expect(plain).not.toContain("ogr.veli@okul.test");
    expect(plain).not.toContain("123 45 67");

    expect(describeError({ name: "Test Öğrenci Nesne", score: 42 })).toBe("Error olmayan değer (object)");
    const known = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6.19.3", meta: { modelName: "User", target: ["email"] } });
    expect(describeError(known)).toMatch(/^PrismaClientKnownRequestError \[P2002\]\nmodel: User\nalan: email/);
  });
});

describe("beklenmeyen 500 sayacı (handleErr)", () => {
  it("4 tane uyarı üretmez, 5.'si üretir; eşiğin üstündekiler hız sınırına takılır", () => {
    for (let i = 0; i < 4; i++) handleErr(fakeRes(), new Error("beklenmeyen"));
    expect(sendAlertEmail).not.toHaveBeenCalled();
    const res = fakeRes();
    handleErr(res, new Error("beklenmeyen"));
    // İstemciye dönen yanıt değişmedi: genel mesaj, ham hata sızmaz.
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Sunucu hatası" });
    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
    expect(lastMail().subject).toBe("[Koçluk uyarı] http:500");
    expect(lastMail().text).toContain("Son 10 dakikada 5 beklenmeyen sunucu hatası");
    expect(lastMail().text).toContain("GET /api/deneme/:id → Error");
    handleErr(fakeRes(), new Error("beklenmeyen"));
    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
  });

  it("bilinçli 4xx/503 ve P2025 (404) sayılmaz", () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "6.19.3" });
    for (let i = 0; i < 10; i++) {
      handleErr(fakeRes(), Object.assign(new Error("Yetkin yok"), { status: 403 }));
      handleErr(fakeRes(), Object.assign(new Error("Yapılandırılmamış"), { status: 503 }));
      const r = fakeRes();
      handleErr(r, p2025);
      expect(r.statusCode).toBe(404);
    }
    expect(sendAlertEmail).not.toHaveBeenCalled();
    expect(recordUnexpected500(new Error("ilk gerçek 500"))).toBe(1);
  });

  it("pencere kayar: 10 dakikadan eski hatalar sayılmaz", () => {
    const t = T0.getTime();
    for (let i = 0; i < 4; i++) recordUnexpected500(new Error("eski"), "GET /api/x", t + i * 1000);
    expect(recordUnexpected500(new Error("yeni"), "GET /api/x", t + ERROR_WINDOW_MS + 5000)).toBe(1);
    expect(sendAlertEmail).not.toHaveBeenCalled();
    for (let i = 1; i < 4; i++) recordUnexpected500(new Error("yeni"), "GET /api/x", t + ERROR_WINDOW_MS + 5000 + i);
    expect(sendAlertEmail).not.toHaveBeenCalled();
    expect(recordUnexpected500(new Error("yeni"), "GET /api/x", t + ERROR_WINDOW_MS + 6000)).toBe(5);
    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
  });

  it("gerçek rota üzerinden: DB hatasıyla 5 kez 500 dönen uç uyarı üretir, rota kalıbı e-postada", async () => {
    vi.spyOn(prisma.notification, "findMany").mockRejectedValue(new Error("bağlantı koptu"));
    for (let i = 0; i < 5; i++) {
      const r = await api(studentToken).get("/api/notifications");
      expect(r.status).toBe(500);
      expect(r.body).toEqual({ error: "Sunucu hatası" });
    }
    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
    expect(lastMail().text).toContain("GET /api/notifications/ → Error");
    // Öğrencinin adı uyarıya girmez.
    expect(lastMail().text).not.toContain("Test Öğrenci İzleme");
  });
});

describe("/api/health", () => {
  it("DB ayakta: 200 {ok:true, db:true}, kimlik doğrulamasız; zamanlayıcı bu süreçte yoksa alanı da yok", async () => {
    const r = await api().get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, db: true });
    expect(r.headers["cache-control"]).toBe("no-store");
  });

  it("DB sorgusu reddedilirse 503 {ok:false, db:false}", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("Can't reach database server"));
    const r = await api().get("/api/health");
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ ok: false, db: false });
  });

  it("DB 2 saniyede yanıt vermezse 503 (asılı bağlantıyı beklemez)", async () => {
    vi.spyOn(prisma, "$queryRaw").mockImplementationOnce(() => new Promise(() => {}));
    const started = Date.now();
    const r = await api().get("/api/health");
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ ok: false, db: false });
    expect(Date.now() - started).toBeLessThan(5000);
  });

  // Bu dosyada henüz hiç zamanlayıcı turu çalışmadı: yeniden başlatmadan hemen sonraki durum (ilk tur sürüyor).
  it("zamanlayıcı başladı ama henüz tur bitmedi: yaş başlangıçtan sayılır, ilk 10 dakika yanlış alarm yok", async () => {
    const start = new Date();
    markSchedulerRunning(start);
    const r = await api().get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, db: true, scheduler: { ok: true, lastTickSecondsAgo: null, lastTickOk: null } });
    expect(getSchedulerHealth(new Date(start.getTime() + 9 * MIN)).stale).toBe(false);
    expect(getSchedulerHealth(new Date(start.getTime() + SCHEDULER_STALE_MS + MIN))).toMatchObject({ running: true, stale: true, lastTickAt: null });
  });
});

describe("zamanlayıcı: adım hatası uyarısı ve sağlık", () => {
  it("patlayan adım 'scheduler:<adım>' uyarısı üretir, diğer adımlar sürer, tur 'başarısız' kaydedilir", async () => {
    // publishDueAssignments'ın ilk sorgusu; aynı tabloyu sonra okuyan notifyTeachersOfOverdueAssignments etkilenmez.
    const spy = vi.spyOn(prisma.assignment, "findMany").mockRejectedValueOnce(new Error("geçici DB hatası"));
    const before = Date.now();
    await runSchedulerTick(trTime("2026-10-12", "10:00"));
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2); // sonraki adım da çalıştı
    expect(subjects()).toEqual(["[Koçluk uyarı] scheduler:publishDueAssignments"]);
    expect(lastMail().text).toContain("geçici DB hatası");
    const h = getSchedulerHealth();
    expect(h.lastTickOk).toBe(false);
    expect(h.failedSteps).toEqual(["publishDueAssignments"]);
    // Duvar saati — turun sahte `now`'ı değil.
    expect(h.lastTickAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(h.stale).toBe(false);
  });

  it("sonraki sorunsuz tur (sessiz saatteki erken dönüş dahil) 'başarılı' kaydedilir", async () => {
    await runSchedulerTick(trTime("2026-10-12", "10:01"));
    expect(getSchedulerHealth()).toMatchObject({ lastTickOk: true, failedSteps: [] });
    const quietBefore = getSchedulerHealth().lastTickAt.getTime();
    await runSchedulerTick(trTime("2026-10-12", "23:30"));
    const h = getSchedulerHealth();
    expect(h.lastTickOk).toBe(true);
    expect(h.lastTickAt.getTime()).toBeGreaterThanOrEqual(quietBefore);
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it("bu süreçte çalışıyorsa /api/health son tur yaşını verir; 10 dakikayı geçince 503", async () => {
    markSchedulerRunning();
    await runSchedulerTick(trTime("2026-10-12", "10:02"));
    let r = await api().get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.db).toBe(true);
    expect(r.body.scheduler).toMatchObject({ ok: true, lastTickOk: true });
    expect(r.body.scheduler.lastTickSecondsAgo).toBeLessThan(5);

    fakeNow(new Date(Date.now() + SCHEDULER_STALE_MS + MIN));
    expect(getSchedulerHealth().stale).toBe(true);
    r = await api().get("/api/health");
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ ok: false, db: true, scheduler: { ok: false } });
    expect(r.body.scheduler.lastTickSecondsAgo).toBeGreaterThanOrEqual(SCHEDULER_STALE_MS / 1000);
  });
});
