// Öğrencilerim listesindeki tamamlama oranı: tüm öğretmenlerin ödevlerinden, öğrencinin sorumlu olduğu
// (tamamladığı ya da süresi dolmuş) ödevlerin yüzde kaçını tamamladığı. Süresi dolmamış açık ödev paydaya girmez.
import { describe, it, expect, beforeAll } from "vitest";
import { resetDatabase, seedSchool, loginAll, api, createAssignment, recipientOf, submitResult, skipRecipient } from "./helpers.js";

const daysAgo = (n) => new Date(Date.now() - n * 86400e3);
const inDays = (n) => new Date(Date.now() + n * 86400e3);

let w, t;
beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 2 });
  t = await loginAll({ coach: w.coachA });
});

describe("GET /teacher/students — completionRate", () => {
  it("süresi dolmamış açık ödev sayılmaz; pas geçilen tamamlanmamış sayılır; tüm öğretmenlerin ödevleri", async () => {
    const S = w.studentsOf(w.coachA)[0];
    const done1 = await createAssignment({ teacher: w.branch, students: [S], scheduledDate: daysAgo(6), endDate: daysAgo(4) });
    const done2 = await createAssignment({ teacher: w.coachA, students: [S], scheduledDate: daysAgo(6), endDate: daysAgo(3) });
    await createAssignment({ teacher: w.branch, students: [S], scheduledDate: daysAgo(5), endDate: daysAgo(2) }); // gecikti
    const skipped = await createAssignment({ teacher: w.coachB, students: [S], scheduledDate: daysAgo(5), endDate: daysAgo(2) });
    await createAssignment({ teacher: w.branch, students: [S], scheduledDate: daysAgo(1), endDate: inDays(3) }); // açık, sayılmaz
    await submitResult(recipientOf(done1, S), { correct: 5 });
    await submitResult(recipientOf(done2, S), { correct: 5 });
    await skipRecipient(recipientOf(skipped, S));

    const r = await api(t.coach).get("/api/teacher/students");
    expect(r.status).toBe(200);
    const row = r.body.students.find((s) => s.id === S.id);
    expect(row.completionRate).toBe(50); // 2 tamamlandı / 4 sorumlu
  });

  it("sorumlu olduğu ödev yoksa null", async () => {
    const S = w.studentsOf(w.coachA)[1];
    await createAssignment({ teacher: w.branch, students: [S], endDate: inDays(2) });
    const r = await api(t.coach).get("/api/teacher/students");
    expect(r.body.students.find((s) => s.id === S.id).completionRate).toBeNull();
  });
});

describe("GET /teacher/students — completion (günlük/haftalık/aylık)", () => {
  it("her dönem yalnızca bitiş günü o döneme düşen ödevleri sayar", async () => {
    const S = w.studentsOf(w.coachA)[0];
    const r = await api(t.coach).get("/api/teacher/students");
    const c = r.body.students.find((s) => s.id === S.id).completion;
    expect(Object.keys(c).sort()).toEqual(["day", "month", "week"]);
    for (const v of Object.values(c)) expect(v === null || (v >= 0 && v <= 100)).toBe(true);
  });

  it("bugün biten ve tamamlanan ödev üç döneme de girer; iki ay önce biten hiçbirine girmez", async () => {
    const S = w.studentsOf(w.coachB)[0];
    const tb = (await loginAll({ c: w.coachB })).c;
    const tr = new Date(Date.now() + 3 * 60 * 60 * 1000); // Türkiye takvim günü (UTC+3)
    const todayUtc = new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()));
    const a = await createAssignment({ teacher: w.branch, students: [S], scheduledDate: todayUtc, endDate: todayUtc });
    await submitResult(recipientOf(a, S), { correct: 3 });
    await createAssignment({ teacher: w.branch, students: [S], scheduledDate: daysAgo(70), endDate: daysAgo(65) }); // gecikti, eski
    const r = await api(tb).get("/api/teacher/students");
    const row = r.body.students.find((s) => s.id === S.id);
    expect(row.completion.day).toBe(100);
    expect(row.completion.week).toBe(100);
    expect(row.completion.month).toBe(100);
    expect(row.completionRate).toBe(50); // tüm zamanlar: 1 / 2
  });
});

describe("PATCH /auth/me/field — öğrenci kendi YKS alanını seçer", () => {
  it("öğrenci seçer, koç listede ve genel bakışta görür; geçersiz değer ve öğretmen reddedilir", async () => {
    const S = w.studentsOf(w.coachA)[1];
    const ts = (await loginAll({ s: S })).s;
    const ok = await api(ts).patch("/api/auth/me/field", { field: "EA" });
    expect(ok.status).toBe(200);
    expect(ok.body.user.field).toBe("EA");
    const list = await api(t.coach).get("/api/teacher/students");
    expect(list.body.students.find((s) => s.id === S.id).field).toBe("EA");
    expect((await api(ts).patch("/api/auth/me/field", { field: "XYZ" })).status).toBe(400);
    expect((await api(t.coach).patch("/api/auth/me/field", { field: "SAY" })).status).toBe(403);
    const cleared = await api(ts).patch("/api/auth/me/field", { field: null });
    expect(cleared.body.user.field).toBeNull();
  });
});
