// Aralıklı tekrar hatırlatması (reviewReminders.js), runSchedulerTick(sahteAn) ile:
//  • net oranı < %55 (Q ≥ 10) kalan konu, taban kaydın TR gününden 7 ve 21 gün sonra, 17:00'den (TR) sonra BİR KEZ,
//  • aynı konuda sonraki her kayıt (sonucu ne olursa olsun; aynı gün daha geç girilen dahil) hatırlatmayı iptal eder,
//    sonraki kayıt da düşükse yeni döngü başlar (günlük satırı devralınır); ödev sonucunun serbest kopyası iptal etmez,
//  • öğrenci başına günde tek bildirim, en çok 3 konu (en uzun bekleyen, sonra en düşük oran önce), kalanlar ertesi gün;
//    6 günlük telafi penceresi, sonra düşer,
//  • yalnız askıda olmayan 11/12. sınıf öğrencileri; süreç yeniden başlasa da aynı gün ikinci bildirim yok.
// Veriler kurgusaldır. Push kapalı (test/env.js) — yalnız Notification satırları yazılır.
import { describe, it, expect, beforeAll } from "vitest";
import { runSchedulerTick } from "../src/scheduler.js";
import {
  normalizeTopic, reviewKey, isReviewCandidate, fmtPct, reviewReminderText, dueReviewTopics, resetReviewReminderPass,
} from "../src/reviewReminders.js";
import { buildPushMessage, pushTitle } from "../src/notify.js";
import {
  prisma, resetDatabase, createUser, createAssignment, recipientOf, submitResult, createSession, day, trTime,
} from "./helpers.js";

// Taban gün: 5 Ekim 2026 (Pazartesi). 7. gün 12 Ekim, 21. gün 26 Ekim.
const D0 = "2026-10-05";
const BANNED_WORDS = /zayıf|kötü|başarısız|geride|tembel|hile/i;

let coach, sA, sB, sC, sD, sE, sF, banned, grade10, noGrade;
const reminders = () => prisma.notification.findMany({ where: { type: "review_reminder" }, orderBy: { createdAt: "asc" } });
const textsOf = async (user) => (await reminders()).filter((n) => n.userId === user.id).map((n) => n.text);
const recipientsOf = async () => [...new Set((await reminders()).map((n) => n.userId))].sort();

// Serbest çalışma, giriş anı (createdAt) istenen anda — aynı günün kayıtları giriş sırasıyla ayrışır.
async function session(student, { enteredAt, ...fields }) {
  const s = await createSession(student, fields);
  return enteredAt ? prisma.studySession.update({ where: { id: s.id }, data: { createdAt: enteredAt } }) : s;
}

