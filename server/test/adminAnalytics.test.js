// Okul analizi — GET /api/admin/analytics (bkz. src/routes/adminAnalytics.js). Yalnız admin; okul geneli ödevlerin toplu
// sayıları; 10'dan az alıcılı ödev (sınıf süzgecinden SONRA) gizlenir; medyan en az 10 geçerli teslimle; öğrenci adı,
// kimliği ya da tekil sonucu hiçbir derinlikte yok.
//
// Tarihler çalıştırma anına göre kurulur (CI her gün koşabilir): "dün" biten ödev her zaman 4 haftalık pencerenin son
// yarısında, "20 gün önce" biten her zaman ilk yarısında, "40 gün önce" biten 4 haftada dışarıda / 8 haftada içeride.
import { describe, it, expect, beforeAll } from "vitest";
import {
  resetDatabase, seedSchool, loginAll, api, createAssignment, recipientOf, submitResult, skipRecipient, allKeys,
} from "./helpers.js";
import { trTodayAsDateOnly } from "../src/quietHours.js";
import { buildSchoolAnalytics } from "../src/routes/adminAnalytics.js";

const DAY = 24 * 60 * 60 * 1000;
const today = trTodayAsDateOnly(new Date());
const daysFromToday = (n) => new Date(today.getTime() + n * DAY).toISOString().slice(0, 10);

// D/Y/B → net oranı r = (D − Y/4) / Q × 100 (Q = D + Y + B).
const answer = (correct, wrong, blank) => ({ correct, wrong, blank });

let w, t, M, F, F2;
beforeAll(async () => {
  await resetDatabase();
  w = await seedSchool(); // 12 × 11. sınıf + 12 × 12. sınıf
  const g11 = w.grade11, g12 = w.grade12;

  // M: TYT Matematik, 11+12 (24 alıcı), dün bitti, 20 soru.
  //  12. sınıf: 10 teslim r = 25, 30, …, 70 (biri 12D/4Y/4B = %55 — Y/4 düşer), 1 KONU pası, 1 kayıt yok.
  //  11. sınıf: 6 teslim (4'ü 8 soruluk — medyana girmez; 2'si %90 ve %100), 3 KONU + 1 ZAMAN pası, 2 kayıt yok.
  M = await createAssignment({ teacher: w.branch, students: [...g11, ...g12], examType: "TYT", subject: "Matematik", topic: "Kurgu: Üslü sayılar", questionCount: 20, scheduledDate: daysFromToday(-5), endDate: daysFromToday(-1), targetMode: "SCHOOL_WIDE" });
  const g12Answers = [answer(5, 0, 15), answer(6, 0, 14), answer(7, 0, 13), answer(8, 0, 12), answer(9, 0, 11), answer(10, 0, 10), answer(12, 4, 4), answer(12, 0, 8), answer(13, 0, 7), answer(14, 0, 6)];
  for (let i = 0; i < 10; i += 1) await submitResult(recipientOf(M, g12[i]), g12Answers[i]);
  await skipRecipient(recipientOf(M, g12[10]), { reason: "KONU" });
  for (let i = 0; i < 4; i += 1) await submitResult(recipientOf(M, g11[i]), answer(8, 0, 0));
  await submitResult(recipientOf(M, g11[4]), answer(18, 0, 2));
  await submitResult(recipientOf(M, g11[5]), answer(20, 0, 0));
  for (let i = 6; i < 9; i += 1) await skipRecipient(recipientOf(M, g11[i]), { reason: "KONU" });
  await skipRecipient(recipientOf(M, g11[9]), { reason: "ZAMAN" });

  // F: AYT Fizik, yalnız 12. sınıf (hedef 12), 20 gün önce bitti — 11 teslim, hepsi %30 (medyan < 35 → "zor gelen").
  F = await createAssignment({ teacher: w.branch, students: g12, examType: "AYT", subject: "Fizik", topic: "Kurgu: Vektörler", questionCount: 20, scheduledDate: daysFromToday(-24), endDate: daysFromToday(-20), targetMode: "SCHOOL_WIDE", targetGrade: 12 });
  for (let i = 0; i < 11; i += 1) await submitResult(recipientOf(F, g12[i]), answer(6, 0, 14));
  // F2: AYT Fizik, hedef 12, dün bitti — 12 teslim, hepsi %50.
  F2 = await createAssignment({ teacher: w.branch, students: g12, examType: "AYT", subject: "Fizik", topic: "Kurgu: Kuvvet", questionCount: 20, scheduledDate: daysFromToday(-4), endDate: daysFromToday(-1), targetMode: "SCHOOL_WIDE", targetGrade: 12 });
  for (let i = 0; i < 12; i += 1) await submitResult(recipientOf(F2, g12[i]), answer(10, 0, 10));

  // Gizlenen: 8 alıcılı okul geneli ödev (k < 10) — satırı da toplamlara katkısı da yok.
  const small = await createAssignment({ teacher: w.branch, students: g12.slice(0, 8), examType: "TYT", subject: "Kimya", topic: "Kurgu: Mol", questionCount: 20, scheduledDate: daysFromToday(-3), endDate: daysFromToday(-1), targetMode: "SCHOOL_WIDE" });
  for (let i = 0; i < 8; i += 1) await submitResult(recipientOf(small, g12[i]), answer(1, 0, 19));

  // Pencere dışı / kapsam dışı:
  await createAssignment({ teacher: w.branch, students: [...g11, ...g12], examType: "TYT", subject: "Türkçe", topic: "Kurgu: Paragraf", questionCount: 20, scheduledDate: daysFromToday(-42), endDate: daysFromToday(-40), targetMode: "SCHOOL_WIDE" });
  await createAssignment({ teacher: w.branch, students: [...g11, ...g12], examType: "TYT", subject: "Biyoloji", topic: "Kurgu: Hücre", questionCount: 20, scheduledDate: daysFromToday(1), endDate: daysFromToday(3), targetMode: "SCHOOL_WIDE" });
  await createAssignment({ teacher: w.branch, students: [...g11, ...g12], examType: "TYT", subject: "Tarih", topic: "Kurgu: Taslak", questionCount: 20, scheduledDate: daysFromToday(-3), endDate: daysFromToday(-1), targetMode: "SCHOOL_WIDE", status: "DRAFT" });
  await createAssignment({ teacher: w.coachA, students: w.studentsOf(w.coachA), examType: "TYT", subject: "Coğrafya", topic: "Kurgu: Koç ödevi", questionCount: 20, scheduledDate: daysFromToday(-3), endDate: daysFromToday(-1) });

  t = await loginAll({ admin: w.admin, coach: w.coachA, branch: w.branch, student: w.grade12[0] });
});

