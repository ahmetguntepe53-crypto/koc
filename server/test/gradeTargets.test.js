// Yıllık planlarda hedef sınıf (PlanEntry.gradeLevel → Assignment.targetGrade):
//  • 12. sınıf hedefli kayıt yayınlanınca ödev YALNIZ 12. sınıflara gider (11'lere bildirim bile gitmez),
//  • eski istemci gradeLevel göndermeden düzenlerse hedef korunur,
//  • okul çapı kişi sayısı ve branş ekranındaki sınıf sayıları hedefle tutarlı,
//  • okul çapı yetkisi yalnız branş öğretmeninde.
import { describe, it, expect, beforeAll } from "vitest";
import { prisma, resetDatabase, seedSchool, createUser, loginAll, api } from "./helpers.js";

const BASE = { examType: "TYT", kind: "TOPIC", subject: "Matematik", topic: "Hedef sınıf konusu", date: "2027-01-04", endDate: "2027-01-10", schoolWide: true, questionCount: 30 };
let w, t;

const assignmentOfEntry = async (entryId) => {
  const e = await prisma.planEntry.findUnique({ where: { id: entryId } });
  return prisma.assignment.findUnique({
    where: { id: e.assignmentId },
    include: { recipients: { include: { student: { select: { gradeLevel: true, teacherId: true } } } } },
  });
};

beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool();
  // Sayılmaması gerekenler: askıya alınmış bir 12. sınıf ve sınıf düzeyi girilmemiş bir öğrenci.
  await createUser({ role: "STUDENT", name: "Test Öğrenci Askıda", username: "ogr-askida", gradeLevel: 12, teacherId: w.coachA.id, banned: true });
  await createUser({ role: "STUDENT", name: "Test Öğrenci Sınıfsız", username: "ogr-sinifsiz", gradeLevel: null, teacherId: w.coachA.id });
  t = await loginAll({ branch: w.branch, coachA: w.coachA });
});

describe("GET /api/plan-entries/school-wide-count", () => {
  it("sınıf düzeyine göre sayar (askıdakiler ve sınıfsızlar hariç)", async () => {
    let r = await api(t.branch).get("/api/plan-entries/school-wide-count?examType=TYT&gradeLevel=12");
    expect(r.status).toBe(200);
    expect(r.body.count).toBe(12);
    r = await api(t.branch).get("/api/plan-entries/school-wide-count?examType=TYT&gradeLevel=11");
    expect(r.body.count).toBe(12);
    r = await api(t.branch).get("/api/plan-entries/school-wide-count?examType=TYT");
    expect(r.body.count).toBe(24);
  });

  it("geçersiz sınıf 400; branş öğretmeni olmayan koç 403", async () => {
    expect((await api(t.branch).get("/api/plan-entries/school-wide-count?examType=TYT&gradeLevel=10")).status).toBe(400);
    expect((await api(t.coachA).get("/api/plan-entries/school-wide-count?examType=TYT&gradeLevel=12")).status).toBe(403);
  });
});

