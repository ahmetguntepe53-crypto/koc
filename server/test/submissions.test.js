// Ödev teslimi ve "pas geç" akışı (routes/assignmentRecipients.js):
//  • pas → teslim: pasın zamanı/sebebi priorSkippedAt/priorSkipReason olarak saklanır (rapor bunu gecikme değil
//    "pastan dönüş" sayar),
//  • teslim edilmiş sonucu düzenlemek teslim zamanını (completedAt) KAYDIRMAZ ve önceki pası silmez,
//  • pası geri alıp sonra teslim etmek de önceki pası saklar; doğrudan teslimde önceki pas yoktur,
//  • yetki ve doğrulama sınırları.
import { describe, it, expect, beforeAll } from "vitest";
import {
  prisma, resetDatabase, seedSchool, loginAll, api, createAssignment, recipientOf, submitResult,
} from "./helpers.js";

const RESULT = { correctCount: 10, wrongCount: 2, blankCount: 3 };
let w, S, t;
let recA, recB, recC, recDraft, recDone, recLegacy;
const row = (id) => prisma.assignmentRecipient.findUnique({ where: { id }, include: { submission: true } });

beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 3 });
  S = w.grade12[0];
  const mk = async (topic, extra = {}) => recipientOf(await createAssignment({
    teacher: w.coachA, students: [S], subject: "Matematik", topic, questionCount: 15, scheduledDate: "2026-09-21", endDate: "2026-09-25", ...extra,
  }), S);
  recA = await mk("Pas sonra teslim");
  recB = await mk("Pası geri al sonra teslim");
  recC = await mk("Doğrudan teslim");
  recDraft = await mk("Taslak", { status: "DRAFT" });
  recDone = await mk("Zaten teslim edilmiş");
  await submitResult(recDone, { correct: 12, wrong: 1, blank: 2, completedAt: "2026-09-22T12:00:00Z" });
  // Eski kayıt: tamamlanmış ama teslim zamanı boş (20260927090100_restore_completed_at öncesi).
  recLegacy = await mk("Eski kayıt");
  await submitResult(recLegacy, { correct: 5, wrong: 5, blank: 5 });
  await prisma.assignmentRecipient.update({ where: { id: recLegacy.id }, data: { completedAt: null } });
  t = await loginAll({ student: S, other: w.grade12[1], coach: w.coachA });
});

describe("pas → teslim", () => {
  let skippedAt;
  it("pas geçilir", async () => {
    const r = await api(t.student).post(`/api/assignment-recipients/${recA.id}/skip`, { reason: "ZAMAN" });
    expect(r.status).toBe(200);
    expect(r.body.recipient).toMatchObject({ skipReason: "ZAMAN", skipNote: null });
    skippedAt = (await row(recA.id)).skippedAt;
    expect(skippedAt).toBeInstanceOf(Date);
  });

  it("teslimde pas kalkar, önceki pas saklanır", async () => {
    const r = await api(t.student).post(`/api/assignment-recipients/${recA.id}/submit`, RESULT);
    expect(r.status).toBe(200);
    const x = await row(recA.id);
    expect(x).toMatchObject({ completed: true, skippedAt: null, skipReason: null, skipNote: null, priorSkipReason: "ZAMAN" });
    expect(x.priorSkippedAt.getTime()).toBe(skippedAt.getTime());
    expect(x.completedAt).toBeInstanceOf(Date);
  });

  it("sonucu düzenlemek teslim zamanını değiştirmez, önceki pası silmez", async () => {
    // Teslim anını geçmişe sabitle: düzenleme yeni bir "şimdi" yazsaydı fark hemen görünür (bekleme gerekmez).
    const fixed = new Date("2026-09-24T09:30:00Z");
    await prisma.assignmentRecipient.update({ where: { id: recA.id }, data: { completedAt: fixed } });
    const r = await api(t.student).patch(`/api/assignment-recipients/${recA.id}/submit`, { ...RESULT, correctCount: 11 });
    expect(r.status).toBe(200);
    const x = await row(recA.id);
    expect(x.completedAt.getTime()).toBe(fixed.getTime());
    expect(x.submission.correctCount).toBe(11);
    expect(x.priorSkipReason).toBe("ZAMAN");
  });

  it("sonucu girilmiş ödev pas geçilemez (409)", async () => {
    const r = await api(t.student).post(`/api/assignment-recipients/${recA.id}/skip`, { reason: "KONU" });
    expect(r.status).toBe(409);
  });
});