const get = (token, qs = "weeks=4") => api(token).get(`/api/admin/analytics?${qs}`);
const rowOf = (body, id) => body.assignments.find((a) => a.id === id);

describe("GET /api/admin/analytics — yetki", () => {
  it("admin 200; koç, branş öğretmeni ve öğrenci 403; anonim 401", async () => {
    expect((await get(t.admin)).status).toBe(200);
    expect((await get(t.coach)).status).toBe(403);
    expect((await get(t.branch)).status).toBe(403);
    expect((await get(t.student)).status).toBe(403);
    expect((await get(undefined)).status).toBe(401);
  });

  it("geçersiz dönem ya da sınıf 400; parametresiz 8 hafta", async () => {
    expect((await get(t.admin, "weeks=5")).status).toBe(400);
    expect((await get(t.admin, "weeks=4&gradeLevel=10")).status).toBe(400);
    expect((await get(t.admin, "weeks=4&gradeLevel=abc")).status).toBe(400);
    const r = await api(t.admin).get("/api/admin/analytics");
    expect(r.status).toBe(200);
    expect(r.body.window.weeks).toBe(8);
    expect(r.body.weeks).toHaveLength(8);
  });
});

describe("GET /api/admin/analytics — kapsam ve hesap (Tümü, 4 hafta)", () => {
  let body;
  beforeAll(async () => { body = (await get(t.admin)).body; });

  it("yalnızca penceredeki gönderilmiş okul geneli ödevler; 8 alıcılı ödev gizli ve sayılı", () => {
    expect(body.assignments.map((a) => a.subject).sort()).toEqual(["Fizik", "Fizik", "Matematik"]);
    expect(body.hidden).toBe(1);
    expect(body.assignments.some((a) => a.subject === "Kimya")).toBe(false);
    expect(body.subjects.some((s) => s.subject === "Kimya")).toBe(false);
    expect(body.window).toMatchObject({ weeks: 4, to: daysFromToday(0), gradeLevel: null });
    expect(body.weeks).toHaveLength(4);
    // En yeni ödev önce.
    expect(body.assignments[body.assignments.length - 1].id).toBe(F.id);
  });

  it("ödev satırı: katılım, pas sebepleri, kayıt yok, medyan/Q1/Q3 (Q < 10 teslimler hariç)", () => {
    const m = rowOf(body, M.id);
    expect(m).toMatchObject({
      examType: "TYT", subject: "Matematik", topic: "Kurgu: Üslü sayılar", teacher: "Test Branş Öğretmeni", targetGrade: null,
      questionCount: 20, closed: true,
      recipients: 24, submitted: 16, skipped: 5, silent: 3, open: 0,
      skips: { KONU: 4, ZAMAN: 1, KAYNAK: 0, DIGER: 0 },
      participation: 66.7, konuPassRate: 16.7,
      // Geçerli oranlar: 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 90, 100 (8 soruluk 4 teslim girmez).
      n: 12, median: 52.5, q1: 38.8, q3: 66.3,
      flags: [],
    });
    expect(rowOf(body, F.id)).toMatchObject({ recipients: 12, submitted: 11, silent: 1, participation: 91.7, n: 11, median: 30, q1: 30, q3: 30, flags: ["zor"] });
    expect(rowOf(body, F2.id)).toMatchObject({ recipients: 12, submitted: 12, participation: 100, median: 50, flags: [] });
  });

  it("özet: kişi ağırlıklı katılım ve konu pası, ödev medyanlarının medyanı", () => {
    // Σ teslim 16 + 11 + 12 = 39 / Σ alıcı 48; KONU 4 / 48; medyanlar 52,5 · 30 · 50.
    expect(body.summary).toMatchObject({ assignments: 3, recipients: 48, submitted: 39, participation: 81.3, median: 50, konuPassRate: 8.3, flagged: 1 });
  });

  it("ders tablosu ve eğilim (son yarı − ilk yarı)", () => {
    const fizik = body.subjects.find((s) => s.examType === "AYT" && s.subject === "Fizik");
    expect(fizik).toMatchObject({ assignments: 2, recipients: 24, submitted: 23, participation: 95.8, median: 40, konuPassRate: 0, flags: [] });
    expect(fizik.trend).toEqual({ median: 20, participation: 8.3 });
    const mat = body.subjects.find((s) => s.examType === "TYT" && s.subject === "Matematik");
    expect(mat).toMatchObject({ assignments: 1, participation: 66.7, median: 52.5, konuPassRate: 16.7 });
    // Tek yarıda verisi olan derste eğilim yok.
    expect(mat.trend).toEqual({ median: null, participation: null });
  });

  it("haftalık seyir: ISO haftası başına katılım ve medyan", () => {
    const m = rowOf(body, M.id);
    const week = body.weeks.find((x) => x.week === m.week);
    expect(rowOf(body, F2.id).week).toBe(m.week);
    // M + F2: 36 alıcı, 28 teslim; medyanlar 52,5 ve 50.
    expect(week).toMatchObject({ assignments: 2, recipients: 36, submitted: 28, participation: 77.8, median: 51.3 });
    expect(body.weeks.find((x) => x.week === rowOf(body, F.id).week)).toMatchObject({ assignments: 1, participation: 91.7, median: 30 });
    const empty = body.weeks.filter((x) => x.assignments === 0);
    expect(empty.length).toBe(2);
    expect(empty.every((x) => x.participation === null && x.median === null)).toBe(true);
    expect(body.weeks.map((x) => x.week)).toEqual([...body.weeks.map((x) => x.week)].sort());
  });

  it("gizlilik: öğrenci adı, kimliği ya da tekil sonuç hiçbir derinlikte yok", () => {
    const json = JSON.stringify(body);
    expect(json).not.toMatch(/Test Öğrenci/);
    for (const s of w.students) expect(json).not.toContain(s.id);
    for (const r of M.recipients) expect(json).not.toContain(r.id);
    const keys = allKeys(body);
    for (const k of ["studentId", "student", "name", "rates", "correctCount", "wrongCount", "blankCount", "min", "max", "nets", "_median", "_end"]) {
      expect(keys).not.toContain(k);
    }
  });
});

