// Gelişim raporu v2 uçları: GET /api/stats/full-report (gizlilik, koça özel alanlar, k ≥ 10 okul karşılaştırması),
// GET /api/teacher/monthly-reports, yapay zekâ incelemesi kapıları (403/503/400) ve admin ayarları.
// Rapor istemcide hesaplanır (src/reportModel.js) — yanıtın modelle hesaplanabildiği de burada sözleşme olarak sınanır.
import { describe, it, expect, beforeAll } from "vitest";
import { buildReport } from "../../src/reportModel.js";
import {
  prisma, resetDatabase, seedSchool, loginAll, api, createAssignment, recipientOf, submitResult, skipRecipient,
  addPhoto, createSession, allKeys,
} from "./helpers.js";

const SCHOOL_KEYS = ["median", "n", "participation", "pct", "q1", "q3", "recipients", "scope"];

let w; // kurgusal okul
let S; // raporu incelenen öğrenci: 12. sınıf, Koç A'nın
let t; // tokenlar
const a = {}; // ödevler

beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool();
  S = w.grade12[0];
  const all = w.students;
  const others12 = w.grade12.slice(1);
  const others11 = w.grade11;

  // --- Okul geneli ödevler (branş öğretmeni → 11 ve 12'nin tamamı, 30 soru). Karşılaştırma grubu öğrencinin kendisi
  // HARİÇ; geçerli teslim = en az 0,8·30 = 24 soru.
  const sw = (subject, topic, endDate) => createAssignment({
    teacher: w.branch, students: all, targetMode: "SCHOOL_WIDE", subject, topic, questionCount: 30,
    scheduledDate: "2026-09-07", endDate,
  });
  // 1) Aynı sınıfta 11 geçerli teslim → karşılaştırma "grade".
  a.swGrade = await sw("Matematik", "Problemler", "2026-09-11");
  for (const [i, st] of w.grade12.entries()) {
    await submitResult(recipientOf(a.swGrade, st), { correct: 12 + i, wrong: 4, blank: 14 - i, completedAt: "2026-09-10T15:00:00Z" });
  }
  // 2) Aynı sınıfta 4, okulda 11 geçerli teslim → "school".
  a.swSchool = await sw("Fizik", "Hareket", "2026-09-12");
  await submitResult(recipientOf(a.swSchool, S), { correct: 20, wrong: 4, blank: 6 });
  for (const st of [...others12.slice(0, 4), ...others11.slice(0, 7)]) {
    await submitResult(recipientOf(a.swSchool, st), { correct: 18, wrong: 6, blank: 6 });
  }
  // 3) Yalnız 5 teslim → karşılaştırma yok; 3 kişi "konuyu bilmiyorum" diye pas geçti (alıcı 24 ≥ 10 → oran var).
  a.swNone = await sw("Kimya", "Mol Kavramı", "2026-09-13");
  for (const st of others12.slice(0, 5)) await submitResult(recipientOf(a.swNone, st), { correct: 15, wrong: 5, blank: 10 });
  for (const st of others11.slice(0, 3)) await skipRecipient(recipientOf(a.swNone, st), { reason: "KONU" });
  // 4) 11 teslim ama hepsi kısmi (10/30 soru) → geçersiz, karşılaştırma yok.
  a.swPartial = await sw("Matematik", "Sayılar", "2026-09-14");
  await submitResult(recipientOf(a.swPartial, S), { correct: 20, wrong: 2, blank: 8 });
  for (const st of others12) await submitResult(recipientOf(a.swPartial, st), { correct: 6, wrong: 2, blank: 2 });

  // --- Koçun kendi ödevleri (Koç A → S ve bir sınıf arkadaşı).
  const mate = w.grade12[2];
  a.coachDone = await createAssignment({ teacher: w.coachA, students: [S, mate], subject: "Türkçe", topic: "Paragraf", questionCount: 30, scheduledDate: "2026-09-15", endDate: "2026-09-17" });
  await submitResult(recipientOf(a.coachDone, S), { correct: 24, wrong: 4, blank: 2, note: "Son sorular zordu", questionNumbers: [28, 29] });
  await addPhoto(recipientOf(a.coachDone, S));
  a.coachSkip = await createAssignment({ teacher: w.coachA, students: [S], subject: "Tarih", topic: "Kurtuluş Savaşı", scheduledDate: "2026-09-16", endDate: "2026-09-18" });
  await skipRecipient(recipientOf(a.coachSkip, S), { reason: "DIGER", note: "Kaynak kitap okulda kaldı", at: "2026-09-17T10:00:00Z" });
  a.draft = await createAssignment({ teacher: w.coachA, students: [S], status: "DRAFT", subject: "Biyoloji", topic: "Taslak ödev", scheduledDate: "2026-10-05" });
  a.lgs = await createAssignment({ teacher: w.coachA, students: [S], examType: "LGS", subject: "Matematik", topic: "Eski LGS kaydı", scheduledDate: "2026-09-02" });

  // --- Aylık rapor verisi (Ağustos): TYT Fizik net oranı ≈ %16,7 (odak), TYT Biyoloji ≈ %81,7 (güçlü); ≥ 3 kayıt, ≥ 60 soru.
  for (const [k, ymd] of ["2026-08-05", "2026-08-12", "2026-08-19"].entries()) {
    const fiz = await createAssignment({ teacher: w.coachA, students: [S], subject: "Fizik", topic: `Kuvvet ${k + 1}`, questionCount: 30, scheduledDate: ymd, endDate: ymd });
    await submitResult(recipientOf(fiz, S), { correct: 8, wrong: 12, blank: 10, completedAt: `${ymd}T14:00:00Z` });
    const bio = await createAssignment({ teacher: w.coachA, students: [S], subject: "Biyoloji", topic: `Hücre ${k + 1}`, questionCount: 30, scheduledDate: ymd, endDate: ymd });
    await submitResult(recipientOf(bio, S), { correct: 25, wrong: 2, blank: 3, completedAt: `${ymd}T15:00:00Z` });
  }

  await createSession(S, { subject: "Matematik", topic: "Fonksiyonlar", correct: 20, wrong: 5, blank: 5, note: "Kendi notum", studyDate: "2026-09-20T12:00:00Z" });

  t = await loginAll({ student: S, other: w.grade12[1], coachA: w.coachA, coachB: w.coachB, branch: w.branch, admin: w.admin });
});

