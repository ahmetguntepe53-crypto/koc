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

  it("öğrenci listesi ve öğrenci detayı", async () => {
    const list = await api(t.principal).get("/api/principal/students?period=all");
    const s1 = list.body.students.find((s) => s.id === S1.id);
    expect(s1).toMatchObject({ completionRate: 100, successPct: 75, overdue: 0 });
    const s3 = list.body.students.find((s) => s.id === S3.id);
    expect(s3).toMatchObject({ completionRate: 0, overdue: 1, successPct: null });
    const d = await api(t.principal).get(`/api/principal/students/${S1.id}?period=all`);
    expect(d.status).toBe(200);
    expect(d.body.student.name).toBe(S1.name);
    expect(d.body.subjects.map((s) => s.subject).sort()).toEqual(["Fizik", "Matematik"]);
    expect(d.body.recent[0]).toMatchObject({ subject: "Fizik", status: "open" });
  });

  it("geçersiz dönem reddedilir; öğrenci olmayan id 404", async () => {
    expect((await api(t.principal).get("/api/principal/overview?period=year")).status).toBe(400);
    expect((await api(t.principal).get(`/api/principal/students/${w.coachA.id}`)).status).toBe(404);
  });
});