describe("GET /api/admin/analytics — sınıf süzgeci ve pencere", () => {
  it("12. sınıf: hedefsiz ödevde yalnız 12. sınıf alıcıları; 8 kişilik dilim gizli", async () => {
    const { body } = await get(t.admin, "weeks=4&gradeLevel=12");
    expect(body.window.gradeLevel).toBe(12);
    expect(body.hidden).toBe(1);
    expect(rowOf(body, M.id)).toMatchObject({ recipients: 12, submitted: 10, participation: 83.3, konuPassRate: 8.3, silent: 1, n: 10, median: 47.5, q1: 36.3, q3: 58.8 });
    expect(body.assignments).toHaveLength(3);
  });

  it("11. sınıf: hedefi 12 olan ödevler yok; 10'dan az geçerli teslimde medyan verilmez; işaretler", async () => {
    const { body } = await get(t.admin, "weeks=4&gradeLevel=11");
    expect(body.assignments.map((a) => a.id)).toEqual([M.id]);
    // Kimya ödevi 11. sınıfa hiç gitmedi — gizlenen sayılmaz.
    expect(body.hidden).toBe(0);
    const m = rowOf(body, M.id);
    // 6 teslim / 12; KONU 3 / 12; geçerli teslim yalnız 2 (%90, %100) → medyan, Q1, Q3 yok.
    expect(m).toMatchObject({ recipients: 12, submitted: 6, participation: 50, konuPassRate: 25, n: 2, median: null, q1: null, q3: null });
    expect(m.flags.sort()).toEqual(["katilim", "konu"]);
    expect(body.summary).toMatchObject({ assignments: 1, median: null, flagged: 1 });
  });

  it("8 hafta: 40 gün önce biten ödev de girer (kayıt yok 24 → düşük katılım)", async () => {
    const { body } = await get(t.admin, "weeks=8");
    expect(body.assignments).toHaveLength(4);
    const tr = body.assignments.find((a) => a.subject === "Türkçe");
    expect(tr).toMatchObject({ recipients: 24, submitted: 0, silent: 24, participation: 0, median: null, flags: ["katilim"] });
    expect(body.weeks).toHaveLength(8);
    expect(body.summary.flagged).toBe(2);
  });
});

