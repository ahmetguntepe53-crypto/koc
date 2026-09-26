import { describe, it, expect } from "vitest";
import { buildReport, aggregate, matchTopic, topicParts, fmtPct, fmtDec, fmtInt, fmtNet, isRecHidden, recHideKey, trDay } from "../src/reportModel.js";
import { makeFixture, FIXTURE_NOW } from "./fixtures/reportFixture.js";

const NOW = new Date("2026-11-20T12:00:00Z");
const DAY = 864e5;
const dayIso = (daysAgo) => new Date(Math.floor((NOW.getTime() + 3 * 3600e3) / DAY) * DAY - daysAgo * DAY).toISOString();
const at = (daysAgo, hour = 15) => new Date(Math.floor((NOW.getTime() + 3 * 3600e3) / DAY) * DAY - daysAgo * DAY + (hour - 3) * 3600e3).toISOString();

let seq = 0;
function item(o = {}) {
  seq += 1;
  const done = o.correct != null;
  return {
    id: `i${seq}`, assignmentId: `a${seq}`, examType: o.examType || "TYT", subject: o.subject || "Matematik", topic: o.topic || "Mutlak Değer", sourceBook: "Kitap",
    source: o.source || "branch", teacher: "Ada Hoca", expected: o.expected ?? null, scheduledDate: dayIso((o.endAgo ?? 3) + 2), endDate: dayIso(o.endAgo ?? 3), completed: done, completedAt: done ? at(o.doneAgo ?? o.endAgo ?? 3) : null,
    skippedAt: o.skipAgo != null ? at(o.skipAgo) : null, skipReason: o.skipReason ?? null, reminderAt: null,
    correct: o.correct ?? null, wrong: o.wrong ?? null, blank: o.blank ?? null, questionNumbers: [], school: o.school ?? null, konuSkipRate: null,
    ...o.extra,
  };
}
function session(o = {}) {
  seq += 1;
  return { id: `s${seq}`, examType: o.examType || "TYT", subject: o.subject || "Türkçe", topic: o.topic || "Paragrafta Anlam", sourceBook: null, date: at(o.ago ?? 1), correct: o.c, wrong: o.w, blank: o.b, questionNumbers: [] };
}
const raw = (items = [], sessions = [], extra = {}) => ({
  viewer: "coach", student: { id: "s", name: "Test Kurgu", className: "12-A", gradeLevel: 12, createdAt: dayIso(200), coach: "Koç", lastSeenAt: at(1) },
  yksExamDate: "2027-06-19T00:00:00.000Z", items, sessions, ...extra,
});

describe("biçim", () => {
  it("Türkçe sayı biçimi", () => {
    expect(fmtPct(58.4)).toBe("%58");
    expect(fmtPct(-12.2)).toBe("−%12");
    expect(fmtDec(12.75, 2)).toBe("12,75");
    expect(fmtInt(1250)).toBe("1.250");
    expect(fmtNet(38)).toBe("38");
    expect(fmtNet(6.25)).toBe("6,25");
  });
});

describe("net oranı (w = min(Q, 40))", () => {
  it("200 soruluk tek set dersi belirleyemez", () => {
    const recs = [
      { Q: 200, D: 180, Y: 0, B: 20, r: 90, w: 40, week: 1 },
      { Q: 20, D: 2, Y: 0, B: 18, r: 10, w: 20, week: 2 },
      { Q: 20, D: 2, Y: 0, B: 18, r: 10, w: 20, week: 2 },
      { Q: 20, D: 2, Y: 0, B: 18, r: 10, w: 20, week: 3 },
    ];
    const a = aggregate(recs);
    expect(Math.round(a.NO)).toBe(42); // (40·90 + 60·10) / 100
    expect(a.Q).toBe(260);
    expect(a.lost).toBeCloseTo(1.25 * 0 + 74);
  });
  it("Q ≤ 40 kayıtlarda ΣNet/ΣQ ile aynı", () => {
    const a = aggregate([{ Q: 40, D: 30, Y: 8, B: 2, r: (28 / 40) * 100, w: 40, week: 1 }, { Q: 40, D: 20, Y: 4, B: 16, r: (19 / 40) * 100, w: 40, week: 1 }]);
    expect(a.NO).toBeCloseTo(((28 + 19) / 80) * 100);
  });
});

