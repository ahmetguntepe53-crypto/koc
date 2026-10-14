// Veli hesabı (KULLANICI İSTEĞİ 2026-10-14): veli öğrencisinin okul numarasıyla girer, ilk şifre okul numarası, ilk girişte kendi
// şifresini belirler. Yalnızca kendi öğrencisinin ödev durumunu ve çözdüğü soru sayısını görür — doğru/yanlış/net YOK.
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { resetDatabase, seedSchool, loginAll, api, createAssignment, recipientOf, submitResult, prisma } from "./helpers.js";

const inDays = (n) => new Date(Date.now() + n * 86400e3);
const parentLogin = (number, password) => request(app).post("/api/auth/parent-login").send({ email: number, password });

let w, S1, S2, t, parentToken;
beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 2 });
  [S1, S2] = w.grade12;
  t = await loginAll({ student: S1, coach: w.coachA });
  const a = await createAssignment({ teacher: w.branch, students: [S1, S2], subject: "Matematik", questionCount: 20, endDate: inDays(2) });
  await submitResult(recipientOf(a, S1), { correct: 16, wrong: 4 });
  await createAssignment({ teacher: w.branch, students: [S1], subject: "Fizik", questionCount: 10, endDate: inDays(3) });
  await prisma.studySession.create({ data: { studentId: S1.id, examType: "TYT", subject: "Kimya", topic: "Mol", correctCount: 8, wrongCount: 2, blankCount: 5 } });
});

describe("Veli girişi", () => {
  it("yanlış şifre ya da olmayan numara 401; ilk girişte okul numarasıyla hesap açılır ve şifre değiştirme zorunlu", async () => {
    expect((await parentLogin(S1.username, "yanlis")).status).toBe(401);
    expect((await parentLogin("999999", "999999")).status).toBe(401);
    const r = await parentLogin(S1.username, S1.username);
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ role: "PARENT", mustChangePassword: true });
    expect(r.body.user.child).toMatchObject({ id: S1.id, name: S1.name });
    parentToken = r.body.token;
    const blocked = await api(parentToken).get("/api/parent/overview");
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("yeni şifre okul numarası olamaz; belirlenince okul numarası artık çalışmaz", async () => {
    expect((await api(parentToken).post("/api/auth/set-password", { newPassword: S1.username, acceptedTerms: true })).status).toBe(400);
    const ok = await api(parentToken).post("/api/auth/set-password", { newPassword: "VeliSifre2026!", acceptedTerms: true });
    expect(ok.status).toBe(200);
    parentToken = ok.body.token;
    expect((await parentLogin(S1.username, S1.username)).status).toBe(401);
    const again = await parentLogin(S1.username, "VeliSifre2026!");
    expect(again.status).toBe(200);
    parentToken = again.body.token;
    // öğrencinin kendi girişi etkilenmez, veli hesabı öğrenci girişinden açılmaz
    expect((await request(app).post("/api/auth/login").send({ email: S1.username, password: "VeliSifre2026!" })).status).toBe(401);
    expect(await prisma.user.count({ where: { role: "PARENT", childId: S1.id } })).toBe(1);
  });
});

describe("GET /api/parent/overview", () => {
  it("çözülen soru (doğru+yanlış) günlük/haftalık/aylık; ödev durumları; doğru/yanlış/net HİÇ yok", async () => {
    const r = await api(parentToken).get("/api/parent/overview");
    expect(r.status).toBe(200);
    expect(r.body.child).toMatchObject({ id: S1.id, name: S1.name });
    expect(r.body.questions.today).toBe(30); // ödev 16+4 + serbest 8+2 (boşlar sayılmaz)
    expect(r.body.questions.week).toBe(30);
    expect(r.body.questions.month).toBe(30);
    expect(r.body.questions.days).toHaveLength(14);
    expect(r.body.questions.weeks).toHaveLength(8);
    expect(r.body.questions.months).toHaveLength(6);
    expect(r.body.assignments.map((a) => a.status).sort()).toEqual(["done", "open"]);
    const json = JSON.stringify(r.body);
    for (const k of ["correct", "wrong", "blank", "net", "successPct", "submission"]) expect(json).not.toContain(`"${k}`);
  });

  it("veli başka öğrencinin, öğretmenin ya da müdürün verisine ulaşamaz", async () => {
    expect((await api(parentToken).get(`/api/stats/full-report?studentId=${S2.id}`)).status).toBe(403);
    expect((await api(parentToken).get("/api/teacher/students")).status).toBe(403);
    expect((await api(parentToken).get("/api/principal/overview")).status).toBe(403);
    expect((await api(parentToken).get("/api/assignments")).status).toBe(403);
    expect((await api(parentToken).get(`/api/study-sessions?studentId=${S2.id}`)).status).toBe(403);
    expect((await api(t.student).get("/api/parent/overview")).status).toBe(403);
    expect((await api(t.coach).get("/api/parent/overview")).status).toBe(403);
  });

  it("istatistik: tamamlama, zamanında, ders kırılımı, çalışılan gün; doğru/yanlış yok", async () => {
    const r = await api(parentToken).get("/api/parent/stats");
    expect(r.status).toBe(200);
    expect(r.body.overall).toMatchObject({ total: 2, done: 1, open: 1, onTime: 1, onTimeRate: 100, questions: 20 });
    expect(r.body.studyQuestions).toBe(10);
    expect(r.body.activeDays).toMatchObject({ total: 1, last30: 1, streak: 1 });
    expect(r.body.subjects.map((x) => x.subject).sort()).toEqual(["Fizik", "Matematik"]);
    expect(r.body.weeks).toHaveLength(8);
    const json = JSON.stringify(r.body);
    for (const k of ["correct", "wrong", "blank", "net", "successPct"]) expect(json).not.toContain(`"${k}`);
    expect((await api(t.student).get("/api/parent/stats")).status).toBe(403);
  });
});