describe("buildSchoolAnalytics (saf hesap, sabit an)", () => {
  // 12 alıcılı sahte ödev: hepsi %50 teslim etti. endDate UTC gece yarısı (sunucunun sakladığı biçim).
  const fake = (id, end, subject = "Matematik") => ({
    id, examType: "TYT", subject, topic: "Kurgu", pageRange: "20 soru", targetGrade: null, teacher: { name: "Test Branş Öğretmeni" },
    scheduledDate: new Date(`${end}T00:00:00.000Z`), endDate: new Date(`${end}T00:00:00.000Z`),
    recipients: Array.from({ length: 12 }, () => ({ completed: true, skippedAt: null, skipReason: null, student: { gradeLevel: 12 }, submission: { correctCount: 10, wrongCount: 0, blankCount: 10 } })),
  });

  it("yıl dönümü: 3 Ocak 2027 Pazar → hafta 2026-W53; pencere o haftanın Pazartesi'sinden geriye", () => {
    const now = new Date("2027-01-03T09:00:00+03:00");
    const out = buildSchoolAnalytics([fake("a", "2027-01-02"), fake("b", "2026-12-20")], { weeks: 4, now });
    expect(out.window).toMatchObject({ from: "2026-12-07", to: "2027-01-03" });
    expect(out.weeks.map((x) => x.week)).toEqual(["2026-W50", "2026-W51", "2026-W52", "2026-W53"]);
    expect(out.assignments.find((a) => a.id === "a").week).toBe("2026-W53");
    expect(out.weeks.find((x) => x.week === "2026-W51")).toMatchObject({ assignments: 1, participation: 100, median: 50 });
  });

  it("bugün biten (açık) ödev: katılım düşük olsa da 'düşük katılım' işareti yok — ne ödevde ne derste", () => {
    const now = new Date("2026-09-23T12:00:00+03:00");
    const a = fake("open", "2026-09-23");
    for (const r of a.recipients) { r.completed = false; r.submission = null; }
    const out = buildSchoolAnalytics([a], { weeks: 4, now });
    expect(out.assignments[0]).toMatchObject({ closed: false, open: 12, silent: 0, participation: 0, flags: [] });
    expect(out.subjects[0].flags).toEqual([]);
    // Ertesi gün kapanmış sayılır → işaret gelir.
    const later = buildSchoolAnalytics([a], { weeks: 4, now: new Date("2026-09-24T09:00:00+03:00") });
    expect(later.assignments[0]).toMatchObject({ closed: true, silent: 12, flags: ["katilim"] });
    expect(later.subjects[0].flags).toEqual(["katilim"]);
  });

  it("fark saldırısı: 'Tümü' − '11. sınıf' 10'dan az kişilik bir grubu vermesin — o dilim de gizlenir", () => {
    const now = new Date("2026-09-23T12:00:00+03:00");
    const withGrades = (id, grades) => {
      const a = fake(id, "2026-09-22");
      a.recipients = grades.map((g, i) => ({ ...a.recipients[0], student: { gradeLevel: g }, completed: i % 2 === 0 }));
      return a;
    };
    // 10 × 11. sınıf + 1 × 12. sınıf: Tümü (11 kişi) görünür; 11. sınıf dilimi (10 kişi) görünseydi fark tek öğrenciyi verirdi.
    const one = withGrades("one", [...Array(10).fill(11), 12]);
    // 12 × 11 + 12 × 12 + 2 sınıfı boş: iki süzgeç birlikte (Tümü − 11 − 12) 2 kişiyi verirdi → iki dilim de gizli.
    const nulls = withGrades("nulls", [...Array(12).fill(11), ...Array(12).fill(12), null, null]);
    // 12 × 11 + 12 × 12: her grup ≥ 10 → iki dilim de görünür.
    const ok = withGrades("ok", [...Array(12).fill(11), ...Array(12).fill(12)]);
    const all = buildSchoolAnalytics([one, nulls, ok], { weeks: 4, now });
    expect(all.assignments.map((a) => a.id).sort()).toEqual(["nulls", "ok", "one"]);
    expect(all.hidden).toBe(0);
    const g11 = buildSchoolAnalytics([one, nulls, ok], { weeks: 4, gradeLevel: 11, now });
    expect(g11.assignments.map((a) => a.id)).toEqual(["ok"]);
    expect(g11.hidden).toBe(2);
    expect(g11.summary).toMatchObject({ assignments: 1, recipients: 12 });
    const g12 = buildSchoolAnalytics([one, nulls, ok], { weeks: 4, gradeLevel: 12, now });
    // "one"ın 12. sınıf dilimi 1 kişi (< 10) → gizli; "nulls" sınıfı boş 2 kişi yüzünden gizli.
    expect(g12.assignments.map((a) => a.id)).toEqual(["ok"]);
    expect(g12.hidden).toBe(2);
  });

  it("haftanın her günü: dün biten son yarıda, 20 gün önce biten ilk yarıda (eğilim hesaplanır)", () => {
    for (let d = 0; d < 7; d += 1) {
      const now = new Date(Date.UTC(2026, 8, 21 + d, 9)); // 21 Eylül 2026 Pazartesi … 27 Eylül Pazar, 12:00 TR
      const ymd = (n) => new Date(Date.UTC(2026, 8, 21 + d + n)).toISOString().slice(0, 10);
      const out = buildSchoolAnalytics([fake("early", ymd(-20)), fake("late", ymd(-1))], { weeks: 4, now });
      expect(out.assignments).toHaveLength(2);
      // İki yarıda da veri var → eğilim null değil (ikisi de %50: fark 0).
      expect(out.subjects[0].trend).toEqual({ median: 0, participation: 0 });
    }
  });
});