describe("konu eşleşmesi", () => {
  it("önek, parça numarası ve parantez atılır", () => {
    expect(topicParts("1. Bölüm: Gerçek Sayılar - 1 (Temel Kavramlar)")).toMatchObject({ main: "Gerçek Sayılar", paren: "Temel Kavramlar" });
    expect(topicParts("Sinir Sistemi: Nöron, İmpuls").head).toBe("Sinir Sistemi");
  });
  it("kanonik listeye eşler, eşleşmeyen kendi başlığıyla ~ olur", () => {
    expect(matchTopic("TYT", "Matematik", "Mutlak Değer")).toMatchObject({ key: "Mutlak Değer", approx: false });
    expect(matchTopic("TYT", "Matematik", "2. Bölüm: Mutlak Değer - 2")).toMatchObject({ key: "Mutlak Değer" });
    expect(matchTopic("TYT", "Matematik", "1. Bölüm: Gerçek Sayılar - 1 (Temel Kavramlar)").key).toBe("Sayılar");
    expect(matchTopic("TYT", "Matematik", "Tek-Çift Sayılar").key).toBe("Sayılar");
    expect(matchTopic("TYT", "Matematik", "7. Bölüm: Yaş Problemleri").key).toBe("Problemler");
    expect(matchTopic("AYT", "Biyoloji", "Sinir Sistemi: Nöron, İmpuls, Sinapslar").key).toBe("Sinir Sistemi");
    expect(matchTopic("TYT", "Fizik", "Elektrostatik").key).toBe("Elektrik");
    const u = matchTopic("TYT", "Fizik", "Karma Deneme Seti");
    expect(u.unmatched).toBe(true);
    expect(u.approx).toBe(true);
    expect(u.name).toBe("Karma Deneme Seti");
  });
});

describe("etiketler", () => {
  it("asgari örneklem yoksa Veri az", () => {
    const m = buildReport(raw([item({ correct: 30, wrong: 5, blank: 5, endAgo: 2 })]), { now: NOW });
    const s = m.subjectMap.get("TYT|Matematik");
    expect(s.label).toBe("few");
    expect(s.reason.student).toMatch(/Veri az/);
  });
  it("65 / 40 eşikleri ve okul düzeltmesi en fazla bir kademe", () => {
    const hi = [2, 9, 16].map((d) => item({ correct: 36, wrong: 2, blank: 2, endAgo: d }));
    const lo = [2, 9, 16].map((d) => item({ subject: "Fizik", topic: "Optik", correct: 10, wrong: 10, blank: 20, endAgo: d, school: { n: 20, recipients: 25, participation: 80, median: 15, q1: 5, q3: 25, pct: 70, scope: "grade" } }));
    const m = buildReport(raw([...hi, ...lo]), { now: NOW });
    expect(m.subjectMap.get("TYT|Matematik").label).toBe("strong");
    const f = m.subjectMap.get("TYT|Fizik");
    expect(f.base).toBe("focus");
    expect(f.label).toBe("ok"); // P̃ 70 ≥ 60 → Odak'tan Yolunda'ya
    expect(f.reason.coach).toMatch(/ödevler herkese zor gelmiş/);
  });
  it("iki çözülmemiş KONU pası dersi Odak yapar", () => {
    const items = [
      item({ subject: "Kimya", topic: "Gazlar", skipAgo: 3, skipReason: "KONU", endAgo: 3 }),
      item({ subject: "Kimya", topic: "Karışımlar", skipAgo: 5, skipReason: "KONU", endAgo: 5 }),
    ];
    const m = buildReport(raw(items), { now: NOW });
    const k = m.subjectMap.get("TYT|Kimya");
    expect(k.label).toBe("focus");
    expect(k.fromKonu).toBe(true);
    expect(m.recs.all.some((r) => r.id === "R03" && r.subjectKey === "TYT|Kimya")).toBe(true);
    expect(m.recs.all.some((r) => r.id === "R07" && r.subjectKey === "TYT|Kimya")).toBe(false);
  });
});

