import { describe, it, expect } from "vitest";
import { buildNarrative } from "../src/narrative/index.js";
import { FORBIDDEN } from "../src/narrative/text.js";
import { STUDENT_FORBIDDEN } from "../src/narrative/phrases-student/index.js";
import { makeFixture, FIXTURE_NOW } from "./fixtures/reportFixture.js";

const texts = (n) => [n.ozet, ...n.gucluYonler, ...n.gelisimAlanlari.flatMap((g) => [g.alan, g.kanit, g.oneri]), ...n.kocaOneriler, n.ogrenciyleKonusma, ...n.dikkat].filter(Boolean);
const withId = (raw, id) => ({ ...raw, student: { ...raw.student, id } });

describe("otomatik aylık değerlendirme", () => {
  const rich = makeFixture({ weeks: 20 });

  it("dolu veride tüm bölümler oluşur ve önceki aylar analize girer", () => {
    const n = buildNarrative(rich, { month: "2026-10", now: FIXTURE_NOW });
    expect(n.veriYeterliligi).toBe("yeterli");
    expect(n.ozet.split(/[.!?]\s/).length).toBeGreaterThanOrEqual(2);
    expect(n.gucluYonler.length).toBeGreaterThanOrEqual(2);
    expect(n.gelisimAlanlari.length).toBeGreaterThanOrEqual(2);
    expect(n.kocaOneriler.length).toBeGreaterThanOrEqual(2);
    expect(n.ogrenciyleKonusma.length).toBeGreaterThan(20);
    expect(n.seyir.length).toBeGreaterThanOrEqual(3); // Ekim + önceki aylar
    expect(n.seyir[n.seyir.length - 1].month).toBe("2026-10");
    expect(n.aylar).toBeGreaterThanOrEqual(3);
  });

  it("aynı öğrenci ve ay için her seferinde aynı metin", () => {
    const a = buildNarrative(rich, { month: "2026-10", now: FIXTURE_NOW });
    const b = buildNarrative(rich, { month: "2026-10", now: FIXTURE_NOW });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("farklı öğrencilerde (aynı veride bile) ifadeler çeşitlenir", { timeout: 30000 }, () => {
    const outs = Array.from({ length: 16 }, (_, i) => buildNarrative(withId(rich, `ogr-${i}`), { month: "2026-10", now: FIXTURE_NOW }));
    const ozetler = new Set(outs.map((n) => n.ozet));
    const konusmalar = new Set(outs.map((n) => n.ogrenciyleKonusma));
    const kanitlar = new Set(outs.flatMap((n) => n.gelisimAlanlari.map((g) => g.kanit)));
    expect(ozetler.size).toBeGreaterThanOrEqual(12);
    expect(konusmalar.size).toBeGreaterThanOrEqual(12);
    expect(kanitlar.size).toBeGreaterThanOrEqual(10);
  });

  it("aynı öğrencide aylar arasında metin değişir", () => {
    const eyl = buildNarrative(rich, { month: "2026-09", now: FIXTURE_NOW });
    const eki = buildNarrative(rich, { month: "2026-10", now: FIXTURE_NOW });
    expect(eyl.ozet).not.toBe(eki.ozet);
  });

  it("bir değerlendirmede aynı cümle tekrar etmez", { timeout: 30000 }, () => {
    for (let i = 0; i < 12; i++) {
      const t = texts(buildNarrative(withId(rich, `t${i}`), { month: "2026-10", now: FIXTURE_NOW }));
      expect(new Set(t).size).toBe(t.length);
    }
  });

  it("hiçbir metinde tanımsız değer ya da yasak kelime yok (çok sayıda varyasyon)", { timeout: 60000 }, () => {
    for (const seed of [1, 2, 3, 7, 42, 99]) {
      const raw = makeFixture({ seed, weeks: 20 });
      for (const month of ["2026-08", "2026-09", "2026-10", "2026-11"]) {
        for (let i = 0; i < 3; i++) {
          const n = buildNarrative(withId(raw, `s${seed}-${i}`), { month, now: FIXTURE_NOW });
          for (const s of texts(n)) {
            expect(s).not.toMatch(/undefined|NaN|null|\[object/);
            expect(s).not.toMatch(FORBIDDEN);
          }
        }
      }
    }
  });

  it("süren ayda önceki tam ayla hacim düşüşü uyarısı verilmez", () => {
    const n = buildNarrative(rich, { month: "2026-11", now: new Date("2026-11-12T12:00:00Z") });
    expect(n.dikkat.join(" ")).not.toMatch(/Ekim/);
    expect(n.seyir[n.seyir.length - 1].suruyor).toBe(true);
  });

  it("az veride 'veri yetersiz' ve yine anlamlı bir özet", () => {
    const n = buildNarrative(makeFixture({ sparse: true, weeks: 1 }), { month: "2026-11", now: FIXTURE_NOW });
    expect(n.veriYeterliligi).toBe("yetersiz");
    expect(n.ozet.length).toBeGreaterThan(10);
  });

  it("hiç verisi olmayan öğrencide çökmez", () => {
    const n = buildNarrative({ viewer: "coach", student: { id: "bos" }, items: [], sessions: [] }, { month: "2026-11", now: FIXTURE_NOW });
    expect(n.veriYeterliligi).toBe("yetersiz");
    expect(Array.isArray(n.gucluYonler)).toBe(true);
  });
});

// Öğrenci sürümü ("Ayın değerlendirmesi", audience: "student"): aynı olgular, "sen" dili, koça özel bölüm yok.
describe("öğrencinin aylık değerlendirmesi", () => {
  const studentTexts = (n) => [n.ozet, ...n.gucluYonler, ...n.gelisimAlanlari.flatMap((g) => [g.alan, g.kanit, g.oneri]), ...n.sonrakiAdimlar].filter(Boolean);
  const sentences = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);
  const rich = makeFixture({ weeks: 20, viewer: "student" });
  const opts = (month = "2026-10") => ({ month, now: FIXTURE_NOW, audience: "student" });

  it("dolu veride: özet 2–3 cümle, güçlü yönler, gelişim alanları ve 2–4 sonraki adım", () => {
    const n = buildNarrative(rich, opts());
    expect(n.audience).toBe("student");
    expect(n.veriYeterliligi).toBe("yeterli");
    expect(sentences(n.ozet).length).toBeGreaterThanOrEqual(2);
    expect(sentences(n.ozet).length).toBeLessThanOrEqual(3);
    expect(n.gucluYonler.length).toBeGreaterThanOrEqual(2);
    expect(n.gelisimAlanlari.length).toBeGreaterThanOrEqual(1);
    expect(n.sonrakiAdimlar.length).toBeGreaterThanOrEqual(2);
    expect(n.sonrakiAdimlar.length).toBeLessThanOrEqual(4);
  });

  it("koça özel bölümler yok (koça öneriler, görüşme, dikkat, durum çipi)", () => {
    const n = buildNarrative(rich, opts());
    for (const k of ["kocaOneriler", "ogrenciyleKonusma", "dikkat", "seyir"]) expect(n, k).not.toHaveProperty(k);
    expect(studentTexts(n).join(" ")).not.toMatch(/müdahale|takip et|koça|görüşme/i);
  });

  it("koç görünümündeki veriyle de (koça özel alanlar dahil) koça özel bir şey sızmaz", () => {
    const coachRaw = makeFixture({ weeks: 20 });
    const n = buildNarrative(coachRaw, opts());
    for (const s of studentTexts(n)) {
      expect(s).not.toMatch(STUDENT_FORBIDDEN);
      expect(s).not.toMatch(/sessiz/i);
    }
  });

  it("aynı öğrenci ve ay için her seferinde aynı metin; koç metninden farklı", () => {
    const a = buildNarrative(rich, opts());
    const b = buildNarrative(rich, opts());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const coach = buildNarrative(rich, { month: "2026-10", now: FIXTURE_NOW });
    expect(a.ozet).not.toBe(coach.ozet);
  });

  it("farklı öğrencilerde ifadeler çeşitlenir, bir değerlendirmede cümle tekrar etmez", { timeout: 30000 }, () => {
    const outs = Array.from({ length: 12 }, (_, i) => buildNarrative(withId(rich, `ogr-${i}`), opts()));
    expect(new Set(outs.map((n) => n.ozet)).size).toBeGreaterThanOrEqual(9);
    expect(new Set(outs.flatMap((n) => n.sonrakiAdimlar)).size).toBeGreaterThanOrEqual(8);
    for (const n of outs) {
      const t = studentTexts(n);
      expect(new Set(t).size).toBe(t.length);
    }
  });

  it("hiçbir metinde tanımsız değer, yasak kelime, koç terimi ya da olumsuz başlık yok (çok sayıda varyasyon)", { timeout: 60000 }, () => {
    for (const seed of [1, 2, 3, 7, 42, 99]) {
      const raw = makeFixture({ seed, weeks: 20, viewer: "student" });
      for (const month of ["2026-08", "2026-09", "2026-10", "2026-11"]) {
        for (let i = 0; i < 3; i++) {
          const n = buildNarrative(withId(raw, `s${seed}-${i}`), opts(month));
          expect(sentences(n.ozet).length).toBeLessThanOrEqual(3);
          expect(n.sonrakiAdimlar.length).toBeGreaterThanOrEqual(2);
          expect(n.sonrakiAdimlar.length).toBeLessThanOrEqual(4);
          for (const s of studentTexts(n)) {
            expect(s).not.toMatch(/undefined|NaN|null|\[object/);
            expect(s).not.toMatch(FORBIDDEN);
            expect(s).not.toMatch(STUDENT_FORBIDDEN);
            expect(s).not.toMatch(/sessiz|medyan|yüzdelik|alt çeyrek/i);
          }
          for (const g of n.gelisimAlanlari) expect(g.alan).not.toMatch(/düşüş|düştü|kayıp|kaybı|eksik|sorun|yetersiz|gerile/i);
        }
      }
    }
  });

  it("az veride davet eden bir özet; hiç verisi olmayan öğrencide çökmez ve yine 2 adım önerir", () => {
    const az = buildNarrative(makeFixture({ sparse: true, weeks: 1, viewer: "student" }), opts("2026-11"));
    expect(az.veriYeterliligi).toBe("yetersiz");
    expect(sentences(az.ozet).length).toBeGreaterThanOrEqual(2);
    const bos = buildNarrative({ viewer: "student", student: { id: "bos" }, items: [], sessions: [] }, opts("2026-11"));
    expect(bos.veriYeterliligi).toBe("yetersiz");
    expect(bos.gucluYonler).toEqual([]);
    expect(bos.sonrakiAdimlar.length).toBe(2);
    expect(bos.ozet.length).toBeGreaterThan(20);
  });
});