describe("GET /api/stats/full-report — öğrenci kendi raporu", () => {
  let body;
  beforeAll(async () => {
    const r = await api(t.student).get("/api/stats/full-report");
    expect(r.status).toBe(200);
    body = r.body;
  });

  it("öğrenci görünümü döner, koça özel alanlar yok", () => {
    expect(body.viewer).toBe("student");
    expect(body.student.id).toBe(S.id);
    expect(body.student).not.toHaveProperty("lastSeenAt");
    for (const it of body.items) {
      expect(it).not.toHaveProperty("note");
      expect(it).not.toHaveProperty("skipNote");
      expect(it).not.toHaveProperty("photos");
    }
    expect(body.sessions.length).toBe(1);
    for (const s of body.sessions) expect(s).not.toHaveProperty("note");
  });

  it("yalnız gönderilmiş TYT/AYT ödevleri (taslak ve eski LGS kayıtları yok)", () => {
    expect(body.items.every((i) => ["TYT", "AYT"].includes(i.examType))).toBe(true);
    const ids = body.items.map((i) => i.assignmentId);
    expect(ids).not.toContain(a.draft.id);
    expect(ids).not.toContain(a.lgs.id);
    expect(ids).toContain(a.coachDone.id);
  });

  it("okul karşılaştırması yalnız toplu alanlar taşır ve en az 10 kişiyle verilir", () => {
    const schools = body.items.map((i) => i.school).filter(Boolean);
    expect(schools.length).toBe(2);
    for (const s of schools) {
      expect(Object.keys(s).sort()).toEqual(SCHOOL_KEYS);
      expect(s.n).toBeGreaterThanOrEqual(10);
    }
    // Tekil değer, min/max hiçbir derinlikte yok.
    const keys = allKeys(body);
    for (const k of ["nets", "min", "max", "rates"]) expect(keys).not.toContain(k);
  });

  it("aynı sınıfta ≥ 10 geçerli teslim → sınıf düzeyi karşılaştırması (medyan/çeyrekler öğrencinin kendisi hariç)", () => {
    const it = body.items.find((i) => i.assignmentId === a.swGrade.id);
    expect(it.source).toBe("branch");
    expect(it.school).toEqual({ n: 11, recipients: 11, participation: 100, median: 56.7, q1: 48.3, q3: 65, pct: 0, scope: "grade" });
  });

  it("aynı sınıfta < 10 → okul geneline düşer", () => {
    const it = body.items.find((i) => i.assignmentId === a.swSchool.id);
    expect(it.school.scope).toBe("school");
    expect(it.school.n).toBe(11);
    expect(it.school.recipients).toBe(23);
    expect(it.school.participation).toBe(48);
  });

  it("okulda da < 10 geçerli teslim ya da yalnız kısmi teslimler → karşılaştırma yok", () => {
    expect(body.items.find((i) => i.assignmentId === a.swNone.id).school).toBeNull();
    expect(body.items.find((i) => i.assignmentId === a.swPartial.id).school).toBeNull();
  });

  it("'konuyu bilmiyorum' pas oranı yalnız okul geneli ödevlerde ve toplu", () => {
    expect(body.items.find((i) => i.assignmentId === a.swNone.id).konuSkipRate).toBe(13);
    expect(body.items.find((i) => i.assignmentId === a.swPartial.id).konuSkipRate).toBe(0);
    expect(body.items.find((i) => i.assignmentId === a.coachDone.id).konuSkipRate).toBeNull();
  });

  it("başka hiçbir öğrencinin adı ya da kimliği yanıtta geçmez", () => {
    const json = JSON.stringify(body);
    for (const o of w.students.filter((s) => s.id !== S.id)) {
      expect(json).not.toContain(o.id);
      expect(json).not.toContain(o.name);
      expect(json).not.toContain(o.username);
    }
  });

  it("yanıt istemcideki rapor modeliyle her pencerede hesaplanır (sözleşme)", () => {
    for (const window of ["4w", "8w", "all", "month:2026-09", "month:2026-08"]) {
      const m = buildReport(body, { window, now: "2026-09-30T12:00:00Z" });
      expect(Array.isArray(m.subjects)).toBe(true);
    }
  });

  it("öğrenci başka bir öğrencinin raporunu isteyemez", async () => {
    const r = await api(t.student).get(`/api/stats/full-report?studentId=${w.grade12[1].id}`);
    expect(r.status).toBe(403);
  });

  it("oturumsuz istek 401", async () => {
    expect((await api().get("/api/stats/full-report")).status).toBe(401);
  });
});

