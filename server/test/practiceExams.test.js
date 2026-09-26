// Deneme sınavları (/api/practice-exams): yetki (öğrenci kendisi, koç yalnız kendi öğrencisi, admin salt okur, başka koç
// ve branş öğretmeni 403), resmî soru sayılarına göre doğrulama (D+Y+B ≤ ders sorusu, bilinmeyen/yinelenen ders, ileri
// tarih…), CRUD (öğrenci yalnız kendi girdiğini değiştirir, koç hepsini), full-report'ta practiceExams ve istemci modeli
// (src/reportModel.js > denemeler), aylık özette (yapay zekâya giden kimliksiz veri) ayın denemeleri, hesap silmede
// denemelerin korunması (admin 409) ve cascade / giren hesap silinince SET NULL.
import { describe, it, expect, beforeAll } from "vitest";
import { buildReport } from "../../src/reportModel.js";
import { buildMonthlySummary } from "../src/monthlySummary.js";
import { prisma, resetDatabase, seedSchool, loginAll, loginAs, createUser, api, allKeys } from "./helpers.js";

let w, t, S, mate, other;

// Kurgusal TYT denemesi: dersler resmî kitapçık sırasıyla değil, karışık gönderilir (sunucu sıralar).
const tyt = (over = {}) => ({
  examType: "TYT", date: "2026-09-14", name: "Kurgu Yayınları TYT-1",
  results: [
    { subject: "Matematik", correct: 20, wrong: 4, blank: 6 },
    { subject: "Türkçe", correct: 30, wrong: 6, blank: 4 },
    { subject: "Fizik", correct: 4, wrong: 1, blank: 2 },
  ],
  ...over,
});
// Bugünden (TR) iki gün sonrası — her zaman "ileri tarih".
const future = () => new Date(Date.now() + 3 * 3600e3 + 2 * 864e5).toISOString().slice(0, 10);

beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool({ perGrade: 4 });
  S = w.studentsOf(w.coachA).find((s) => s.gradeLevel === 12); // Koç A'nın 12. sınıf öğrencisi
  mate = w.studentsOf(w.coachA).find((s) => s.gradeLevel === 12 && s.id !== S.id) || w.studentsOf(w.coachA).find((s) => s.id !== S.id);
  other = w.studentsOf(w.coachB)[0]; // Koç B'nin öğrencisi
  t = await loginAll({ student: S, mate, coachA: w.coachA, coachB: w.coachB, branch: w.branch, admin: w.admin });
});

describe("yetki", () => {
  it("anonim istek 401", async () => {
    expect((await api().get("/api/practice-exams")).status).toBe(401);
  });

  it("öğrenci yalnız kendi denemelerini görür; başka öğrencinin kimliğiyle 403", async () => {
    expect((await api(t.student).get("/api/practice-exams")).status).toBe(200);
    expect((await api(t.student).get(`/api/practice-exams?studentId=${mate.id}`)).status).toBe(403);
    expect((await api(t.student).post("/api/practice-exams", tyt({ studentId: mate.id }))).status).toBe(403);
  });

  it("koç kendi öğrencisi için 200; başka koç ve branş öğretmeni 403; studentId yoksa 400", async () => {
    expect((await api(t.coachA).get(`/api/practice-exams?studentId=${S.id}`)).status).toBe(200);
    expect((await api(t.coachB).get(`/api/practice-exams?studentId=${S.id}`)).status).toBe(403);
    expect((await api(t.branch).get(`/api/practice-exams?studentId=${S.id}`)).status).toBe(403);
    expect((await api(t.coachB).post("/api/practice-exams", tyt({ studentId: S.id }))).status).toBe(403);
    expect((await api(t.coachA).get("/api/practice-exams")).status).toBe(400);
    // Koç, öğrenci olmayan bir hesaba (kendisi) deneme giremez.
    expect((await api(t.coachA).post("/api/practice-exams", tyt({ studentId: w.coachA.id }))).status).toBe(403);
  });

  it("admin okur ama yazamaz", async () => {
    expect((await api(t.admin).get(`/api/practice-exams?studentId=${S.id}`)).status).toBe(200);
    expect((await api(t.admin).post("/api/practice-exams", tyt({ studentId: S.id }))).status).toBe(403);
  });
});