describe("pas → geri al → teslim", () => {
  it("geri alınan pas saklanır, ödev açık kalır", async () => {
    expect((await api(t.student).post(`/api/assignment-recipients/${recB.id}/skip`, { reason: "KONU" })).status).toBe(200);
    expect((await api(t.student).delete(`/api/assignment-recipients/${recB.id}/skip`)).status).toBe(200);
    const x = await row(recB.id);
    expect(x).toMatchObject({ completed: false, skippedAt: null, skipReason: null, priorSkipReason: "KONU" });
    expect(x.priorSkippedAt).toBeInstanceOf(Date);
  });

  it("sonra teslim edilince önceki pas korunur", async () => {
    expect((await api(t.student).post(`/api/assignment-recipients/${recB.id}/submit`, RESULT)).status).toBe(200);
    const x = await row(recB.id);
    expect(x.completed).toBe(true);
    expect(x.priorSkipReason).toBe("KONU");
    expect(x.priorSkippedAt).toBeInstanceOf(Date);
  });
});

describe("doğrudan teslim ve eski kayıtlar", () => {
  it("doğrudan teslimde önceki pas yok", async () => {
    expect((await api(t.student).post(`/api/assignment-recipients/${recC.id}/submit`, { ...RESULT, note: "  kısa not  ", questionNumbers: [3, 7, "x", -1] })).status).toBe(200);
    const x = await row(recC.id);
    expect(x).toMatchObject({ completed: true, priorSkippedAt: null, priorSkipReason: null });
    expect(x.submission.note).toBe("kısa not");
    expect(x.submission.questionNumbers).toEqual([3, 7]);
  });

  it("teslim zamanı boş eski bir kayıt düzenlenince teslim zamanı yazılır", async () => {
    expect((await api(t.student).patch(`/api/assignment-recipients/${recLegacy.id}/submit`, RESULT)).status).toBe(200);
    expect((await row(recLegacy.id)).completedAt).toBeInstanceOf(Date);
  });
});

describe("rapor yanıtı", () => {
  it("önceki pas yalnız teslim edilmiş kayıtlarda döner", async () => {
    const r = await api(t.student).get("/api/stats/full-report");
    expect(r.status).toBe(200);
    const item = (rec) => r.body.items.find((i) => i.id === rec.id);
    expect(item(recA)).toMatchObject({ priorSkipReason: "ZAMAN", skippedAt: null, skipReason: null });
    expect(item(recA).priorSkippedAt).toBeTruthy();
    expect(item(recB).priorSkipReason).toBe("KONU");
    expect(item(recC)).toMatchObject({ priorSkippedAt: null, priorSkipReason: null });
    expect(item(recDone).completedAt).toBe("2026-09-22T12:00:00.000Z");
  });
});

describe("yetki ve doğrulama", () => {
  it("başka öğrenci teslim edemez (403) ve pas geçemez (404)", async () => {
    expect((await api(t.other).post(`/api/assignment-recipients/${recDone.id}/submit`, RESULT)).status).toBe(403);
    expect((await api(t.other).post(`/api/assignment-recipients/${recDone.id}/skip`, { reason: "ZAMAN" })).status).toBe(404);
  });

  it("koç öğrencinin yerine teslim edemez (403)", async () => {
    expect((await api(t.coach).post(`/api/assignment-recipients/${recDone.id}/submit`, RESULT)).status).toBe(403);
  });

  it("gönderilmemiş (taslak) ödev teslim edilemez ve pas geçilemez (409)", async () => {
    expect((await api(t.student).post(`/api/assignment-recipients/${recDraft.id}/submit`, RESULT)).status).toBe(409);
    expect((await api(t.student).post(`/api/assignment-recipients/${recDraft.id}/skip`, { reason: "ZAMAN" })).status).toBe(409);
  });

  it("geçersiz sayı ve sebep 400", async () => {
    expect((await api(t.student).post(`/api/assignment-recipients/${recDone.id}/submit`, { ...RESULT, wrongCount: -1 })).status).toBe(400);
    expect((await api(t.student).post(`/api/assignment-recipients/${recDone.id}/submit`, { ...RESULT, correctCount: 1.5 })).status).toBe(400);
    expect((await api(t.student).post(`/api/assignment-recipients/${recDone.id}/submit`, { ...RESULT, blankCount: 10001 })).status).toBe(400);
    const open = await createAssignment({ teacher: w.coachA, students: [S], topic: "Sebep testi", scheduledDate: "2026-09-21" });
    expect((await api(t.student).post(`/api/assignment-recipients/${recipientOf(open, S).id}/skip`, { reason: "YOK" })).status).toBe(400);
  });

  it("DIGER sebebinin notu saklanır; diğer sebeplerde not yok sayılır", async () => {
    const open = await createAssignment({ teacher: w.coachA, students: [S], topic: "Not testi", scheduledDate: "2026-09-21" });
    const id = recipientOf(open, S).id;
    let r = await api(t.student).post(`/api/assignment-recipients/${id}/skip`, { reason: "ZAMAN", note: "görmezden gelinir" });
    expect(r.body.recipient.skipNote).toBeNull();
    r = await api(t.student).post(`/api/assignment-recipients/${id}/skip`, { reason: "DIGER", note: "  hastaydım  " });
    expect(r.body.recipient.skipNote).toBe("hastaydım");
  });
});