describe("GET /api/stats/full-report — koç ve admin görünümü", () => {
  it("öğrencinin koçu: son giriş, notlar, fotoğraf sayısı, pas notu görünür", async () => {
    const r = await api(t.coachA).get(`/api/stats/full-report?studentId=${S.id}`);
    expect(r.status).toBe(200);
    expect(r.body.viewer).toBe("coach");
    expect(r.body.student).toHaveProperty("lastSeenAt");
    for (const it of r.body.items) {
      expect(it).toHaveProperty("note");
      expect(it).toHaveProperty("skipNote");
      expect(it).toHaveProperty("photos");
    }
    const done = r.body.items.find((i) => i.assignmentId === a.coachDone.id);
    expect(done).toMatchObject({ note: "Son sorular zordu", photos: 1, correct: 24, wrong: 4, blank: 2, questionNumbers: [28, 29] });
    const skipped = r.body.items.find((i) => i.assignmentId === a.coachSkip.id);
    expect(skipped).toMatchObject({ skipReason: "DIGER", skipNote: "Kaynak kitap okulda kaldı", completed: false });
    expect(r.body.sessions[0].note).toBe("Kendi notum");
    // Koç görünümünde de okul karşılaştırması yalnız toplu.
    for (const s of r.body.items.map((i) => i.school).filter(Boolean)) expect(Object.keys(s).sort()).toEqual(SCHOOL_KEYS);
  });

  it("başka bir koç ve branş öğretmeni göremez (403)", async () => {
    expect((await api(t.coachB).get(`/api/stats/full-report?studentId=${S.id}`)).status).toBe(403);
    expect((await api(t.branch).get(`/api/stats/full-report?studentId=${S.id}`)).status).toBe(403);
  });

  it("koç studentId vermezse 400", async () => {
    expect((await api(t.coachA).get("/api/stats/full-report")).status).toBe(400);
  });

  it("admin her öğrenciyi görür", async () => {
    const r = await api(t.admin).get(`/api/stats/full-report?studentId=${S.id}`);
    expect(r.status).toBe(200);
    expect(r.body.viewer).toBe("coach");
  });
});