beforeAll(async () => {
  await resetDatabase();
  coach = await createUser({ role: "TEACHER", name: "Test Koç", email: "koc@okul.test", username: null });
  const student = (name, username, extra = {}) => createUser({ role: "STUDENT", name, username, gradeLevel: 12, teacherId: coach.id, ...extra });
  sA = await student("Test Öğrenci A", "ogr-a");
  sB = await student("Test Öğrenci B", "ogr-b", { gradeLevel: 11 });
  sC = await student("Test Öğrenci C", "ogr-c", { gradeLevel: 11 });
  sD = await student("Test Öğrenci D", "ogr-d");
  sE = await student("Test Öğrenci E", "ogr-e");
  sF = await student("Test Öğrenci F", "ogr-f");
  banned = await student("Test Öğrenci Askıda", "ogr-askida", { banned: true });
  grade10 = await student("Test Öğrenci Onuncu", "ogr-onuncu", { gradeLevel: 10 });
  noGrade = await student("Test Öğrenci Sınıfsız", "ogr-sinifsiz", { gradeLevel: null });

  // sA — ödev sonucu: 15/6/9 → net 13,5 / 30 = %45. Aynı gün aynı ders/D-Y-B'li serbest kopyası (eski istemci) konuya
  // dönüş sayılmaz.
  const hw = await createAssignment({ teacher: coach, students: [sA], subject: "Matematik", topic: "Mutlak Değer", questionCount: 30, scheduledDate: D0, endDate: D0 });
  await submitResult(recipientOf(hw, sA), { correct: 15, wrong: 6, blank: 9, completedAt: trTime(D0, "20:00") });
  await session(sA, { subject: "Matematik", topic: "Mutlak Değer", correct: 15, wrong: 6, blank: 9, studyDate: day(D0) });

  // sB — düşük kayıt, 3 gün sonra aynı konuda (büyük/küçük harf ve boşluk farkıyla) 3 soruluk yeni kayıt → iptal.
  await session(sB, { subject: "Fizik", topic: "Vektörler", correct: 4, wrong: 8, blank: 3, studyDate: day(D0) });
  await session(sB, { subject: "Fizik", topic: "  VEKTÖRLER ", correct: 3, studyDate: day("2026-10-08") });

  // sC — AYT Kimya: 5/8/7 → net 3 / 20 = %15. (9. gün yeni bir düşük kayıt testte eklenir → yeni döngü.)
  await session(sC, { examType: "AYT", subject: "Kimya", topic: "Mol Kavramı", correct: 5, wrong: 8, blank: 7, studyDate: day(D0) });

  // sD — beş düşük konu (oranlar: Coğrafya −%20, Biyoloji %10, Kimya %30, Türkçe %45, Tarih %50) + eşiğin tam üstü
  // (%55, düşük sayılmaz) + az soruluk (Q = 9) kayıt.
  const low = [["Türkçe", "Paragraf", 5, 2, 3], ["Kimya", "Maddenin Halleri", 4, 4, 2], ["Biyoloji", "Hücre", 2, 4, 4], ["Tarih", "Osmanlı Kuruluş", 5, 0, 5], ["Coğrafya", "İklim", 0, 8, 2]];
  for (const [subject, topic, correct, wrong, blank] of low) await session(sD, { subject, topic, correct, wrong, blank, studyDate: day(D0) });
  await session(sD, { subject: "Fizik", topic: "Hareket", correct: 11, wrong: 0, blank: 9, studyDate: day(D0) });
  await session(sD, { subject: "Matematik", topic: "Üslü Sayılar", correct: 1, wrong: 5, blank: 3, studyDate: day(D0) });

  // sE — aynı gün iki kayıt: "Fonksiyonlar" önce düşük sonra iyi (iptal), "Olasılık" önce iyi sonra düşük (hatırlatılır).
  await session(sE, { subject: "Matematik", topic: "Fonksiyonlar", correct: 3, wrong: 6, blank: 3, studyDate: day(D0), enteredAt: trTime(D0, "18:00") });
  await session(sE, { subject: "Matematik", topic: "Fonksiyonlar", correct: 11, wrong: 1, blank: 0, studyDate: day(D0), enteredAt: trTime(D0, "20:00") });
  await session(sE, { subject: "Matematik", topic: "Olasılık", correct: 10, wrong: 1, blank: 1, studyDate: day(D0), enteredAt: trTime(D0, "18:30") });
  await session(sE, { subject: "Matematik", topic: "Olasılık", correct: 2, wrong: 6, blank: 4, studyDate: day(D0), enteredAt: trTime(D0, "20:30") });

  // sF — 28 Eylül'de düşük kayıt (6/4/10 → %25): 7. aşamanın penceresi (5–11 Ekim) ilk turdan önce kapanmış; 21. aşama
  // 19–25 Ekim'de yetişir.
  await session(sF, { subject: "Fizik", topic: "Kuvvet", correct: 6, wrong: 4, blank: 10, studyDate: day("2026-09-28") });

  // Hatırlatma ALMAMASI gerekenler: askıdaki, 10. sınıf ve sınıfı girilmemiş öğrenci (hepsinin düşük kaydı var).
  for (const s of [banned, grade10, noGrade]) await session(s, { subject: "Matematik", topic: "Mutlak Değer", correct: 2, wrong: 8, blank: 10, studyDate: day(D0) });
});

