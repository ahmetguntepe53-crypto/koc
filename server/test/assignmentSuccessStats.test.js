// "Başarı yüzdesi" — GET /api/assignments (liste) ve GET /api/assignments/:id artık her ödeve
// avgNet/successPct/completedCount ekler (bkz. routes/assignments.js > successStats). Branş
// öğretmeninin yeni "Gönderdiğim Ödevler" sekmesi bunu kullanır. AYNI formül daha önce "Branş"
// ekranında kullanılmıştı (routes/branch.js > summarize) — burada da BİREBİR aynı hesap.
import { describe, it, expect, beforeAll } from "vitest";
import {
  resetDatabase, seedSchool, loginAll, api, createAssignment, recipientOf, submitResult, skipRecipient,
} from "./helpers.js";

let w, t;
beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 3 });
  t = await loginAll({ branch: w.branch });
});

describe("başarı yüzdesi — GET /assignments/:id", () => {
  it("yalnızca teslim edilmiş alıcılardan hesaplanır; bekleyen/pas geçen ortalamayı bozmaz", async () => {
    const [S1, S2, S3] = [...w.grade11, ...w.grade12];
    // 20 soru: S1 net 17 (D18 Y4), S2 net 13 (D14 Y4) → ortalama net 15, %75. S3 hiç girmedi.
    const a = await createAssignment({ teacher: w.branch, students: [S1, S2, S3], examType: "TYT", subject: "Matematik", questionCount: 20 });
    await submitResult(recipientOf(a, S1), { correct: 18, wrong: 4, blank: 0 });
    await submitResult(recipientOf(a, S2), { correct: 14, wrong: 4, blank: 2 });

    const r = await api(t.branch).get(`/api/assignments/${a.id}`);
    expect(r.status).toBe(200);
    expect(r.body.assignment.completedCount).toBe(2);
    expect(r.body.assignment.avgNet).toBeCloseTo(15, 5);
    expect(r.body.assignment.successPct).toBe(75);
  });

  it("pas geçen alıcı da ortalamaya girmez", async () => {
    const [S1, S2] = w.grade12;
    const a = await createAssignment({ teacher: w.branch, students: [S1, S2], examType: "TYT", subject: "Fizik", questionCount: 10 });
    await submitResult(recipientOf(a, S1), { correct: 10, wrong: 0, blank: 0 }); // net 10, %100
    await skipRecipient(recipientOf(a, S2), { reason: "ZAMAN" });

    const r = await api(t.branch).get(`/api/assignments/${a.id}`);
    expect(r.body.assignment.completedCount).toBe(1);
    expect(r.body.assignment.successPct).toBe(100);
  });

  it("hiç teslim edilmemişse ikisi de null, hata vermez", async () => {
    const a = await createAssignment({ teacher: w.branch, students: [w.grade11[0]], examType: "TYT", subject: "Kimya", questionCount: 10 });
    const r = await api(t.branch).get(`/api/assignments/${a.id}`);
    expect(r.status).toBe(200);
    expect(r.body.assignment.completedCount).toBe(0);
    expect(r.body.assignment.avgNet).toBeNull();
    expect(r.body.assignment.successPct).toBeNull();
  });

  it("soru sayısı yazılmamışsa (pageRange'te 'N soru' yok) girilen D+Y+B ortalamasından hesaplanır", async () => {
    const [S1, S2] = w.grade11;
    const a = await createAssignment({ teacher: w.branch, students: [S1, S2], examType: "TYT", subject: "Biyoloji", pageRange: "45-60" });
    await submitResult(recipientOf(a, S1), { correct: 16, wrong: 0, blank: 4 }); // 20 soru, net 16
    await submitResult(recipientOf(a, S2), { correct: 16, wrong: 0, blank: 4 }); // 20 soru, net 16
    const r = await api(t.branch).get(`/api/assignments/${a.id}`);
    expect(r.body.assignment.avgNet).toBeCloseTo(16, 5);
    expect(r.body.assignment.successPct).toBe(80); // 16 / ((20+20)/2) = %80
  });
});

describe("başarı yüzdesi — GET /assignments (liste)", () => {
  it("listedeki her ödevde de aynı alanlar döner", async () => {
    const a = await createAssignment({ teacher: w.branch, students: [w.grade12[0]], examType: "TYT", subject: "Matematik", topic: "Liste testi", questionCount: 10 });
    await submitResult(recipientOf(a, w.grade12[0]), { correct: 8, wrong: 0, blank: 2 }); // net 8, %80
    const r = await api(t.branch).get("/api/assignments");
    const row = r.body.assignments.find((x) => x.id === a.id);
    expect(row.successPct).toBe(80);
    expect(row.completedCount).toBe(1);
  });
});
