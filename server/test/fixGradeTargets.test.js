// scripts/fix-grade-targets.js — hedef sınıfı boş okul çapı planları bir sınıf düzeyine bağlayan bakım betiği.
// Betik ayrı bir süreç olarak (sunucuda nasıl çalıştırılıyorsa öyle) test veritabanına karşı çalıştırılır:
//  • kuru çalışma hiçbir şey yazmaz,
//  • --apply: yalnız okul çapı + hedefsiz kayıtlar ve onlardan yayınlanan ödevler hedef alır; hedef dışı sınıftaki
//    DOKUNULMAMIŞ alıcılar ve onlara giden "yeni ödev" bildirimleri silinir; sonuç girilmiş / pas geçilmiş / fotoğraflı
//    kayıtlar (öğrencinin emeği) korunur.
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, it, expect, beforeAll } from "vitest";
import {
  prisma, resetDatabase, seedSchool, createAssignment, createPlanEntry, recipientOf, submitResult, skipRecipient, addPhoto,
} from "./helpers.js";

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (...args) => promisify(execFile)(process.execPath, ["scripts/fix-grade-targets.js", ...args], {
  cwd: SERVER_DIR, env: process.env, timeout: 60_000,
});

let w, legacy, legacyAssignment, draftLegacy, coachEntry, targeted;
let kept, removed;

async function snapshot() {
  const [entries, recipients, notifications, assignment] = await Promise.all([
    prisma.planEntry.findMany({ select: { id: true, gradeLevel: true }, orderBy: { id: "asc" } }),
    prisma.assignmentRecipient.findMany({ where: { assignmentId: legacyAssignment.id }, select: { id: true, studentId: true }, orderBy: { id: "asc" } }),
    prisma.notification.findMany({ select: { id: true, userId: true }, orderBy: { id: "asc" } }),
    prisma.assignment.findUnique({ where: { id: legacyAssignment.id }, select: { targetGrade: true } }),
  ]);
  return { entries, recipients, notifications, assignment };
}

beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 4 });
  // Eski (hedef alanı yokken) yayınlanmış okul çapı plan: ödev 11 ve 12'nin tamamına gitmiş.
  legacyAssignment = await createAssignment({
    teacher: w.branch, students: w.students, targetMode: "SCHOOL_WIDE", subject: "Matematik", topic: "Eski plan konusu",
    questionCount: 30, scheduledDate: "2026-09-14", endDate: "2026-09-20",
  });
  legacy = await createPlanEntry(w.branch, { date: "2026-09-14", endDate: "2026-09-20", schoolWide: true, topic: "Eski plan konusu", questionCount: 30, assignmentId: legacyAssignment.id });
  for (const r of legacyAssignment.recipients) {
    await prisma.notification.create({ data: { userId: r.studentId, text: "Yeni ödev (kurgusal)", type: "assignment", data: { screen: "assignmentSubmit", recipientId: r.id, subject: "Matematik" } } });
  }
  const [g0, g1, g2, g3] = w.grade11;
  await submitResult(recipientOf(legacyAssignment, g0), { correct: 20, wrong: 5, blank: 5 });
  await skipRecipient(recipientOf(legacyAssignment, g1), { reason: "KONU" });
  await addPhoto(recipientOf(legacyAssignment, g2));
  kept = [g0, g1, g2].map((s) => recipientOf(legacyAssignment, s).id);
  removed = recipientOf(legacyAssignment, g3);

  draftLegacy = await createPlanEntry(w.branch, { date: "2026-10-05", schoolWide: true, topic: "Yayınlanmamış eski kayıt" });
  coachEntry = await createPlanEntry(w.coachA, { date: "2026-10-05", schoolWide: false, topic: "Koçun kendi planı" });
  targeted = await createPlanEntry(w.branch, { date: "2026-10-12", schoolWide: true, gradeLevel: 11, topic: "Zaten 11. sınıf hedefli" });
});

describe("scripts/fix-grade-targets.js", () => {
  it("sınıf verilmezse kullanım mesajıyla çıkar (kod 1)", async () => {
    await expect(run()).rejects.toMatchObject({ code: 1 });
    await expect(run("--grade", "10")).rejects.toMatchObject({ code: 1 });
  });

  it("kuru çalışma rapor eder, hiçbir şey yazmaz", async () => {
    const before = await snapshot();
    const { stdout } = await run("--grade", "12");
    expect(stdout).toContain("KURU ÇALIŞMA");
    expect(stdout).toContain("Hedef sınıfı boş okul çapında plan kaydı: 2");
    expect(stdout).toContain("12. sınıf dışındaki alıcı: 4");
    expect(stdout).toContain("1 kayıt, 1 öğrenci");
    expect(stdout).toMatch(/KORUNACAK[^\n]*: 3/);
    expect(stdout).toContain("silinecek bildirim: 1");
    expect(await snapshot()).toEqual(before);
  });

  it("--apply hedefi yazar, yalnız dokunulmamış hedef dışı alıcıyı ve bildirimini siler", async () => {
    const notifBefore = await prisma.notification.count();
    const { stdout } = await run("--grade", "12", "--apply");
    expect(stdout).toContain("UYGULANDI");

    const grade = async (e) => (await prisma.planEntry.findUnique({ where: { id: e.id } })).gradeLevel;
    expect(await grade(legacy)).toBe(12);
    expect(await grade(draftLegacy)).toBe(12);
    expect(await grade(coachEntry)).toBeNull(); // koçun kendi planına dokunulmaz
    expect(await grade(targeted)).toBe(11); // zaten hedefli kayda dokunulmaz
    expect((await prisma.assignment.findUnique({ where: { id: legacyAssignment.id } })).targetGrade).toBe(12);

    const left = await prisma.assignmentRecipient.findMany({ where: { assignmentId: legacyAssignment.id }, select: { id: true, studentId: true } });
    expect(left.map((r) => r.id)).not.toContain(removed.id);
    for (const id of kept) expect(left.map((r) => r.id)).toContain(id);
    for (const s of w.grade12) expect(left.map((r) => r.studentId)).toContain(s.id);
    expect(left).toHaveLength(w.students.length - 1);

    expect(await prisma.notification.count()).toBe(notifBefore - 1);
    expect(await prisma.notification.count({ where: { userId: removed.studentId } })).toBe(0);
  });

  it("ikinci kez çalıştırmak bir şey değiştirmez", async () => {
    const before = await snapshot();
    const { stdout } = await run("--grade", "12", "--apply");
    expect(stdout).toContain("Hedef sınıfı boş okul çapında plan kaydı: 0");
    expect(await snapshot()).toEqual(before);
  });
});
