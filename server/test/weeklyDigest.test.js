// Haftalık özet bildirimleri (weeklyDigest.js), runSchedulerTick(sahteAn) ile:
//  • öğrenci: Pazar 19:00'dan (TR) sonra, ISO hafta başına BİR KEZ; ödevi ve kaydı olmayan / askıdaki öğrenciye gitmez;
//    sayılar (x/y ödev, aktif gün, soru, seri) istemcinin raporuyla (src/reportModel.js) aynı,
//  • koç: Pazartesi 08:00'den sonra BİR KEZ, yalnızca KENDİ (askıda olmayan) öğrencilerinin sayıları, ad yok;
//    Pazartesi kaçarsa Çarşamba'ya kadar yetişir, sonra gönderilmez,
//  • yarıda kalan tur 15 dakika sonra devralınır, özetini almış kullanıcıya ikinci kez gitmez.
// Veriler kurgusaldır. Push kapalı (test/env.js) — yalnız Notification satırları yazılır.
import { describe, it, expect, beforeAll } from "vitest";
import { runSchedulerTick } from "../src/scheduler.js";
import { studentDigestText, coachDigestText, isoWeekKey } from "../src/weeklyDigest.js";
import { buildReport } from "../../src/reportModel.js";
import {
  prisma, resetDatabase, createUser, createAssignment, recipientOf, submitResult, skipRecipient, createSession, loginAs, api,
  day, trTime,
} from "./helpers.js";

// Özetlenen hafta: 12–18 Ekim 2026 (Pzt–Paz) = 2026-W42. Koç özeti 19 Ekim Pazartesi.
const W42 = "2026-W42";
const W43 = "2026-W43";
const SUNDAY_EVENING = trTime("2026-10-18", "19:00");

let coachA, coachB, coachC, branch;
let s1, s2, s3, s4, s5, s6;
const digests = (type = "weekly_digest", week) => prisma.notification.findMany({
  where: { type, ...(week ? { data: { path: ["week"], equals: week } } : {}) },
  orderBy: { createdAt: "asc" },
});
const textOf = async (user, type = "weekly_digest", week = W42) => (await digests(type, week)).filter((n) => n.userId === user.id).map((n) => n.text);