describe("hedef sınıflı plan kaydı", () => {
  let e12;
  it("oluşturulur", async () => {
    const r = await api(t.branch).post("/api/plan-entries", { ...BASE, gradeLevel: 12 });
    expect(r.status).toBe(201);
    expect(r.body.entry.gradeLevel).toBe(12);
    e12 = r.body.entry;
  });

  it("eski istemci gradeLevel göndermeden düzenlerse hedef korunur", async () => {
    const r = await api(t.branch).put(`/api/plan-entries/${e12.id}`, { ...BASE, topic: "Hedef sınıf konusu (düzenlendi)" });
    expect(r.status).toBe(200);
    const after = await prisma.planEntry.findUnique({ where: { id: e12.id } });
    expect(after.gradeLevel).toBe(12);
    expect(after.topic).toBe("Hedef sınıf konusu (düzenlendi)");
  });

  it("yayınlanınca yalnız 12. sınıflar alır; bildirim de yalnız onlara", async () => {
    const r = await api(t.branch).post(`/api/plan-entries/${e12.id}/publish`);
    expect(r.status).toBe(200);
    const a = await assignmentOfEntry(e12.id);
    expect(a.targetGrade).toBe(12);
    expect(a.targetMode).toBe("SCHOOL_WIDE");
    expect(a.pageRange).toBe("30 soru");
    expect(a.recipients.map((x) => x.studentId).sort()).toEqual(w.grade12.map((s) => s.id).sort());
    const notified = await prisma.notification.findMany({ where: { type: "assignment" }, select: { userId: true, data: true } });
    expect(notified.map((n) => n.userId).sort()).toEqual(w.grade12.map((s) => s.id).sort());
    expect(notified.every((n) => a.recipients.some((x) => x.id === n.data.recipientId))).toBe(true);
  });

  it("yayınlanmış kayıt yeniden yayınlanamaz ya da düzenlenemez (409)", async () => {
    expect((await api(t.branch).post(`/api/plan-entries/${e12.id}/publish`)).status).toBe(409);
    expect((await api(t.branch).put(`/api/plan-entries/${e12.id}`, { ...BASE, gradeLevel: 11 })).status).toBe(409);
  });

  it("11. sınıf hedefi (metin olarak da) yalnız 11. sınıflara gider", async () => {
    const c = await api(t.branch).post("/api/plan-entries", { ...BASE, date: "2027-01-11", endDate: "2027-01-17", gradeLevel: "11" });
    expect(c.status).toBe(201);
    expect(c.body.entry.gradeLevel).toBe(11);
    expect((await api(t.branch).post(`/api/plan-entries/${c.body.entry.id}/publish`)).status).toBe(200);
    const a = await assignmentOfEntry(c.body.entry.id);
    expect(a.targetGrade).toBe(11);
    expect(a.recipients.every((x) => x.student.gradeLevel === 11)).toBe(true);
    expect(a.recipients.length).toBe(12);
  });

  it("hedefsiz okul çapı kayıt 11 ve 12'nin tamamına gider", async () => {
    const c = await api(t.branch).post("/api/plan-entries", { ...BASE, date: "2027-01-18", endDate: null });
    expect(c.body.entry.gradeLevel).toBeNull();
    await api(t.branch).post(`/api/plan-entries/${c.body.entry.id}/publish`);
    const a = await assignmentOfEntry(c.body.entry.id);
    expect(a.targetGrade).toBeNull();
    expect(a.recipients.length).toBe(24);
  });

  it("gradeLevel: null açıkça gönderilirse hedef kalkar", async () => {
    const one = { ...BASE, date: "2027-01-25", endDate: null };
    const c = await api(t.branch).post("/api/plan-entries", { ...one, gradeLevel: 12 });
    expect(c.body.entry.gradeLevel).toBe(12);
    const r = await api(t.branch).put(`/api/plan-entries/${c.body.entry.id}`, { ...one, gradeLevel: null });
    expect(r.status).toBe(200);
    expect(r.body.entry.gradeLevel).toBeNull();
  });

  it("geçersiz sınıf düzeyi 400", async () => {
    expect((await api(t.branch).post("/api/plan-entries", { ...BASE, date: "2027-02-01", endDate: null, gradeLevel: 10 })).status).toBe(400);
    expect((await api(t.branch).post("/api/plan-entries", { ...BASE, date: "2027-02-01", endDate: null, gradeLevel: "on iki" })).status).toBe(400);
  });
});

describe("koçun kendi planı", () => {
  it("okul çapı yetkisi yok (403)", async () => {
    expect((await api(t.coachA).post("/api/plan-entries", { ...BASE, gradeLevel: 12 })).status).toBe(403);
  });

  it("hedef sınıflı kayıt yalnız koçun o sınıftaki öğrencilerine gider", async () => {
    const c = await api(t.coachA).post("/api/plan-entries", { ...BASE, schoolWide: false, date: "2027-02-08", endDate: null, gradeLevel: 11 });
    expect(c.status).toBe(201);
    expect((await api(t.coachA).post(`/api/plan-entries/${c.body.entry.id}/publish`)).status).toBe(200);
    const a = await assignmentOfEntry(c.body.entry.id);
    expect(a.targetMode).toBe("WHOLE_GROUP");
    const mine11 = w.studentsOf(w.coachA).filter((s) => s.gradeLevel === 11).map((s) => s.id).sort();
    expect(a.recipients.map((x) => x.studentId).sort()).toEqual(mine11);
  });
});

describe("GET /api/branch/overview", () => {
  it("sınıf düzeyine göre öğrenci sayıları ve plan kayıtlarının hedefi", async () => {
    const r = await api(t.branch).get("/api/branch/overview?examType=TYT&subject=Matematik");
    expect(r.status).toBe(200);
    expect(r.body.studentCount).toBe(24);
    expect(r.body.studentCounts).toEqual({ all: 24, 11: 12, 12: 12 });
    const grades = r.body.plan.map((p) => p.gradeLevel);
    expect(grades).toContain(12);
    expect(grades).toContain(11);
    expect(grades).toContain(null);
    // Toplu görünüm: öğrenci adı/kimliği yok.
    const json = JSON.stringify(r.body);
    for (const s of w.students) expect(json).not.toContain(s.id);
  });

  it("branşı dışındaki ders 403; branş öğretmeni olmayan koç 403", async () => {
    expect((await api(t.branch).get("/api/branch/overview?examType=TYT&subject=Kimya")).status).toBe(403);
    expect((await api(t.coachA).get("/api/branch/overview?examType=TYT&subject=Matematik")).status).toBe(403);
  });
});
