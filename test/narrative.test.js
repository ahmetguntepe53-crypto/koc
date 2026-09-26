import { describe, it, expect } from "vitest";
import { buildNarrative } from "../src/narrative/index.js";
import { FORBIDDEN } from "../src/narrative/text.js";
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
