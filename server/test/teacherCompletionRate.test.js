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
