// Okul müdürü paneli (GET /api/principal/*): yalnızca müdür ve yönetici okur; tamamlama/başarı/gecikme hesapları
// Öğrencilerim ekranıyla aynı tanımda; sınıf, ders ve öğretmen kırılımları doğru toplanır.
import { describe, it, expect, beforeAll } from "vitest";
import { resetDatabase, seedSchool, createUser, loginAll, api, createAssignment, recipientOf, submitResult, skipRecipient } from "./helpers.js";

const daysAgo = (n) => new Date(Date.now() - n * 86400e3);
const inDays = (n) => new Date(Date.now() + n * 86400e3);

let w, t, S1, S2, S3;
beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 2 });
  const principal = await createUser({ role: "PRINCIPAL", name: "Test Müdür", username: "mudur" });
  t = await loginAll({ principal, admin: w.admin, coach: w.coachA, student: w.grade12[0] });
  [S1, S2] = w.grade12; // 12-A, 12-B
  S3 = w.grade11[0]; // 11-A
  // 20 soruluk Matematik (branş): S1 net 15 (D16 Y4), S2 pas, S3 gecikti.
  const a = await createAssignment({ teacher: w.branch, students: [S1, S2, S3], subject: "Matematik", questionCount: 20, scheduledDate: daysAgo(3), endDate: daysAgo(1) });
  await submitResult(recipientOf(a, S1), { correct: 16, wrong: 4 });
  await skipRecipient(recipientOf(a, S2));
  // Açık (süresi dolmamış) Fizik ödevi: tamamlamaya girmez.
  await createAssignment({ teacher: w.branch, students: [S1], subject: "Fizik", questionCount: 10, endDate: inDays(3) });
});