describe("doğrulama (resmî soru sayıları)", () => {
  const bad = async (body, re) => {
    const r = await api(t.student).post("/api/practice-exams", body);
    expect(r.status, JSON.stringify(body)).toBe(400);
    if (re) expect(r.body.error).toMatch(re);
  };

  it("D + Y + B dersin soru sayısını aşamaz (TYT Matematik 30, TYT Fizik 7, AYT Fizik 14)", async () => {
    await bad(tyt({ results: [{ subject: "Matematik", correct: 25, wrong: 4, blank: 2 }] }), /Matematik dersinde en fazla 30 soru/);
    await bad(tyt({ results: [{ subject: "Fizik", correct: 8, wrong: 0, blank: 0 }] }), /en fazla 7/);
    await bad({ examType: "AYT", date: "2026-09-14", results: [{ subject: "Fizik", correct: 10, wrong: 3, blank: 2 }] }, /en fazla 14/);
    // Tam sınırda kabul edilir.
    const ok = await api(t.student).post("/api/practice-exams", { examType: "AYT", date: "2026-09-15", results: [{ subject: "Fizik", correct: 10, wrong: 2, blank: 2 }] });
    expect(ok.status).toBe(201);
    await api(t.student).delete(`/api/practice-exams/${ok.body.exam.id}`);
  });

  it("o sınavda olmayan ders, yinelenen ders, negatif/kesirli sayı, hepsi boş → 400", async () => {
    await bad(tyt({ results: [{ subject: "Edebiyat", correct: 10, wrong: 0, blank: 0 }] }), /olmayan bir ders/);
    // AYT'de Felsefe Grubu tek satır ("Felsefe"); Mantık ayrı ders olarak girilemez.
    await bad({ examType: "AYT", date: "2026-09-14", results: [{ subject: "Mantık", correct: 2, wrong: 0, blank: 0 }] }, /olmayan bir ders/);
    await bad(tyt({ results: [{ subject: "Türkçe", correct: 10 }, { subject: "Türkçe", correct: 5 }] }), /iki kez/);
    await bad(tyt({ results: [{ subject: "Türkçe", correct: -1, wrong: 0, blank: 0 }] }));
    await bad(tyt({ results: [{ subject: "Türkçe", correct: 10.5, wrong: 0, blank: 0 }] }));
    await bad(tyt({ results: [{ subject: "Türkçe", correct: 0, wrong: 0, blank: 0 }] }), /En az bir/);
    await bad(tyt({ results: [] }));
    await bad(tyt({ results: "Türkçe 30" }));
  });

  it("sınav türü, tarih ve ad kuralları", async () => {
    await bad(tyt({ examType: "LGS" }), /sınav türü/);
    await bad(tyt({ date: future() }), /ileri/);
    await bad(tyt({ date: "2026-02-31" }), /tarih/);
    await bad(tyt({ date: "dün" }), /tarih/);
    await bad(tyt({ date: undefined }), /tarih/);
    await bad(tyt({ name: "x".repeat(81) }), /80 karakter/);
    await bad(tyt({ name: 42 }));
    expect(await prisma.practiceExam.count()).toBe(0);
  });
});