beforeAll(async () => {
  await resetDatabase();
  // Hesaplar Eylül başında açılmış (hesabı 7 günden yeni öğrenci "kayıt girmedi" sayılmaz; sabit tarih → gerçek saatten
  // bağımsız).
  const created = "2026-09-01";
  coachA = await createUser({ role: "TEACHER", name: "Test Koç A", email: "koc.a@okul.test", username: null, createdAt: created });
  coachB = await createUser({ role: "TEACHER", name: "Test Koç B", email: "koc.b@okul.test", username: null, createdAt: created });
  // Yalnızca askıdaki öğrencisi olan koç ve öğrencisi olmayan branş öğretmeni özet almaz.
  coachC = await createUser({ role: "TEACHER", name: "Test Koç C", email: "koc.c@okul.test", username: null, createdAt: created });
  branch = await createUser({ role: "TEACHER", name: "Test Branş", email: "brans@okul.test", username: null, isSubjectTeacher: true, teachingSubjects: ["Matematik"], createdAt: created });
  const student = (name, username, teacher, extra = {}) => createUser({ role: "STUDENT", name, username, gradeLevel: 12, teacherId: teacher.id, createdAt: created, ...extra });
  s1 = await student("Test Öğrenci Bir", "ogr-bir", coachA);
  s2 = await student("Test Öğrenci İki", "ogr-iki", coachA);
  s3 = await student("Test Öğrenci Üç", "ogr-uc", coachA);
  s4 = await student("Test Öğrenci Dört", "ogr-dort", coachB);
  s5 = await student("Test Öğrenci Beş", "ogr-bes", coachB, { banned: true });
  s6 = await student("Test Öğrenci Altı", "ogr-alti", coachB);
  await student("Test Öğrenci Askıda", "ogr-askida", coachC, { banned: true });

  const hw = (teacher, st, subject, due, extra = {}) => createAssignment({ teacher, students: [st], subject, questionCount: 30, scheduledDate: due, endDate: due, ...extra });

  // s1 — iki önceki hafta seri (≥ 3 aktif gün, sessiz ödev yok), bu hafta 5 ödev: 3 teslim + 1 pas + 1 sessiz → 4/5;
  // 3 aktif gün; 3 × 30 + 90 = 180 soru. Ödevin kopyası olan serbest kayıt (aynı gün/ders/D-Y-B) iki kez sayılmaz.
  for (const d of ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-05", "2026-10-06", "2026-10-07"]) {
    await createSession(s1, { subject: "Türkçe", correct: 8, wrong: 1, blank: 1, studyDate: trTime(d, "17:00") });
  }
  const days = ["2026-10-12", "2026-10-13", "2026-10-14"];
  for (const d of days) {
    const a = await hw(coachA, s1, "Matematik", d);
    await submitResult(recipientOf(a, s1), { correct: 20, wrong: 5, blank: 5, completedAt: trTime(d, "20:00") });
  }
  await createSession(s1, { subject: "Matematik", correct: 20, wrong: 5, blank: 5, studyDate: trTime("2026-10-12", "20:05") }); // kopya
  await createSession(s1, { subject: "Fizik", correct: 60, wrong: 20, blank: 10, studyDate: trTime("2026-10-14", "21:00") });
  const skipped = await hw(coachA, s1, "Kimya", "2026-10-15");
  await skipRecipient(recipientOf(skipped, s1), { reason: "ZAMAN", at: trTime("2026-10-15", "18:00") });
  await hw(coachA, s1, "Biyoloji", "2026-10-16"); // sessiz
  await hw(coachA, s1, "Tarih", "2026-10-19"); // gelecek hafta (Pazartesi) — bu haftanın sayısına girmez

  // s2 — bu hafta ne ödev ne kayıt: özet gitmez (koç özetinde "7 gündür kayıt yok").
  // s3 — tek ödevi sessiz, kaydı yok.
  await hw(coachA, s3, "Matematik", "2026-10-15");

  // s4 (Koç B) — iki ödevi de teslim.
  for (const d of ["2026-10-15", "2026-10-16"]) {
    const a = await hw(coachB, s4, "Türkçe", d);
    await submitResult(recipientOf(a, s4), { correct: 25, wrong: 3, blank: 2, completedAt: trTime(d, "19:00") });
  }
  // s5 (askıda) — özet almaz, Koç B'nin sayılarına girmez.
  await hw(coachB, s5, "Türkçe", "2026-10-15");
  await createSession(s5, { correct: 10, studyDate: trTime("2026-10-14", "16:00") });
  // s6 — yalnızca serbest çalışma; Pazartesi bitişli açık ödevi var.
  await createSession(s6, { subject: "Geometri", correct: 30, wrong: 8, blank: 2, studyDate: trTime("2026-10-17", "15:00") });
  await hw(coachB, s6, "Geometri", "2026-10-19");
});

