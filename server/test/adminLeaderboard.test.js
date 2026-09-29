// Sıralama — GET /api/admin/leaderboard (bkz. src/routes/adminLeaderboard.js). Yalnız admin; öğrenci
// ADIYLA genel net oranı sıralaması, tüm zamanların (ödev + serbest çalışma) toplamı.
import { describe, it, expect, beforeAll } from "vitest";
import {
  resetDatabase, seedSchool, loginAll, api, prisma, createAssignment, recipientOf, submitResult, createSession,
} from "./helpers.js";
import { LEADERBOARD_MIN_QUESTIONS } from "../src/routes/adminLeaderboard.js";

let w, t;
beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 2 }); // 4 öğrenci
  t = await loginAll({ admin: w.admin, coachA: w.coachA, student: w.grade12[0] });
});

describe("yetki", () => {
  it("yalnız admin çağırabilir", async () => {
    for (const token of [t.coachA, t.student]) {
      const r = await api(token).get("/api/admin/leaderboard");
      expect(r.status).toBe(403);
    }
  });
});

describe("sıralama", () => {
  it("ödev + serbest çalışma birlikte toplanır, net oranına göre sıralanır, eşik altı ayrı grupta", async () => {
    const [S1, S2, S3, S4] = [...w.grade11, ...w.grade12]; // 4 öğrenci

    // S1: yüksek başarı, eşik üstü (30+ soru) — ödev + serbest çalışma karışık.
    const a1 = await createAssignment({ teacher: w.branch, students: [S1], examType: "TYT", subject: "Matematik", questionCount: 20 });
    await submitResult(recipientOf(a1, S1), { correct: 18, wrong: 4, blank: 0 }); // 22 soru, net 17
    await createSession(S1, { correct: 9, wrong: 4, blank: 0 }); // 13 soru, net 8 → toplam 35 soru, net 25, oran %71.4

    // S2: daha düşük başarı, eşik üstü.
    const a2 = await createAssignment({ teacher: w.branch, students: [S2], examType: "TYT", subject: "Fizik", questionCount: 30 });
    await submitResult(recipientOf(a2, S2), { correct: 10, wrong: 20, blank: 0 }); // 30 soru, net 5, %16.7

    // S3: yalnızca 5 soru — eşiğin (30) altında, sıralamaya girmemeli.
    await createSession(S3, { correct: 5, wrong: 0, blank: 0 });

    // S4: hiç kaydı yok — 0 soru, sıralamaya girmemeli, netRate null olmalı.

    const r = await api(t.admin).get("/api/admin/leaderboard");
    expect(r.status).toBe(200);
    expect(r.body.minQuestions).toBe(LEADERBOARD_MIN_QUESTIONS);

    const byId = Object.fromEntries(r.body.students.map((s) => [s.id, s]));
    expect(byId[S1.id].ranked).toBe(true);
    expect(byId[S1.id].totalQuestions).toBe(35);
    expect(byId[S1.id].netRate).toBeCloseTo(71.4, 1);
    expect(byId[S2.id].ranked).toBe(true);
    expect(byId[S2.id].netRate).toBeCloseTo(16.7, 1);
    expect(byId[S3.id].ranked).toBe(false);
    expect(byId[S4.id].ranked).toBe(false);
    expect(byId[S4.id].totalQuestions).toBe(0);
    expect(byId[S4.id].netRate).toBeNull();

    // Sıralı liste: ranked=true olanlar önce (net oranına göre azalan), sonra ranked=false.
    const ids = r.body.students.map((s) => s.id);
    expect(ids.indexOf(S1.id)).toBeLessThan(ids.indexOf(S2.id));
    expect(ids.indexOf(S2.id)).toBeLessThan(ids.indexOf(S3.id));
  });

  it("askıya alınmış öğrenci listeye girmez", async () => {
    const student = w.grade11[0];
    await prisma.user.update({ where: { id: student.id }, data: { banned: true } });
    const r = await api(t.admin).get("/api/admin/leaderboard");
    expect(r.body.students.some((s) => s.id === student.id)).toBe(false);
    await prisma.user.update({ where: { id: student.id }, data: { banned: false } });
  });
});