describe("saf yardımcılar", () => {
  it("konu anahtarı: tr-TR küçük harf, boşluklar sadeleşir", () => {
    expect(normalizeTopic("  Mutlak   DEĞER ")).toBe("mutlak değer");
    expect(normalizeTopic("IŞIK")).toBe("ışık");
    expect(normalizeTopic("İyon")).toBe("iyon");
    expect(reviewKey("TYT", "Fizik", " VEKTÖRLER")).toBe(reviewKey("TYT", "Fizik", "vektörler"));
    expect(reviewKey("TYT", "Fizik", "Vektörler")).not.toBe(reviewKey("AYT", "Fizik", "Vektörler"));
    expect(reviewKey("TYT", "Fizik", "x".repeat(500))).toHaveLength("TYT|Fizik|".length + 200);
  });

  it("aday: Q ≥ 10 ve net oranı < %55 (tam %55 değil)", () => {
    expect(isReviewCandidate({ D: 11, Y: 0, B: 9 })).toBe(false); // tam %55
    expect(isReviewCandidate({ D: 10, Y: 0, B: 9 })).toBe(true); // %52,6
    expect(isReviewCandidate({ D: 1, Y: 5, B: 3 })).toBe(false); // Q = 9
    expect(isReviewCandidate({ D: 0, Y: 10, B: 0 })).toBe(true); // eksi net
  });

  it("biçim: yüzde önde, eksi işareti; uzun konu kısaltılır", () => {
    expect(fmtPct(45)).toBe("%45");
    expect(fmtPct(-20)).toBe("−%20");
    const long = "Çok uzun bir konu adı ".repeat(5).trim();
    const text = reviewReminderText([{ examType: "TYT", subject: "Türkçe", topic: long, daysAgo: 7, rate: 0.4 }]);
    expect(text).toMatch(/^Tekrar zamanı: TYT Türkçe — '.{59}…' \(7 gün önce net oranı %40\)\. 15 soruluk kısa bir dönüş bilgini tazeler\.$/u);
  });

  it("ileri tarihli kayıt henüz yok sayılır", () => {
    const rec = (dayNo, D, Y, B, at = 0) => ({ examType: "TYT", subject: "Fizik", topic: "Kuvvet", day: dayNo, at, D, Y, B, free: true });
    // 100. gün düşük, 110. gün (bugünden ileri) iyi → 107. günde 7. aşama yine vakti gelmiş sayılır.
    expect(dueReviewTopics([rec(100, 2, 6, 4), rec(110, 12, 0, 0)], 107)).toMatchObject([{ stage: 7, baseDay: 100, daysAgo: 7 }]);
    expect(dueReviewTopics([rec(100, 2, 6, 4), rec(105, 12, 0, 0)], 107)).toEqual([]);
  });
});