describe("CRUD", () => {
  let own, byCoach;

  it("öğrenci ekler: 0/0/0 dersler atlanır, dersler kitapçık sırasında döner, kayıt öğrencinin", async () => {
    const r = await api(t.student).post("/api/practice-exams", tyt({ results: [...tyt().results, { subject: "Kimya", correct: 0, wrong: 0, blank: 0 }] }));
    expect(r.status).toBe(201);
    own = r.body.exam;
    expect(own).toMatchObject({ examType: "TYT", name: "Kurgu Yayınları TYT-1", byStudent: true, canEdit: true });
    expect(new Date(own.date).toISOString()).toBe("2026-09-14T00:00:00.000Z");
    expect(own.results.map((x) => x.subject)).toEqual(["Türkçe", "Matematik", "Fizik"]);
    expect(own.results[0]).toEqual({ subject: "Türkçe", correct: 30, wrong: 6, blank: 4 });
    const row = await prisma.practiceExam.findUnique({ where: { id: own.id } });
    expect(row.studentId).toBe(S.id);
    expect(row.createdById).toBe(S.id);
  });

  it("koç kendi öğrencisi için ekler (kaydı koç girdi; öğrenci görür ama düzenleyemez)", async () => {
    const r = await api(t.coachA).post("/api/practice-exams", {
      studentId: S.id, examType: "AYT", date: "2026-09-20", name: "Okul AYT Denemesi",
      results: [{ subject: "Matematik", correct: 18, wrong: 6, blank: 6 }, { subject: "Felsefe", correct: 8, wrong: 2, blank: 2 }],
    });
    expect(r.status).toBe(201);
    byCoach = r.body.exam;
    expect(byCoach).toMatchObject({ byStudent: false, canEdit: true });
    expect((await prisma.practiceExam.findUnique({ where: { id: byCoach.id } })).createdById).toBe(w.coachA.id);

    const list = await api(t.student).get("/api/practice-exams");
    expect(list.body.exams.map((e) => e.id)).toEqual([byCoach.id, own.id]); // yeniden eskiye
    expect(list.body.exams.find((e) => e.id === byCoach.id).canEdit).toBe(false);
    expect(allKeys(list.body)).not.toContain("createdById");
    const put = await api(t.student).put(`/api/practice-exams/${byCoach.id}`, { examType: "AYT", date: "2026-09-20", results: [{ subject: "Matematik", correct: 30 }] });
    expect(put.status).toBe(403);
    expect(put.body.error).toMatch(/koçun girdi/);
    expect((await api(t.student).delete(`/api/practice-exams/${byCoach.id}`)).status).toBe(403);
  });

  it("öğrenci kendi kaydını düzenler: dersler tamamen değişir (eski satır kalmaz)", async () => {
    const r = await api(t.student).put(`/api/practice-exams/${own.id}`, tyt({ name: "  ", results: [{ subject: "Türkçe", correct: 33, wrong: 4, blank: 3 }, { subject: "Geometri", correct: 6, wrong: 2, blank: 2 }] }));
    expect(r.status).toBe(200);
    expect(r.body.exam.name).toBeNull();
    expect(r.body.exam.results.map((x) => x.subject)).toEqual(["Türkçe", "Geometri"]);
    expect(await prisma.practiceExamResult.count({ where: { examId: own.id } })).toBe(2);
    // Geçersiz düzenleme hiçbir şeyi değiştirmez.
    expect((await api(t.student).put(`/api/practice-exams/${own.id}`, tyt({ results: [{ subject: "Geometri", correct: 11 }] }))).status).toBe(400);
    expect(await prisma.practiceExamResult.count({ where: { examId: own.id } })).toBe(2);
  });

  it("koç öğrencinin girdiği kaydı düzeltebilir; başka koç, başka öğrenci ve admin dokunamaz", async () => {
    const body = tyt({ results: [{ subject: "Türkçe", correct: 34, wrong: 4, blank: 2 }] });
    expect((await api(t.coachB).put(`/api/practice-exams/${own.id}`, body)).status).toBe(403);
    expect((await api(t.mate).put(`/api/practice-exams/${own.id}`, body)).status).toBe(403);
    expect((await api(t.mate).get(`/api/practice-exams/${own.id}`)).status).toBe(403);
    expect((await api(t.admin).put(`/api/practice-exams/${own.id}`, body)).status).toBe(403);
    expect((await api(t.admin).get(`/api/practice-exams/${own.id}`)).status).toBe(200);
    const r = await api(t.coachA).put(`/api/practice-exams/${own.id}`, body);
    expect(r.status).toBe(200);
    expect(r.body.exam.results).toEqual([{ subject: "Türkçe", correct: 34, wrong: 4, blank: 2 }]);
    expect(r.body.exam.byStudent).toBe(true); // giren kişi değişmez
  });

  it("silme ders satırlarını da siler; silinen kayıt 404", async () => {
    const tmp = (await api(t.student).post("/api/practice-exams", tyt({ date: "2026-09-01" }))).body.exam;
    expect((await api(t.student).delete(`/api/practice-exams/${tmp.id}`)).status).toBe(200);
    expect(await prisma.practiceExamResult.count({ where: { examId: tmp.id } })).toBe(0);
    expect((await api(t.student).get(`/api/practice-exams/${tmp.id}`)).status).toBe(404);
    expect((await api(t.coachA).delete(`/api/practice-exams/${tmp.id}`)).status).toBe(404);
  });

  it("başka öğrencinin denemesi listeye ve rapora hiç girmez", async () => {
    await api(t.coachB).post("/api/practice-exams", { studentId: other.id, examType: "TYT", date: "2026-09-10", results: [{ subject: "Türkçe", correct: 40 }] });
    const mine = await api(t.coachA).get(`/api/practice-exams?studentId=${S.id}`);
    expect(mine.body.exams).toHaveLength(2);
    const rep = await api(t.student).get("/api/stats/full-report");
    expect(rep.body.practiceExams).toHaveLength(2);
    expect(JSON.stringify(rep.body)).not.toContain(other.id);
  });
});

