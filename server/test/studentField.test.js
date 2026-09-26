// Öğrencinin YKS alanı (User.field: SAY / EA / SOZ / DIL, null = bilinmiyor):
//  • admin: tekil ekleme, toplu içe aktarma (field / alan sütunu), PATCH /users/:id, kullanıcı listesinde görünür,
//  • koç: PATCH /api/teacher/students/:id/field yalnız KENDİ öğrencisi için; öğrenci listesi ve özet ekranında görünür,
//  • GET /api/stats/full-report her iki görünümde student.field döner ve istemci modeli alanın AYT derslerini izler,
//  • aylık özet (yapay zekâ incelemesine giden kimliksiz veri) "alan" taşır,
//  • scripts/import-roster.js isteğe bağlı "alan"/"field" sütunu (boş satır koçun girdiği alanı silmez).
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildReport } from "../../src/reportModel.js";
import { buildMonthlySummary } from "../src/monthlySummary.js";
import { prisma, resetDatabase, seedSchool, loginAll, api, createUser, createAssignment } from "./helpers.js";

let w, t, S, other;

beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 4 });
  S = w.studentsOf(w.coachA).find((s) => s.gradeLevel === 12); // Koç A'nın 12. sınıf öğrencisi
  other = w.studentsOf(w.coachB)[0]; // Koç B'nin öğrencisi
  t = await loginAll({ admin: w.admin, coachA: w.coachA, coachB: w.coachB, branch: w.branch, student: S });
});

describe("admin", () => {
  it("PATCH /users/:id alanı yazar, Türkçe yazımları koda çevirir, null/'' siler", async () => {
    let r = await api(t.admin).patch(`/api/admin/users/${S.id}`, { field: "SAY" });
    expect(r.status).toBe(200);
    expect(r.body.user.field).toBe("SAY");
    r = await api(t.admin).patch(`/api/admin/users/${S.id}`, { field: "Eşit Ağırlık" });
    expect(r.body.user.field).toBe("EA");
    r = await api(t.admin).patch(`/api/admin/users/${S.id}`, { field: "SÖZ" });
    expect(r.body.user.field).toBe("SOZ");
    r = await api(t.admin).patch(`/api/admin/users/${S.id}`, { field: "" });
    expect(r.body.user.field).toBeNull();
    r = await api(t.admin).patch(`/api/admin/users/${S.id}`, { field: "DİL" });
    expect(r.body.user.field).toBe("DIL");
    r = await api(t.admin).patch(`/api/admin/users/${S.id}`, { field: null });
    expect(r.body.user.field).toBeNull();
  });

  it("geçersiz değer 400; öğretmene alan yazılmaz; alan verilmeyen PATCH alana dokunmaz", async () => {
    for (const field of ["MF", "Sayısal-2", 12, { x: 1 }]) {
      const r = await api(t.admin).patch(`/api/admin/users/${S.id}`, { field });
      expect(r.status, JSON.stringify(field)).toBe(400);
    }
    expect((await api(t.admin).patch(`/api/admin/users/${w.coachA.id}`, { field: "SAY" })).status).toBe(400);
    await api(t.admin).patch(`/api/admin/users/${S.id}`, { field: "SAY" });
    const r = await api(t.admin).patch(`/api/admin/users/${S.id}`, { className: "12-A" });
    expect(r.status).toBe(200);
    expect(r.body.user.field).toBe("SAY");
  });

  it("kullanıcı listesinde alan görünür; admin dışı erişemez", async () => {
    const r = await api(t.admin).get("/api/admin/users?role=STUDENT");
    expect(r.status).toBe(200);
    expect(r.body.users.find((u) => u.id === S.id).field).toBe("SAY");
    expect(r.body.users.find((u) => u.id === other.id).field).toBeNull();
    expect((await api(t.coachA).patch(`/api/admin/users/${S.id}`, { field: "EA" })).status).toBe(403);
  });

  it("tekil ekleme: alan isteğe bağlı, geçersizse hesap açılmaz", async () => {
    let r = await api(t.admin).post("/api/admin/users", { role: "STUDENT", name: "Test Kurgu Alanlı", username: "80001", gradeLevel: 12, field: "Sayısal" });
    expect(r.status).toBe(201);
    expect(r.body.user.field).toBe("SAY");
    r = await api(t.admin).post("/api/admin/users", { role: "STUDENT", name: "Test Kurgu Alansız", username: "80002", gradeLevel: 11 });
    expect(r.status).toBe(201);
    expect(r.body.user.field).toBeNull();
    r = await api(t.admin).post("/api/admin/users", { role: "STUDENT", name: "Test Kurgu Hatalı", username: "80003", gradeLevel: 11, field: "MF" });
    expect(r.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { username: "80003" } })).toBeNull();
    // Öğretmen satırında alan yok sayılır.
    r = await api(t.admin).post("/api/admin/users", { role: "TEACHER", name: "Test Kurgu Öğretmen", username: "kurgu.ogretmen", field: "SAY" });
    expect(r.status).toBe(201);
    expect(r.body.user.field).toBeNull();
  });

  it("toplu içe aktarma: field ve alan sütunu; hatalı satır diğerlerini durdurmaz", async () => {
    const r = await api(t.admin).post("/api/admin/users/bulk-import", {
      role: "STUDENT",
      rows: [
        { name: "Test Kurgu Toplu 1", username: "80011", gradeLevel: 12, field: "EA" },
        { name: "Test Kurgu Toplu 2", username: "80012", gradeLevel: 12, alan: "sözel" },
        { name: "Test Kurgu Toplu 3", username: "80013", gradeLevel: 11, field: "Fen" },
        { name: "Test Kurgu Toplu 4", username: "80014", gradeLevel: 11 },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body.results.map((x) => x.ok)).toEqual([true, true, false, true]);
    expect(r.body.results[2].error).toMatch(/YKS alanı/);
    const byName = Object.fromEntries((await prisma.user.findMany({ where: { username: { in: ["80011", "80012", "80013", "80014"] } } })).map((u) => [u.username, u.field]));
    expect(byName).toEqual({ 80011: "EA", 80012: "SOZ", 80014: null });
  });
});

