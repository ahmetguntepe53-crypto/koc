// Ödev detayındaki "Düzenle" (gönderilmiş ödevde sınırlı alanlar) ve "Hatırlat" (geciken öğrenciye elle bildirim).
import { describe, it, expect, beforeAll } from "vitest";
import {
  prisma, resetDatabase, seedSchool, loginAll, api, createAssignment, recipientOf, submitResult, skipRecipient,
} from "./helpers.js";

const daysAgo = (n) => new Date(Date.now() - n * 86400e3);

let w, t;
beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 4 });
  t = await loginAll({ branch: w.branch, coach: w.coachA, student: w.grade12[0] });
});

describe("PATCH /assignments/:id — gönderilmiş ödev", () => {
  it("konu, kaynak, sayfa/soru, not ve son gün değişir", async () => {
    const a = await createAssignment({ teacher: w.branch, students: [w.grade12[0]], scheduledDate: daysAgo(3), endDate: daysAgo(1) });
    const r = await api(t.branch).patch(`/api/assignments/${a.id}`, {
      topic: "Yeni konu", sourceBook: "Kitap", pageRange: "12 soru", note: "Not", endDate: new Date().toISOString(),
    });
    expect(r.status).toBe(200);
    expect(r.body.assignment).toMatchObject({ topic: "Yeni konu", sourceBook: "Kitap", pageRange: "12 soru", note: "Not" });
  });

  it("ders ya da sınav türü değiştirilemez", async () => {
    const a = await createAssignment({ teacher: w.branch, students: [w.grade12[0]] });
    const r = await api(t.branch).patch(`/api/assignments/${a.id}`, { subject: "Fizik" });
    expect(r.status).toBe(409);
  });

  it("son gün ileri alınınca bitirmeyenlerin hatırlatma işaretleri sıfırlanır ve öğrenciye bildirim gider", async () => {
    const [S1, S2] = w.grade12;
    const a = await createAssignment({ teacher: w.branch, students: [S1, S2], topic: "Uzatma testi", scheduledDate: daysAgo(5), endDate: daysAgo(2) });
    await submitResult(recipientOf(a, S1), { correct: 5 });
    await prisma.assignmentRecipient.updateMany({ where: { assignmentId: a.id }, data: { overdueReminderSentAt: new Date(), dueReminderSentAt: new Date() } });
    const r = await api(t.branch).patch(`/api/assignments/${a.id}`, { endDate: new Date(Date.now() + 3 * 86400e3).toISOString() });
    expect(r.status).toBe(200);
    const rows = await prisma.assignmentRecipient.findMany({ where: { assignmentId: a.id } });
    expect(rows.find((x) => x.studentId === S2.id).overdueReminderSentAt).toBeNull();
    expect(rows.find((x) => x.studentId === S1.id).overdueReminderSentAt).not.toBeNull();
    const notes = await prisma.notification.findMany({ where: { text: { contains: "Uzatma testi" } } });
    expect(notes.map((n) => n.userId)).toEqual([S2.id]);
  });

  it("başka öğretmen düzenleyemez", async () => {
    const a = await createAssignment({ teacher: w.branch, students: [w.grade12[0]] });
    const r = await api(t.coach).patch(`/api/assignments/${a.id}`, { topic: "x" });
    expect(r.status).toBe(403);
  });
});

describe("POST /assignments/:id/recipients/:rid/remind", () => {
  it("geciken öğrenciye bildirim gönderir, aynı gün ikinciye izin vermez", async () => {
    const S = w.grade11[0];
    const a = await createAssignment({ teacher: w.branch, students: [S], scheduledDate: daysAgo(4), endDate: daysAgo(2) });
    const rid = recipientOf(a, S).id;
    const r1 = await api(t.branch).post(`/api/assignments/${a.id}/recipients/${rid}/remind`);
    expect(r1.status).toBe(200);
    expect(r1.body.manualReminderSentAt).toBeTruthy();
    const n = await prisma.notification.findFirst({ where: { userId: S.id, text: { contains: "hatırlatıyor" } } });
    expect(n?.type).toBe("assignment_overdue");
    const r2 = await api(t.branch).post(`/api/assignments/${a.id}/recipients/${rid}/remind`);
    expect(r2.status).toBe(429);
  });

  it("süresi dolmamış, tamamlanmış ya da pas geçilmiş alıcıya gönderilmez", async () => {
    const [S1, S2, S3] = w.grade11.slice(1);
    const open = await createAssignment({ teacher: w.branch, students: [S1], endDate: new Date(Date.now() + 2 * 86400e3) });
    expect((await api(t.branch).post(`/api/assignments/${open.id}/recipients/${recipientOf(open, S1).id}/remind`)).status).toBe(409);
    const past = await createAssignment({ teacher: w.branch, students: [S2, S3], scheduledDate: daysAgo(4), endDate: daysAgo(2) });
    await submitResult(recipientOf(past, S2), { correct: 3 });
    await skipRecipient(recipientOf(past, S3));
    expect((await api(t.branch).post(`/api/assignments/${past.id}/recipients/${recipientOf(past, S2).id}/remind`)).status).toBe(409);
    expect((await api(t.branch).post(`/api/assignments/${past.id}/recipients/${recipientOf(past, S3).id}/remind`)).status).toBe(409);
  });

  it("ödevin sahibi olmayan gönderemez", async () => {
    const S = w.grade12[3];
    const a = await createAssignment({ teacher: w.branch, students: [S], scheduledDate: daysAgo(4), endDate: daysAgo(2) });
    const r = await api(t.coach).post(`/api/assignments/${a.id}/recipients/${recipientOf(a, S).id}/remind`);
    expect(r.status).toBe(403);
  });
});