describe("full-report ve model", () => {
  it("iki görünümde de practiceExams (eskiden yeniye, ders ders) döner ve model denemeleri hesaplar", async () => {
    for (const [tok, viewer] of [[t.student, "student"], [t.coachA, "coach"]]) {
      const r = await api(tok).get(`/api/stats/full-report${viewer === "coach" ? `?studentId=${S.id}` : ""}`);
      expect(r.status).toBe(200);
      const ex = r.body.practiceExams;
      expect(ex.map((e) => e.examType)).toEqual(["TYT", "AYT"]);
      expect(ex[1].results.map((x) => x.subject)).toEqual(["Felsefe", "Matematik"]);
      expect(ex[0].canEdit).toBe(true);
      expect(ex[1].canEdit).toBe(viewer === "coach");
      const model = buildReport(r.body, { window: "all", now: new Date("2026-09-26T12:00:00Z") });
      expect(model.denemeler.all).toBe(2);
      expect(model.denemeler.TYT.last.net).toBe(33); // 34 − 4/4
      expect(model.denemeler.AYT.last.net).toBe(24); // Matematik 18 − 6/4 = 16,5; Felsefe 8 − 2/4 = 7,5
    }
  });
});

describe("aylık özet (yapay zekâya giden kimliksiz veri)", () => {
  it("ayın denemeleri: toplam ve ders netleri, soru sayısı, önceki denemeye göre fark; ad yok", async () => {
    // Ağustos'ta bir TYT (önceki deneme), Eylül'de iki deneme zaten var (TYT 14 Eyl, AYT 20 Eyl).
    await api(t.student).post("/api/practice-exams", tyt({ date: "2026-08-24", name: "Kurgu Ağustos", results: [{ subject: "Türkçe", correct: 30, wrong: 8, blank: 2 }] }));
    const sum = await buildMonthlySummary(S.id, "2026-09", new Date("2026-10-02T09:00:00Z"));
    expect(sum.denemeler).toHaveLength(2);
    const [ty, ay] = sum.denemeler;
    expect(ty).toMatchObject({ tur: "TYT", tarih: "2026-09-14", toplamNet: 33, soru: 40, oncekiDenemeyeGoreNetFarki: 5 });
    expect(ty.dersler).toEqual([{ ders: "TYT Türkçe", soruSayisi: 40, dogru: 34, yanlis: 4, bos: 2, net: 33 }]);
    expect(ay).toMatchObject({ tur: "AYT", toplamNet: 24, soru: 42, oncekiDenemeyeGoreNetFarki: null });
    expect(ay.dersler.map((d) => d.ders)).toEqual(["AYT Felsefe Grubu", "AYT Matematik"]);
    const txt = JSON.stringify(sum);
    expect(txt).not.toMatch(/Kurgu|Okul AYT Denemesi/);
    expect(allKeys(sum)).not.toContain("name");
    // Denemesi olmayan ay: boş dizi.
    expect((await buildMonthlySummary(S.id, "2026-07", new Date("2026-10-02T09:00:00Z"))).denemeler).toEqual([]);
  });
});

describe("hesap silme", () => {
  it("denemesi olan öğrenci admin tarafından silinemez (409); hesap yine de silinirse denemeler de gider", async () => {
    const r = await api(t.admin).delete(`/api/admin/users/${S.id}`);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/deneme/);
    // Hesabını kendisi silen öğrenci (auth.js > DELETE /me aynı prisma.user.delete'i kullanır): cascade.
    const tmp = await createUser({ role: "STUDENT", name: "Test Kurgu Silinen", gradeLevel: 12, teacherId: w.coachA.id });
    const tok = await loginAs(tmp);
    const e = (await api(tok).post("/api/practice-exams", tyt())).body.exam;
    await prisma.user.delete({ where: { id: tmp.id } });
    expect(await prisma.practiceExam.count({ where: { id: e.id } })).toBe(0);
    expect(await prisma.practiceExamResult.count({ where: { examId: e.id } })).toBe(0);
  });

  it("denemeyi giren koç silinince kayıt öğrencide kalır (giren bilgisi boşalır)", async () => {
    const t2 = await createUser({ role: "TEACHER", name: "Test Kurgu Geçici Koç", email: "gecici.koc@okul.test", username: null });
    const e = await prisma.practiceExam.create({
      data: { studentId: S.id, createdById: t2.id, examType: "TYT", date: new Date("2026-09-03T00:00:00Z"), results: { create: [{ subject: "Türkçe", correct: 20, wrong: 0, blank: 0 }] } },
    });
    expect((await api(t.admin).delete(`/api/admin/users/${t2.id}`)).status).toBe(200);
    const row = await prisma.practiceExam.findUnique({ where: { id: e.id } });
    expect(row.createdById).toBeNull();
    expect(row.studentId).toBe(S.id);
  });
});