describe("öğrenci haftalık özeti", () => {
  it("hafta anahtarı ISO (Perşembe kuralı)", () => {
    expect(isoWeekKey(day("2026-10-12"))).toBe(W42);
    expect(isoWeekKey(day("2026-12-28"))).toBe("2026-W53");
    expect(isoWeekKey(day("2027-01-04"))).toBe("2027-W01");
  });

  it("Cumartesi ve Pazar 18:59 erken", async () => {
    await runSchedulerTick(trTime("2026-10-17", "20:00"));
    await runSchedulerTick(trTime("2026-10-18", "18:59"));
    expect(await digests()).toHaveLength(0);
    expect(await prisma.weeklyDigestRun.count()).toBe(0);
  });

  it("Pazar 19:00: doğru sayılarla, yalnızca ödevi ya da kaydı olan (askıda olmayan) öğrencilere", async () => {
    await runSchedulerTick(SUNDAY_EVENING);
    const list = await digests("weekly_digest", W42);
    expect(list.map((n) => n.userId).sort()).toEqual([s1.id, s3.id, s4.id, s6.id].sort());
    expect(await textOf(s1)).toEqual(["Bu hafta: 4/5 ödev · 3 gün çalıştın · 180 soru. 2 haftadır serin sürüyor!"]);
    expect(await textOf(s3)).toEqual(["Bu hafta: 0/1 ödev · henüz kayıt yok. Açık kalan 1 ödevin sonucunu girerek haftayı kapatabilirsin."]);
    expect(await textOf(s4)).toEqual(["Bu hafta: 2/2 ödev · 2 gün çalıştın · 60 soru. Haftanın bütün ödevlerini kapattın!"]);
    expect(await textOf(s6)).toEqual(["Bu hafta: 1 gün çalıştın · 40 soru. Pazartesi için 1 açık ödevin var."]);
    const n = list.find((x) => x.userId === s1.id);
    expect(n.data).toEqual({ screen: "reports", week: W42 });
    expect(n.pushPending).toBe(false);
    const run = await prisma.weeklyDigestRun.findUnique({ where: { week_kind: { week: W42, kind: "student" } } });
    expect(run.completedAt).toBeInstanceOf(Date);
  });

  it("sayılar öğrencinin Gelişim ekranındaki modelle aynı (BU HAFTA kartı ve seri)", async () => {
    const r = await api(await loginAs(s1)).get("/api/stats/full-report");
    expect(r.status).toBe(200);
    const m = buildReport(r.body, { now: SUNDAY_EVENING });
    expect({ handled: m.week.handled, total: m.week.items.length, Q: m.week.Q, activeDays: m.week.activeDays, streak: m.discipline.streak })
      .toEqual({ handled: 4, total: 5, Q: 180, activeDays: 3, streak: 2 });
  });

  it("aynı hafta ikinci kez gönderilmez; Pazartesi öğrenci özeti yok", async () => {
    await runSchedulerTick(trTime("2026-10-18", "21:30"));
    await runSchedulerTick(trTime("2026-10-19", "07:30"));
    expect(await digests("weekly_digest")).toHaveLength(4);
  });
});

describe("koç haftalık özeti", () => {
  it("Pazartesi 07:59 erken", async () => {
    await runSchedulerTick(trTime("2026-10-19", "07:59"));
    expect(await digests("weekly_digest_coach")).toHaveLength(0);
    expect(await prisma.weeklyDigestRun.findUnique({ where: { week_kind: { week: W42, kind: "coach" } } })).toBeNull();
  });

  it("Pazartesi: yalnızca kendi öğrencilerinin sayıları, askıdaki öğrenci ve başka koçun öğrencisi girmez, ad yok", async () => {
    await runSchedulerTick(trTime("2026-10-19", "08:00"));
    const list = await digests("weekly_digest_coach", W42);
    expect(list.map((n) => n.userId).sort()).toEqual([coachA.id, coachB.id].sort());
    // Koç A: s1 (3 teslim, 1 pas, 1 sessiz) + s3 (1 sessiz) → 3/6; s2 ve s3'ün son 7 günde kaydı yok.
    expect(await textOf(coachA, "weekly_digest_coach")).toEqual(["Geçen hafta öğrencilerin: 3/6 ödev teslim · 1 pas · 2 sessiz ödev · 2 öğrenci en az 7 gündür kayıt girmedi."]);
    // Koç B: s4'ün 2 teslimi; askıdaki s5'in sessiz ödevi sayılmaz; s6'nın ödevi bu hafta (19 Ekim).
    expect(await textOf(coachB, "weekly_digest_coach")).toEqual(["Geçen hafta öğrencilerin: 2/2 ödev teslim · sessiz ödev yok."]);
    for (const n of list) {
      expect(n.data).toEqual({ screen: "students", week: W42 });
      for (const s of [s1, s2, s3, s4, s5, s6]) expect(n.text).not.toContain(s.name);
    }
    expect(await textOf(coachC, "weekly_digest_coach")).toEqual([]);
    expect(await textOf(branch, "weekly_digest_coach")).toEqual([]);
  });

  it("aynı hafta ikinci kez gönderilmez", async () => {
    await runSchedulerTick(trTime("2026-10-19", "10:00"));
    await runSchedulerTick(trTime("2026-10-20", "10:00"));
    expect(await digests("weekly_digest_coach", W42)).toHaveLength(2);
  });

  it("Pazartesi kaçarsa Salı yetişir (08:00'den sonra); Perşembe artık gönderilmez", async () => {
    await runSchedulerTick(trTime("2026-10-27", "07:30"));
    expect(await digests("weekly_digest_coach", W43)).toHaveLength(0);
    await runSchedulerTick(trTime("2026-10-27", "08:10"));
    expect((await digests("weekly_digest_coach", W43)).length).toBeGreaterThan(0);
    await runSchedulerTick(trTime("2026-11-05", "10:00")); // W44'ün koç özeti Perşembe
    expect(await digests("weekly_digest_coach", "2026-W44")).toHaveLength(0);
    expect(await prisma.weeklyDigestRun.findUnique({ where: { week_kind: { week: "2026-W44", kind: "coach" } } })).toBeNull();
  });
});