describe("GET /api/principal/*", () => {
  it("yalnızca müdür ve yönetici erişir", async () => {
    expect((await api(t.principal).get("/api/principal/overview")).status).toBe(200);
    expect((await api(t.admin).get("/api/principal/overview")).status).toBe(200);
    expect((await api(t.coach).get("/api/principal/overview")).status).toBe(403);
    expect((await api(t.student).get("/api/principal/students")).status).toBe(403);
  });

  it("okul geneli, sınıf ve ders kırılımları", async () => {
    const r = await api(t.principal).get("/api/principal/overview?period=all");
    expect(r.body.school.completionRate).toBe(33); // 1 tamamlandı / 3 sorumlu
    expect(r.body.school.successPct).toBe(75); // 15 / 20
    expect(r.body.school.overdue).toBe(1);
    expect(r.body.school.assignments).toBe(2);
    const math = r.body.subjects.find((s) => s.subject === "Matematik");
    expect(math).toMatchObject({ assignments: 1, completionRate: 33, successPct: 75, overdue: 1 });
    const c11a = r.body.classes.find((c) => c.className === "11-A");
    expect(c11a).toMatchObject({ completionRate: 0, overdue: 1 });
    const branch = r.body.teachers.find((x) => x.name === "Test Branş Öğretmeni");
    expect(branch.assignmentsSent).toBe(2);
  });

  it("öğrenci listesi", async () => {
    const list = await api(t.principal).get("/api/principal/students?period=all");
    const s1 = list.body.students.find((s) => s.id === S1.id);
    expect(s1).toMatchObject({ completionRate: 100, successPct: 75, overdue: 0 });
    const s3 = list.body.students.find((s) => s.id === S3.id);
    expect(s3).toMatchObject({ completionRate: 0, overdue: 1, successPct: null });
  });

  it("geçersiz dönem reddedilir; öğrenci olmayan id 404", async () => {
    expect((await api(t.principal).get("/api/principal/overview?period=year")).status).toBe(400);
    expect((await api(t.principal).get(`/api/principal/students/${w.coachA.id}/overview`)).status).toBe(404);
  });

  it("öğrenci genel bakışı koçunki gibi ödev geçmişini verir, koçun özel notlarını vermez", async () => {
    const { prisma } = await import("./helpers.js");
    await prisma.coachNote.create({ data: { studentId: S1.id, teacherId: w.coachA.id, text: "ÖZEL KOÇ NOTU" } });
    const r = await api(t.principal).get(`/api/principal/students/${S1.id}/overview`);
    expect(r.status).toBe(200);
    expect(r.body.student.name).toBe(S1.name);
    expect(r.body.recipients.map((x) => x.assignment.subject).sort()).toEqual(["Fizik", "Matematik"]);
    expect(r.body.notes).toEqual([]);
    expect(JSON.stringify(r.body)).not.toContain("ÖZEL KOÇ NOTU");
  });

  it("müdür öğrencinin raporunu, ödev ayrıntısını ve sıralamayı okur", async () => {
    expect((await api(t.principal).get(`/api/stats/full-report?studentId=${S1.id}`)).status).toBe(200);
    expect((await api(t.principal).get("/api/stats/full-report")).status).toBe(400);
    const list = await api(t.principal).get("/api/principal/students/" + S1.id + "/overview");
    const assignmentId = list.body.recipients[0].assignmentId;
    const a = await api(t.principal).get(`/api/assignments/${assignmentId}`);
    expect(a.status).toBe(200);
    expect(a.body.assignment.readOnly).toBe(true);
    const lb = await api(t.principal).get("/api/principal/leaderboard");
    expect(lb.status).toBe(200);
    expect(Array.isArray(lb.body.students)).toBe(true);
    expect((await api(t.coach).get("/api/principal/leaderboard")).status).toBe(403);
  });

  it("sıralama döneme göre: günlük yalnızca bugünün sonuçları, tümü hepsi; eşik döneme göre küçülür", async () => {
    const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const today = new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()));
    const Sx = w.grade12[1], Sy = w.grade11[1];
    // Sx: bugün biten 10 soruluk ödev (net 8); Sy: 40 gün önce biten 40 soruluk ödev (net 32).
    const a = await createAssignment({ teacher: w.branch, students: [Sx], subject: "Matematik", questionCount: 10, scheduledDate: today, endDate: today });
    await submitResult(recipientOf(a, Sx), { correct: 8, wrong: 0, blank: 2 });
    const b = await createAssignment({ teacher: w.branch, students: [Sy], subject: "Matematik", questionCount: 40, scheduledDate: daysAgo(45), endDate: daysAgo(40) });
    await submitResult(recipientOf(b, Sy), { correct: 32, wrong: 0, blank: 8 });

    const day = (await api(t.principal).get("/api/principal/leaderboard?period=day")).body;
    expect(day.period).toBe("day");
    expect(day.minQuestions).toBe(5);
    const dx = day.students.find((x) => x.id === Sx.id);
    expect(dx).toMatchObject({ ranked: true, totalQuestions: 10, netRate: 80 });
    expect(day.students.find((x) => x.id === Sy.id)).toMatchObject({ ranked: false, totalQuestions: 0 });

    const all = (await api(t.principal).get("/api/principal/leaderboard?period=all")).body;
    expect(all.minQuestions).toBe(30);
    expect(all.students.find((x) => x.id === Sy.id)).toMatchObject({ ranked: true, totalQuestions: 40, netRate: 80 });
    expect(all.students.find((x) => x.id === Sx.id)).toMatchObject({ ranked: false, totalQuestions: 10 });

    expect((await api(t.principal).get("/api/principal/leaderboard?period=year")).status).toBe(400);
  });

  it("2.0 uyumluluğu: eski /students/:id özet ucu hâlâ çalışır", async () => {
    const d = await api(t.principal).get(`/api/principal/students/${S1.id}?period=all`);
    expect(d.status).toBe(200);
    expect(d.body.student.name).toBe(S1.name);
    expect(d.body.subjects.map((s) => s.subject).sort()).toEqual(["Fizik", "Matematik"]);
    expect(d.body.recent[0]).toMatchObject({ subject: "Fizik", status: "open" });
    expect((await api(t.principal).get(`/api/principal/students/${w.coachA.id}`)).status).toBe(404);
  });
});