describe("tekrar hatırlatması (zamanlayıcı)", () => {
  it("7. gün 16:59'da (TR) gönderilmez", async () => {
    await runSchedulerTick(trTime("2026-10-12", "16:59"));
    expect(await reminders()).toHaveLength(0);
    expect(await prisma.reviewReminderLog.count()).toBe(0);
  });

  it("7. gün 17:00: vakti gelen konular, öğrenci başına tek bildirim, en çok 3 konu", async () => {
    await runSchedulerTick(trTime("2026-10-12", "17:00"));
    expect(await recipientsOf()).toEqual([sA.id, sC.id, sD.id, sE.id].sort());

    expect(await textsOf(sA)).toEqual(["Tekrar zamanı: TYT Matematik — 'Mutlak Değer' (7 gün önce net oranı %45). 15 soruluk kısa bir dönüş bilgini tazeler."]);
    expect(await textsOf(sC)).toEqual(["Tekrar zamanı: AYT Kimya — 'Mol Kavramı' (7 gün önce net oranı %15). 15 soruluk kısa bir dönüş bilgini tazeler."]);
    expect(await textsOf(sE)).toEqual(["Tekrar zamanı: TYT Matematik — 'Olasılık' (7 gün önce net oranı %4). 15 soruluk kısa bir dönüş bilgini tazeler."]);
    // En düşük üç oran; eşiğin tam üstündeki Fizik ve az soruluk Matematik yok.
    expect(await textsOf(sD)).toEqual([
      "Tekrar zamanı: TYT Coğrafya — 'İklim' (7 gün önce net oranı −%20) · TYT Biyoloji — 'Hücre' (7 gün önce net oranı %10) · TYT Kimya — 'Maddenin Halleri' (7 gün önce net oranı %30). Her birine 15 soruluk kısa bir dönüş bilgini tazeler.",
    ]);

    const list = await reminders();
    const nA = list.find((n) => n.userId === sA.id);
    expect(nA.data).toEqual({ screen: "studyLog", prefill: { examType: "TYT", subject: "Matematik", topic: "Mutlak Değer" } });
    expect(nA.pushPending).toBe(false);
    // Bildirime dokununca ilk konu (en düşük oran) açılır.
    expect(list.find((n) => n.userId === sD.id).data.prefill).toEqual({ examType: "TYT", subject: "Coğrafya", topic: "İklim" });
    for (const n of list) {
      expect(n.text).not.toMatch(BANNED_WORDS);
      for (const s of [sA, sB, sC, sD, sE, sF]) expect(n.text).not.toContain(s.name);
    }
    expect(list.some((n) => n.userId === coach.id)).toBe(false);

    const logs = await prisma.reviewReminderLog.findMany({ where: { studentId: sD.id }, orderBy: { key: "asc" } });
    expect(logs.map((l) => [l.key, l.stage, l.baseDate.toISOString()])).toEqual([
      ["TYT|Biyoloji|hücre", 7, day(D0).toISOString()],
      ["TYT|Coğrafya|iklim", 7, day(D0).toISOString()],
      ["TYT|Kimya|maddenin halleri", 7, day(D0).toISOString()],
    ]);
  });

  it("push verisinde prefill JSON metni, başlık 'Konu tekrarı'", async () => {
    const n = (await reminders()).find((x) => x.userId === sA.id);
    const msg = buildPushMessage("tok", { title: pushTitle(n.type, n.data), body: n.text, data: n.data }, 1);
    expect(msg.notification.title).toBe("Konu tekrarı");
    expect(msg.data.screen).toBe("studyLog");
    expect(JSON.parse(msg.data.prefill)).toEqual({ examType: "TYT", subject: "Matematik", topic: "Mutlak Değer" });
  });

  it("aynı gün ikinci tur ve yeniden başlatma: ikinci bildirim yok (günlük sınır tablodan)", async () => {
    await runSchedulerTick(trTime("2026-10-12", "18:00"));
    resetReviewReminderPass(); // süreç yeniden başlamış gibi
    await runSchedulerTick(trTime("2026-10-12", "19:00"));
    expect(await reminders()).toHaveLength(4);
    expect(await prisma.reviewReminderLog.count()).toBe(6);
  });

  it("ertesi gün: günlük sınıra takılan konular (gerçek gün farkıyla); gönderilenler tekrar gitmez", async () => {
    await runSchedulerTick(trTime("2026-10-13", "17:30"));
    expect(await reminders()).toHaveLength(5);
    expect((await textsOf(sD))[1]).toBe(
      "Tekrar zamanı: TYT Türkçe — 'Paragraf' (8 gün önce net oranı %45) · TYT Tarih — 'Osmanlı Kuruluş' (8 gün önce net oranı %50). Her birine 15 soruluk kısa bir dönüş bilgini tazeler.",
    );
  });

  it("sonraki düşük kayıt yeni döngü başlatır (satır devralınır); telafi penceresi içinde geç aşama yetişir", async () => {
    // sC 14 Ekim'de aynı konuya döndü ama yine düşük: 8/4/8 → net 7 / 20 = %35.
    await session(sC, { examType: "AYT", subject: "Kimya", topic: "mol kavramı", correct: 8, wrong: 4, blank: 8, studyDate: day("2026-10-14") });
    // 20 Ekim: sC'nin yeni döngüsü henüz 6. gününde. sF'nin 21. aşaması (pencere 19–25 Ekim) gerçek gün farkıyla yetişir.
    await runSchedulerTick(trTime("2026-10-20", "17:00"));
    expect(await textsOf(sC)).toHaveLength(1);
    expect(await textsOf(sF)).toEqual(["Tekrar zamanı: TYT Fizik — 'Kuvvet' (22 gün önce net oranı %25). 15 soruluk kısa bir dönüş bilgini tazeler."]);
    await runSchedulerTick(trTime("2026-10-21", "17:00"));
    expect(await textsOf(sC)).toEqual([
      "Tekrar zamanı: AYT Kimya — 'Mol Kavramı' (7 gün önce net oranı %15). 15 soruluk kısa bir dönüş bilgini tazeler.",
      "Tekrar zamanı: AYT Kimya — 'mol kavramı' (7 gün önce net oranı %35). 15 soruluk kısa bir dönüş bilgini tazeler.",
    ]);
    const logs = await prisma.reviewReminderLog.findMany({ where: { studentId: sC.id } });
    expect(logs.map((l) => [l.stage, l.baseDate.toISOString()])).toEqual([[7, day("2026-10-14").toISOString()]]);
    expect(await reminders()).toHaveLength(7);
  });

  it("21. gün: yalnız hâlâ geçerli döngüler; iptal edilenler ve yeni döngüsü başlayan eski taban gönderilmez", async () => {
    await runSchedulerTick(trTime("2026-10-26", "17:00"));
    expect(await textsOf(sA)).toEqual([
      "Tekrar zamanı: TYT Matematik — 'Mutlak Değer' (7 gün önce net oranı %45). 15 soruluk kısa bir dönüş bilgini tazeler.",
      "Tekrar zamanı: TYT Matematik — 'Mutlak Değer' (21 gün önce net oranı %45). 15 soruluk kısa bir dönüş bilgini tazeler.",
    ]);
    expect((await textsOf(sD))[2]).toBe(
      "Tekrar zamanı: TYT Coğrafya — 'İklim' (21 gün önce net oranı −%20) · TYT Biyoloji — 'Hücre' (21 gün önce net oranı %10) · TYT Kimya — 'Maddenin Halleri' (21 gün önce net oranı %30). Her birine 15 soruluk kısa bir dönüş bilgini tazeler.",
    );
    expect(await textsOf(sE)).toHaveLength(2);
    expect(await textsOf(sC)).toHaveLength(2); // 5 Ekim tabanının 21. günü yok (14 Ekim'de konuya dönüldü)
    expect(await textsOf(sB)).toEqual([]);
    expect(await textsOf(sF)).toHaveLength(1); // 21. aşaması 20 Ekim'de gitti
    expect(await reminders()).toHaveLength(10);
  });

  it("21. aşamanın kalanları ertesi gün; sonra pencere kapanır, yeni döngünün 21. günü kendi gününde", async () => {
    await runSchedulerTick(trTime("2026-10-27", "17:00"));
    expect(await textsOf(sD)).toHaveLength(4);
    expect((await textsOf(sD))[3]).toMatch(/^Tekrar zamanı: TYT Türkçe — 'Paragraf' \(22 gün önce net oranı %45\) · TYT Tarih/);
    const before = (await reminders()).length;
    await runSchedulerTick(trTime("2026-11-03", "17:00"));
    expect(await reminders()).toHaveLength(before);
    await runSchedulerTick(trTime("2026-11-04", "17:00"));
    expect((await reminders()).length).toBe(before + 1);
    expect((await textsOf(sC))[2]).toBe("Tekrar zamanı: AYT Kimya — 'mol kavramı' (21 gün önce net oranı %35). 15 soruluk kısa bir dönüş bilgini tazeler.");
  });
});