describe("yarıda kalmış öğrenci turu", () => {
  const W45 = "2026-W45";
  beforeAll(async () => {
    // 2–8 Kasım haftası: s4 ve s6 kayıt girmiş. Tur 19:00'da başlamış, yalnız s4'e ulaşmış ve süreç çökmüş.
    await createSession(s4, { correct: 10, studyDate: trTime("2026-11-03", "18:00") });
    await createSession(s6, { correct: 12, studyDate: trTime("2026-11-04", "18:00") });
    await prisma.notification.create({ data: { userId: s4.id, text: "önceki turdan", type: "weekly_digest", data: { screen: "reports", week: W45 } } });
    await prisma.weeklyDigestRun.create({ data: { week: W45, kind: "student", sentAt: trTime("2026-11-08", "19:00") } });
  });

  it("15 dakikadan yeni tur devralınmaz", async () => {
    await runSchedulerTick(trTime("2026-11-08", "19:05"));
    expect(await digests("weekly_digest", W45)).toHaveLength(1);
  });

  it("30 dakika sonra devralınır: eksik öğrenciye gider, aynı öğrenciye ikinci özet gitmez", async () => {
    await runSchedulerTick(trTime("2026-11-08", "19:30"));
    const list = await digests("weekly_digest", W45);
    expect(list.map((n) => n.userId).sort()).toEqual([s4.id, s6.id].sort());
    expect(await textOf(s6, "weekly_digest", W45)).toEqual(["Bu hafta: 1 gün çalıştın · 12 soru. Yeni haftaya 20 soruluk bir setle başlayabilirsin."]);
    const run = await prisma.weeklyDigestRun.findUnique({ where: { week_kind: { week: W45, kind: "student" } } });
    expect(run.completedAt).toBeInstanceOf(Date);
  });
});

describe("bildirim metinleri", () => {
  it("binlik nokta, sayıya ek yok, olumsuz kelime yok", () => {
    const base = { total: 0, handled: 0, open: 0, activeDays: 4, Q: 1250, prevQ: 900, streak: 0, nextMonOpen: 0, nextWeekOpen: 0 };
    expect(studentDigestText(base)).toBe("Bu hafta: 4 gün çalıştın · 1.250 soru. Geçen haftadan 350 soru fazla!");
    expect(studentDigestText({ ...base, prevQ: 1240, nextWeekOpen: 2 })).toBe("Bu hafta: 4 gün çalıştın · 1.250 soru. Yeni haftada 2 ödevin seni bekliyor.");
    expect(studentDigestText({ ...base, activeDays: 0, Q: 0 })).toBeNull();
    expect(studentDigestText({ ...base, total: 1, handled: 1 })).toMatch(/Haftanın ödevini kapattın!$/);
    expect(coachDigestText({ students: 3, total: 0, completed: 0, skipped: 0, silent: 0, inactive: 1 })).toBe("Geçen hafta öğrencilerin: vadesi gelen ödev yok · 1 öğrenci en az 7 gündür kayıt girmedi.");
    expect(coachDigestText({ students: 3, total: 0, completed: 0, skipped: 0, silent: 0, inactive: 0 })).toBeNull();
    const all = [studentDigestText({ ...base, total: 3, handled: 0, open: 3, activeDays: 0, Q: 0 }), coachDigestText({ students: 2, total: 4, completed: 1, skipped: 1, silent: 2, inactive: 2 })];
    for (const t of all) expect(t).not.toMatch(/zayıf|kötü|başarısız|geride|tembel|hile|çalışmadı/i);
  });
});