describe("GET /api/teacher/monthly-reports", () => {
  it("koçun yalnız kendi öğrencileri; odak/güçlü dersler ve net oranı", async () => {
    await prisma.aiAnalysis.create({ data: { studentId: S.id, month: "2026-08", content: { ozet: "Kurgusal inceleme" }, model: "test-model" } });
    const r = await api(t.coachA).get("/api/teacher/monthly-reports?month=2026-08");
    expect(r.status).toBe(200);
    expect(r.body.month).toBe("2026-08");
    expect(r.body.students.map((s) => s.id).sort()).toEqual(w.studentsOf(w.coachA).map((s) => s.id).sort());
    const row = r.body.students.find((s) => s.id === S.id);
    expect(row.odakDersler).toEqual(["TYT Fizik"]);
    expect(row.gucluDersler).toEqual(["TYT Biyoloji"]);
    expect(row).not.toHaveProperty("zayifDersler");
    expect(row.toplam).toHaveProperty("netOrani");
    expect(row.toplam).not.toHaveProperty("basariYuzde");
    expect(row.aiHazir).toBe(true);
    expect(r.body.students.filter((s) => s.id !== S.id).every((s) => s.aiHazir === false)).toBe(true);
    expect(JSON.stringify(r.body)).not.toMatch(/zayıf|zayif/i);
  });

  it("başka koçun listesinde bu öğrenci yok", async () => {
    const r = await api(t.coachB).get("/api/teacher/monthly-reports?month=2026-08");
    expect(r.status).toBe(200);
    expect(r.body.students.map((s) => s.id)).not.toContain(S.id);
  });

  it("geçersiz ay 400; öğrenci ve admin 403", async () => {
    expect((await api(t.coachA).get("/api/teacher/monthly-reports?month=2026-13")).status).toBe(400);
    expect((await api(t.coachA).get("/api/teacher/monthly-reports")).status).toBe(400);
    expect((await api(t.student).get("/api/teacher/monthly-reports?month=2026-08")).status).toBe(403);
    expect((await api(t.admin).get("/api/teacher/monthly-reports?month=2026-08")).status).toBe(403);
  });
});

describe("Yapay zekâ incelemesi ve admin ayarları", () => {
  const q = () => `/api/ai/analysis?studentId=${S.id}&month=2026-09`;

  it("varsayılan: kapalı ve yapılandırılmamış", async () => {
    const r = await api(t.admin).get("/api/admin/settings");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ aiEnabled: false, aiConfigured: false });
    const g = await api(t.coachA).get(q());
    expect(g.status).toBe(200);
    expect(g.body).toMatchObject({ enabled: false, configured: false, analysis: null });
  });

  it("kapalıyken üretim 403", async () => {
    const r = await api(t.coachA).post("/api/ai/analysis", { studentId: S.id, month: "2026-09" });
    expect(r.status).toBe(403);
  });

  it("öğrenci, başka koç ve branş öğretmeni incelemeyi göremez", async () => {
    expect((await api(t.student).get(q())).status).toBe(403);
    expect((await api(t.coachB).get(q())).status).toBe(403);
    expect((await api(t.branch).get(q())).status).toBe(403);
  });

  it("saklanmış inceleme koça ve admine döner", async () => {
    const path = `/api/ai/analysis?studentId=${S.id}&month=2026-08`;
    for (const token of [t.coachA, t.admin]) {
      const r = await api(token).get(path);
      expect(r.status).toBe(200);
      expect(r.body.analysis).toMatchObject({ content: { ozet: "Kurgusal inceleme" }, model: "test-model" });
    }
  });

  it("koç ayarı değiştiremez; admin açar", async () => {
    expect((await api(t.coachA).put("/api/admin/settings", { aiEnabled: true })).status).toBe(403);
    const r = await api(t.admin).put("/api/admin/settings", { aiEnabled: true });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ aiEnabled: true, aiConfigured: false });
  });

  it("açıkken sunucuda anahtar yoksa 503, geçersiz ay 400", async () => {
    expect((await api(t.coachA).post("/api/ai/analysis", { studentId: S.id, month: "2026-09" })).status).toBe(503);
    expect((await api(t.coachA).post("/api/ai/analysis", { studentId: S.id, month: "bad" })).status).toBe(400);
    expect((await api(t.coachA).get(`/api/ai/analysis?studentId=${S.id}&month=bad`)).status).toBe(400);
  });

  it("admin kapatır; ayar yanıtı API anahtarını asla içermez", async () => {
    const r = await api(t.admin).put("/api/admin/settings", { aiEnabled: false });
    expect(r.status).toBe(200);
    expect(r.body.aiEnabled).toBe(false);
    expect(allKeys(r.body).some((k) => /key|anahtar/i.test(k))).toBe(false);
  });
});