describe("koç", () => {
  it("kendi öğrencisinin alanını girer, değiştirir, siler", async () => {
    let r = await api(t.coachA).patch(`/api/teacher/students/${S.id}/field`, { field: "EA" });
    expect(r.status).toBe(200);
    expect(r.body.student).toEqual({ id: S.id, field: "EA" });
    r = await api(t.coachA).patch(`/api/teacher/students/${S.id}/field`, { field: null });
    expect(r.body.student.field).toBeNull();
    r = await api(t.coachA).patch(`/api/teacher/students/${S.id}/field`, { field: "say" });
    expect(r.body.student.field).toBe("SAY");
    expect((await prisma.user.findUnique({ where: { id: S.id } })).field).toBe("SAY");
  });

  it("başka koçun öğrencisi 403, branş öğretmeni 403, öğrencinin kendisi 403", async () => {
    expect((await api(t.coachA).patch(`/api/teacher/students/${other.id}/field`, { field: "EA" })).status).toBe(403);
    expect((await api(t.coachB).patch(`/api/teacher/students/${S.id}/field`, { field: "EA" })).status).toBe(403);
    expect((await api(t.branch).patch(`/api/teacher/students/${S.id}/field`, { field: "EA" })).status).toBe(403);
    expect((await api(t.student).patch(`/api/teacher/students/${S.id}/field`, { field: "EA" })).status).toBe(403);
    expect((await api(t.coachA).patch(`/api/teacher/students/${w.coachB.id}/field`, { field: "EA" })).status).toBe(403);
    expect((await prisma.user.findUnique({ where: { id: other.id } })).field).toBeNull();
    expect((await prisma.user.findUnique({ where: { id: S.id } })).field).toBe("SAY");
  });

  it("geçersiz değer ya da eksik gövde 400", async () => {
    expect((await api(t.coachA).patch(`/api/teacher/students/${S.id}/field`, { field: "MF" })).status).toBe(400);
    expect((await api(t.coachA).patch(`/api/teacher/students/${S.id}/field`, {})).status).toBe(400);
    expect((await prisma.user.findUnique({ where: { id: S.id } })).field).toBe("SAY");
  });

  it("öğrenci listesi ve öğrenci özeti alanı döner", async () => {
    const list = await api(t.coachA).get("/api/teacher/students");
    expect(list.status).toBe(200);
    expect(list.body.students.find((s) => s.id === S.id).field).toBe("SAY");
    const ov = await api(t.coachA).get(`/api/teacher/students/${S.id}/overview`);
    expect(ov.status).toBe(200);
    expect(ov.body.student.field).toBe("SAY");
  });
});