describe("trend anlamlılığı", () => {
  it("belirgin artış Yükselişte, küçük fark Sabit", () => {
    const w0 = [30, 36, 42, 48].map((d) => item({ correct: 16, wrong: 8, blank: 16, endAgo: d }));
    const w1 = [2, 8, 14, 20].map((d) => item({ correct: 32, wrong: 4, blank: 4, endAgo: d }));
    const m = buildReport(raw([...w0, ...w1]), { now: NOW });
    const t = m.subjectMap.get("TYT|Matematik").trend;
    expect(t.enough).toBe(true);
    expect(t.dir).toBe("up");
    expect(m.recs.all.some((r) => r.id === "K01")).toBe(true);
    const same = [30, 36, 42, 48, 2, 8, 14, 20].map((d) => item({ correct: 20, wrong: 8, blank: 12, endAgo: d }));
    expect(buildReport(raw(same), { now: NOW }).subjectMap.get("TYT|Matematik").trend.dir).toBe("flat");
  });
  it("okul geneli de düştüyse düşüş Sabit sayılır", () => {
    const sc = (median) => ({ n: 20, recipients: 25, participation: 80, median, q1: median - 10, q3: median + 10, pct: 50, scope: "grade" });
    const w0 = [30, 36, 42, 48].map((d) => item({ correct: 32, wrong: 4, blank: 4, endAgo: d, school: sc(70) }));
    const w1 = [2, 8, 14, 20].map((d) => item({ correct: 16, wrong: 8, blank: 16, endAgo: d, school: sc(30) }));
    const t = buildReport(raw([...w0, ...w1]), { now: NOW }).subjectMap.get("TYT|Matematik").trend;
    expect(t.rawDir).toBe("down");
    expect(t.dir).toBe("flat");
    expect(t.note).toMatch(/okul geneli de düştü/);
  });
});

describe("kayıtlar", () => {
  it("aynı gün aynı D/Y/B serbest çalışma çift sayılmaz", () => {
    const it1 = item({ subject: "Türkçe", topic: "Paragrafta Anlam", correct: 30, wrong: 5, blank: 5, endAgo: 1, doneAgo: 1 });
    const m = buildReport(raw([it1], [session({ ago: 1, c: 30, w: 5, b: 5 }), session({ ago: 2, c: 20, w: 2, b: 2 })]), { now: NOW });
    expect(m.totalRecords).toBe(2);
  });
  it("pas ve sessiz ayrı durumlar; açık ödev orana girmez", () => {
    const items = [
      item({ correct: 30, wrong: 5, blank: 5, endAgo: 5, doneAgo: 6 }),
      item({ correct: 30, wrong: 5, blank: 5, endAgo: 5, doneAgo: 3 }),
      item({ skipAgo: 4, skipReason: "ZAMAN", endAgo: 4 }),
      item({ endAgo: 4 }),
      item({ endAgo: -3 }),
    ];
    const d = buildReport(raw(items), { now: NOW }).discipline.total;
    expect(d).toMatchObject({ V: 4, onTime: 1, late: 1, skip: 1, silent: 1 });
    expect(d.deliveredPct).toBe(50);
    expect(d.handledPct).toBe(75);
  });
});

describe("öneri motoru", () => {
  it("az veride R00 ve bastırılan öneriler üretilmez", () => {
    const m = buildReport(makeFixture({ sparse: true, weeks: 1 }), { now: FIXTURE_NOW });
    const ids = m.recs.all.map((r) => r.id);
    expect(ids).toContain("R00");
    for (const x of ["R07", "R09", "R10", "R11", "R12", "R13", "R14", "R19", "R20", "K01", "K02", "K03", "K04", "K09"]) expect(ids).not.toContain(x);
  });
  it("sessiz ödev R01 üretir; R05 varsa öğrenciye R01, koça R05 gösterilir", () => {
    const items = [
      ...[3, 4, 5, 6].map((d) => item({ endAgo: d })),
      item({ correct: 30, wrong: 5, blank: 5, endAgo: 7 }),
      item({ correct: 30, wrong: 5, blank: 5, endAgo: 8 }),
    ];
    const m = buildReport(raw(items), { now: NOW });
    expect(m.recs.all.map((r) => r.id)).toEqual(expect.arrayContaining(["R01", "R05"]));
    expect(m.recs.studentAll.some((r) => r.id === "R05")).toBe(false);
    expect(m.recs.coachAll.some((r) => r.id === "R01")).toBe(false);
    expect(m.recs.coachAll.find((r) => r.id === "R05").text.coach).toMatch(/Açık ödevler:/);
    expect(m.coach.status).toBe("intervene");
  });
  it("öğrenci en fazla 3 kart: en fazla 1 kutlama + en fazla 2 diğer; kutlama engeli bastırmaz", () => {
    const items = [
      item({ subject: "Kimya", topic: "Gazlar", skipAgo: 3, skipReason: "KONU", endAgo: 3 }),
      item({ subject: "Kimya", topic: "Karışımlar", skipAgo: 5, skipReason: "KONU", endAgo: 5 }),
      item({ subject: "Fizik", topic: "Optik", skipAgo: 6, skipReason: "KAYNAK", endAgo: 6 }),
      item({ subject: "Tarih", topic: "Türkiye Tarihi", endAgo: 4 }),
    ];
    const m = buildReport(raw(items), { now: NOW });
    expect(m.recs.student.filter((r) => r.type !== "kutlama").length).toBeLessThanOrEqual(2);
    for (const seed of [1, 7, 42, 99]) {
      const f = buildReport(makeFixture({ seed, viewer: "student" }), { now: FIXTURE_NOW });
      expect(f.recs.student.filter((r) => r.type !== "kutlama").length).toBeLessThanOrEqual(2);
      // Her ders için en yüksek öncelikli kart kutlama yüzünden düşmez.
      const top = f.recs.studentAll.filter((r) => r.type !== "kutlama")[0];
      if (top) expect(f.recs.student).toContain(top);
    }
  });
  it("öğrenciye koç kanıtı ve 50 altı yüzdelik gösterilmez (R07/R10)", () => {
    const sc = { n: 20, recipients: 25, participation: 80, median: 60, q1: 50, q3: 70, pct: 12, scope: "grade" };
    const items = [2, 9, 16, 23].map((d) => item({ correct: 14, wrong: 10, blank: 16, endAgo: d, school: sc }));
    const m = buildReport(raw(items), { now: NOW });
    const recs = m.recs.all.filter((r) => r.id === "R07" || r.id === "R10");
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) expect(r.evidenceStudent).not.toMatch(/yüzdelik|çeyrek/);
  });
  it("R00 seçili pencerenin kayıtlarına bakar", () => {
    const old = [40, 44, 48, 52].map((d) => item({ subject: "Türkçe", topic: "Paragrafta Anlam", correct: 34, wrong: 3, blank: 3, endAgo: d }));
    const m = buildReport(raw([...old, item({ subject: "Türkçe", topic: "Ses Bilgisi", correct: 30, wrong: 5, blank: 5, endAgo: 2 })]), { now: NOW, window: "8w" });
    expect(m.enough).toBe(true);
    expect(m.recs.all.some((r) => r.id === "R00")).toBe(false);
  });
  it("aynı derste iki kaynak pası ayrı kartlar ve ayrı gizleme anahtarı", () => {
    const items = [
      item({ subject: "Fizik", topic: "Optik", skipAgo: 3, skipReason: "KAYNAK", endAgo: 3, extra: { sourceBook: "A Yayınları" } }),
      item({ subject: "Fizik", topic: "Basınç", skipAgo: 4, skipReason: "KAYNAK", endAgo: 4, extra: { sourceBook: "B Yayınları" } }),
    ];
    const r04 = buildReport(raw(items), { now: NOW }).recs.all.filter((r) => r.id === "R04");
    expect(r04).toHaveLength(2);
    expect(new Set(r04.map(recHideKey)).size).toBe(2);
  });
  it("R06 soru sayısı bilinmezse '0 soruluk' demez", () => {
    const items = [item({ skipAgo: 2, skipReason: "ZAMAN", endAgo: 2 }), item({ skipAgo: 5, skipReason: "ZAMAN", endAgo: 5 })];
    const r = buildReport(raw(items), { now: NOW }).recs.all.find((x) => x.id === "R06");
    expect(r.text.student).not.toMatch(/ 0 soruluk/);
  });
  it("K09 yalnızca başka kutlama yoksa", () => {
    for (const seed of [1, 7, 42, 99]) {
      const all = buildReport(makeFixture({ seed }), { now: FIXTURE_NOW }).recs.all;
      if (all.some((r) => r.id === "K09")) expect(all.filter((r) => r.type === "kutlama")).toHaveLength(1);
    }
  });
  it("öğrenci en fazla 3 kart (1 kutlama önde), ders başına 1; koç en fazla 6", () => {
    for (const seed of [1, 7, 42, 99]) {
      const m = buildReport(makeFixture({ seed }), { now: FIXTURE_NOW });
      expect(m.recs.student.length).toBeLessThanOrEqual(3);
      expect(m.recs.student.filter((r) => r.type === "kutlama").length).toBeLessThanOrEqual(1);
      if (m.recs.student.some((r) => r.type === "kutlama")) expect(m.recs.student[0].type).toBe("kutlama");
      const subj = m.recs.student.map((r) => r.subjectKey).filter(Boolean);
      expect(new Set(subj).size).toBe(subj.length);
      expect(m.recs.coach.length).toBeLessThanOrEqual(6);
      expect(m.recs.coach.filter((r) => r.type === "kutlama").length).toBeLessThanOrEqual(2);
      expect(m.recs.pdfCoach.length).toBeLessThanOrEqual(10);
    }
  });
  it("yasak kelimeler hiçbir metinde yok; öğrenci başlığı olumsuz değil", () => {
    const bad = /zayıf|kötü|başarısız|geride|tembel|hile/i;
    for (const seed of [1, 2, 3, 42]) for (const w of ["4w", "8w", "all", "month:2026-10"]) {
      const m = buildReport(makeFixture({ seed }), { now: FIXTURE_NOW, window: w });
      for (const r of m.recs.all) {
        expect(r.text.student || "").not.toMatch(bad);
        expect(r.text.coach || "").not.toMatch(bad);
      }
      for (const s of m.subjects) {
        expect(s.reason.student).not.toMatch(bad);
        expect(s.reason.coach).not.toMatch(bad);
      }
      expect(m.week.headline).not.toMatch(/kaçırdın|yapmadın|çalışmadın/);
    }
  });
  it("gizlenen kart kanıt sayısı artınca geri gelir", () => {
    const rec = { id: "R01", subjectKey: "TYT|Matematik", topic: "x", evidenceCount: 2 };
    const store = { [recHideKey(rec)]: { until: Date.now() + DAY, count: 2 } };
    expect(isRecHidden(rec, store)).toBe(true);
    expect(isRecHidden({ ...rec, evidenceCount: 3 }, store)).toBe(false);
  });
});