describe("rapor ve aylık özet", () => {
  beforeAll(async () => {
    // Okuldan gelen, hiç kaydı olmayan AYT Fizik ödevi (SAY alanında) ve AYT Tarih-1 ödevi (SAY dışı).
    await createAssignment({ teacher: w.branch, students: w.grade12, targetMode: "SCHOOL_WIDE", examType: "AYT", subject: "Fizik", topic: "Kurgu Hareket", questionCount: 20, scheduledDate: "2026-09-14", endDate: "2026-09-18" });
    await createAssignment({ teacher: w.branch, students: w.grade12, targetMode: "SCHOOL_WIDE", examType: "AYT", subject: "Tarih-1", topic: "Kurgu Tarih", questionCount: 20, scheduledDate: "2026-09-14", endDate: "2026-09-18" });
  });

  it("full-report: öğrenci, koç ve admin görünümünde student.field", async () => {
    for (const [who, url] of [["student", "/api/stats/full-report"], ["coachA", `/api/stats/full-report?studentId=${S.id}`], ["admin", `/api/stats/full-report?studentId=${S.id}`]]) {
      const r = await api(t[who]).get(url);
      expect(r.status, who).toBe(200);
      expect(r.body.student.field, who).toBe("SAY");
    }
    const r = await api(t.coachB).get(`/api/stats/full-report?studentId=${other.id}`);
    expect(r.body.student.field).toBeNull();
    expect(r.body.student).toHaveProperty("field");
  });

  it("yanıt istemci modeline verildiğinde alanın AYT dersi izlenir, alan dışı ders izlenmez", async () => {
    const r = await api(t.coachA).get(`/api/stats/full-report?studentId=${S.id}`);
    const m = buildReport(r.body, { now: new Date("2026-09-25T12:00:00Z") });
    expect(m.fieldLabel).toBe("Sayısal");
    expect(m.subjectMap.get("AYT|Fizik").tracked).toBe(true);
    expect(m.subjectMap.get("AYT|Tarih-1").tracked).toBe(false);
    // Aynı veri alan bilinmeden: ikisi de takip dışı (eski davranış).
    const unknown = buildReport({ ...r.body, student: { ...r.body.student, field: null } }, { now: new Date("2026-09-25T12:00:00Z") });
    expect(unknown.subjectMap.get("AYT|Fizik").tracked).toBe(false);
  });

  it("aylık özet 'alan' taşır (kimliksiz)", async () => {
    const s = await buildMonthlySummary(S.id, "2026-09", new Date("2026-09-25T12:00:00Z"));
    expect(s.alan).toBe("SAY");
    expect(JSON.stringify(s)).not.toContain(S.name);
    const o = await buildMonthlySummary(other.id, "2026-09", new Date("2026-09-25T12:00:00Z"));
    expect(o.alan).toBeNull();
  });
});

describe("scripts/import-roster.js — alan sütunu", () => {
  const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const run = (...args) => promisify(execFile)(process.execPath, ["scripts/import-roster.js", ...args], { cwd: SERVER_DIR, env: process.env, timeout: 60_000 });
  let dir;
  const writeRoster = (name, students) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, JSON.stringify({ teachers: [{ name: "TEST KOC KURGU", students }] }));
    return file;
  };

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "kocluk-roster-"));
    // Var olan iki öğrenci: biri koçun girdiği alanla (EA), biri alansız.
    await createUser({ role: "STUDENT", name: "Test Kurgu Liste Bir", username: "90001", gradeLevel: 12 });
    await prisma.user.update({ where: { username: "90001" }, data: { field: "EA" } });
    await createUser({ role: "STUDENT", name: "Test Kurgu Liste Dört", username: "90004", gradeLevel: 12 });
  });
  afterAll(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

  it("tanınmayan alan listeyi hiçbir şey yazmadan durdurur", async () => {
    const file = writeRoster("hatali.json", [{ schoolNo: "90009", name: "TEST KURGU HATALI", className: "12-A", alan: "MF" }]);
    await expect(run(file, "--apply")).rejects.toMatchObject({ code: 1 });
    expect(await prisma.user.findUnique({ where: { username: "90009" } })).toBeNull();
  });

  it("--apply: yeni öğrenciye alan yazılır, var olanın alanı güncellenir, alansız satır mevcut alanı silmez", async () => {
    const file = writeRoster("liste.json", [
      { schoolNo: "90001", name: "TEST KURGU LISTE BIR", className: "12-A" },
      { schoolNo: "90002", name: "TEST KURGU LISTE IKI", className: "12-A", alan: "Sayısal" },
      { schoolNo: "90003", name: "TEST KURGU LISTE UC", className: "11-B", field: "söz" },
      { schoolNo: "90004", name: "TEST KURGU LISTE DORT", className: "12-B", alan: "DİL" },
    ]);
    const dry = await run(file);
    expect(dry.stdout).toMatch(/alanı yazılı: 3/);
    expect(await prisma.user.findUnique({ where: { username: "90002" } })).toBeNull();
    expect((await prisma.user.findUnique({ where: { username: "90004" } })).field).toBeNull();

    await run(file, "--apply");
    const fields = Object.fromEntries((await prisma.user.findMany({ where: { username: { in: ["90001", "90002", "90003", "90004"] } } })).map((u) => [u.username, u.field]));
    expect(fields).toEqual({ 90001: "EA", 90002: "SAY", 90003: "SOZ", 90004: "DIL" });
  });
});