describe("gizlilik ve bölümler", () => {
  it("öğrenci görünümünde okul satırı 50 altı yüzdelik göstermez", () => {
    const sc = { n: 20, recipients: 25, participation: 80, median: 60, q1: 50, q3: 70, pct: 20, scope: "grade" };
    const items = [2, 9, 16].map((d) => item({ correct: 16, wrong: 8, blank: 16, endAgo: d, school: sc }));
    const s = buildReport({ ...raw(items), viewer: "student" }, { now: NOW }).subjectMap.get("TYT|Matematik");
    expect(s.schoolLine.student).toMatch(/Okul medyanına \d+ puan/);
    expect(s.schoolLine.student).not.toMatch(/yüzdelik/);
    expect(s.reason.student).not.toMatch(/yüzdelik/);
  });
  it("tüm pencereler hatasız hesaplanır ve TR günü doğru", () => {
    expect(trDay("2026-09-21T20:59:00Z")).toBe(trDay("2026-09-21T00:00:00Z"));
    expect(trDay("2026-09-21T21:00:00Z")).toBe(trDay("2026-09-22T00:00:00Z"));
    for (const w of ["4w", "8w", "all", "month:2026-10", "month:2026-11"]) {
      const m = buildReport(makeFixture({ viewer: "student" }), { now: FIXTURE_NOW, window: w });
      expect(m.subjects.length).toBeGreaterThan(0);
      expect(m.trend.TYT.weeks).toHaveLength(12);
    }
  });
});
