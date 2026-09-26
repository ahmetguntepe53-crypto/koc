// Deneme sınavları — istemci modeli (src/practiceExams.js > buildDenemeler, reportModel.js > model.denemeler), sunucuyla
// düzen eşliği ve otomatik değerlendirme olguları (ozet.deneme, guclu.deneme, gelisim.denemeDers). Veriler kurgusal.
import { describe, it, expect } from "vitest";
import { buildReport, monthWindowKey } from "../src/reportModel.js";
import { buildDenemeler, DENEME_LAYOUT, DENEME_TOTAL, aytSubjectsForField, denemeLabel, denemeMax } from "../src/practiceExams.js";
import { PRACTICE_EXAM_LAYOUT } from "../server/src/practiceExams.js";
import { buildNarrative, extractFacts } from "../src/narrative/index.js";
import { FORBIDDEN } from "../src/narrative/text.js";
import { makeFixture, FIXTURE_NOW } from "./fixtures/reportFixture.js";

// Sunucu yanıtı biçiminde (full-report > practiceExams) kurgusal deneme: ex("2026-11-15", { Türkçe: [D, Y, B] }).
let seq = 0;
const ex = (date, subjects, { examType = "TYT", name = null, byStudent = true, canEdit = true } = {}) => ({
  id: `d${++seq}`, examType, date: `${date}T00:00:00.000Z`, name, byStudent, canEdit, createdAt: `${date}T15:00:00.000Z`,
  results: Object.entries(subjects).map(([subject, [correct, wrong, blank]]) => ({ subject, correct, wrong, blank })),
});
// FIXTURE_NOW = 20 Kasım 2026. TYT: 39 → 42,5 → 41,5 → 46,75 → 51 (son üçü art arda yükseliyor, sonuncusu rekor).
const EXAMS = () => [
  ex("2026-09-20", { Türkçe: [28, 8, 4], Matematik: [12, 6, 12], Fizik: [3, 2, 2] }),
  ex("2026-10-11", { Türkçe: [30, 6, 4], Matematik: [13, 6, 11], Fizik: [3, 2, 2] }),
  ex("2026-10-26", { Türkçe: [30, 8, 2], Matematik: [12, 8, 10], Fizik: [4, 2, 1] }),
  ex("2026-11-08", { Türkçe: [32, 6, 2], Matematik: [14, 6, 10], Fizik: [4, 1, 2] }, { byStudent: false, canEdit: false }),
  ex("2026-11-15", { Türkçe: [33, 5, 2], Matematik: [16, 6, 8], Fizik: [5, 1, 1] }, { name: "Kurgu Yayınları TYT-5" }),
  ex("2026-11-01", { Matematik: [10, 5, 15], Geometri: [4, 2, 4], Fizik: [5, 3, 6] }, { examType: "AYT" }),
];
const withExams = (raw, exams = EXAMS()) => ({ ...raw, practiceExams: exams });

describe("düzen (resmî soru sayıları)", () => {
  it("istemci ve sunucu düzeni birebir aynı; TYT 120, AYT 160 soru", () => {
    for (const e of ["TYT", "AYT"]) {
      expect(DENEME_LAYOUT[e].map((x) => [x.subject, x.max])).toEqual(PRACTICE_EXAM_LAYOUT[e]);
      expect(DENEME_LAYOUT[e].reduce((s, x) => s + x.max, 0)).toBe(DENEME_TOTAL[e]);
    }
    expect(denemeMax("TYT", "Matematik")).toBe(30);
    expect(denemeMax("AYT", "Felsefe")).toBe(12);
    expect(denemeMax("AYT", "Mantık")).toBeNull();
    expect(denemeLabel("AYT", "Felsefe")).toBe("Felsefe Grubu");
    expect(denemeLabel("TYT", "Felsefe")).toBe("Felsefe");
  });

  it("AYT ön seçimi alanın dersleri (Mantık/Psikoloji/Sosyoloji → Felsefe Grubu); alan yoksa ya da DİL ise hepsi", () => {
    expect(aytSubjectsForField("SAY")).toEqual(["Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji"]);
    expect(aytSubjectsForField("EA")).toEqual(["Edebiyat", "Tarih-1", "Coğrafya-1", "Matematik", "Geometri"]);
    expect(aytSubjectsForField("SOZ")).toEqual(["Edebiyat", "Tarih-1", "Coğrafya-1", "Tarih-2", "Coğrafya-2", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"]);
    expect(aytSubjectsForField("DIL")).toHaveLength(12);
    expect(aytSubjectsForField(null)).toHaveLength(12);
  });
});

describe("buildDenemeler", () => {
  const today = Math.floor((FIXTURE_NOW.getTime() + 3 * 3600e3) / 864e5);

  it("net = D − Y/4 (gerçek net); dersler kitapçık sırasıyla; boş satır ve düzen dışı ders atlanır", () => {
    const d = buildDenemeler([
      ex("2026-11-02", { Matematik: [20, 4, 6], Türkçe: [30, 6, 4], Kimya: [0, 0, 0], Mantık: [3, 0, 0] }),
    ]);
    const e = d.TYT.last;
    expect(e.subjects.map((s) => s.subject)).toEqual(["Türkçe", "Matematik"]);
    expect(e.subjects.map((s) => s.net)).toEqual([28.5, 19]);
    expect(e).toMatchObject({ net: 47.5, D: 50, Y: 10, B: 10, Q: 70, max: 70 });
    // Hiç geçerli dersi olmayan kayıt (eski/bozuk) listeye girmez.
    expect(buildDenemeler([ex("2026-11-02", { Mantık: [3, 0, 0] })]).all).toBe(0);
    // Eski sunucu yanıtı (alan yok) ya da geçersiz değer: boş model.
    expect(buildDenemeler(undefined)).toMatchObject({ all: 0, count: 0, latestType: "TYT" });
  });

  it("istatistikler pencereden; son, önceki (pencere dışından da), en iyi, son 3 ortalama, eğilim", () => {
    const d = buildDenemeler(EXAMS(), { start: today - 27, end: today, asOf: today });
    const s = d.TYT;
    expect(s.history.map((e) => e.net)).toEqual([39, 42.5, 41.5, 46.75, 51]);
    expect(s.list.map((e) => e.net)).toEqual([41.5, 46.75, 51]); // 24 Eki – 20 Kas
    expect(s.last.net).toBe(51);
    expect(s.prev.net).toBe(46.75);
    expect(s.deltaVsPrev).toBe(4.25);
    expect(s.best.net).toBe(51);
    expect(s.avgLast3).toBeCloseTo((41.5 + 46.75 + 51) / 3);
    expect(s.avgCount).toBe(3);
    expect(s.trend).toMatchObject({ enough: true, dir: "up" });
    expect(s.trend.delta).toBeCloseTo(48.875 - 41.5);
    expect(s.scaleMax).toBe(120);
    expect(d.count).toBe(4); // 3 TYT + 1 AYT
    expect(d.all).toBe(6);
    expect(d.latestType).toBe("TYT");
  });

  it("rekor (en az 3 deneme içinde en yüksek) ve belirgin yükseliş (son 3 deneme düşmeden ≥ 4 net)", () => {
    const s = buildDenemeler(EXAMS(), { start: today - 27, end: today, asOf: today }).TYT;
    expect(s.record).toEqual({ net: 51, prevBest: 46.75, count: 5 });
    expect(s.rise).toMatchObject({ delta: 9.5, values: [41.5, 46.75, 51] });
    // Aradaki bir düşüş (−1 net) yükselişi bozar; rekor ise kalır.
    const dip = buildDenemeler([
      ex("2026-11-01", { Türkçe: [30, 0, 0] }), ex("2026-11-05", { Türkçe: [34, 0, 0] }), ex("2026-11-08", { Türkçe: [33, 0, 0] }), ex("2026-11-12", { Türkçe: [36, 0, 0] }),
    ]).TYT;
    expect(dip.rise).toBeNull();
    expect(dip.record).toMatchObject({ net: 36, prevBest: 34 });
    // Tek ya da iki denemede ne rekor ne eğilim.
    const two = buildDenemeler([ex("2026-11-01", { Türkçe: [30, 0, 0] }), ex("2026-11-05", { Türkçe: [34, 0, 0] })]).TYT;
    expect(two.record).toBeNull();
    expect(two.trend.enough).toBe(false);
  });

  it("ders ders: son / ortalama / en iyi net, soru sayısı, eğilim", () => {
    const s = buildDenemeler(EXAMS(), { start: today - 27, end: today, asOf: today }).TYT;
    expect(s.bySubject.map((r) => r.subject)).toEqual(["Türkçe", "Matematik", "Fizik"]);
    const mat = s.bySubject.find((r) => r.subject === "Matematik");
    expect(mat).toMatchObject({ max: 30, n: 3, lastNet: 14.5, bestNet: 14.5 });
    expect(mat.avgNet).toBeCloseTo((10 + 12.5 + 14.5) / 3);
    expect(mat.trend.dir).toBe("up"); // (12,5 + 14,5)/2 − 10 = 3,5 ≥ 1,5
    const fiz = s.bySubject.find((r) => r.subject === "Fizik");
    expect(fiz.trend.dir).toBe("flat"); // (3,75 + 4,75)/2 − 3,5 = 0,75 < 1
  });

  it("en çok net kaçan ders: son 3 denemede soru − net ortalaması en büyük; yanlış/boş payı", () => {
    const s = buildDenemeler(EXAMS(), { start: today - 27, end: today, asOf: today }).TYT;
    const lt = s.lossTop;
    expect(lt.subject).toBe("Matematik");
    expect(lt.avgLost).toBeCloseTo(30 - (10 + 12.5 + 14.5) / 3);
    expect(lt.wrongLost).toBeCloseTo(1.25 * ((8 + 6 + 6) / 3));
    expect(lt.blankLost).toBeCloseTo(lt.avgLost - lt.wrongLost);
    expect(lt.wrongShare).toBeCloseTo((lt.wrongLost / lt.avgLost) * 100);
    // Tek denemelik ders kanıt sayılmaz; AYT'de tek deneme → yok.
    expect(buildDenemeler(EXAMS(), { start: today - 27, end: today, asOf: today }).AYT.lossTop).toBeNull();
  });

  it("geçmiş bir ay: sonraki denemeler görünmez, önceki denemeye göre fark ay öncesinden", () => {
    const m = buildReport(withExams(makeFixture({ weeks: 20 })), { window: monthWindowKey("2026-10"), now: FIXTURE_NOW }).denemeler.TYT;
    expect(m.history.map((e) => e.net)).toEqual([39, 42.5, 41.5]);
    expect(m.list.map((e) => e.net)).toEqual([42.5, 41.5]);
    expect(m.deltaVsPrev).toBe(-1);
    expect(m.record).toBeNull();
  });
});

describe("buildReport entegrasyonu", () => {
  it("model.denemeler: varsayılan pencere, 'Tüm dönem' ödev kaydından önceki denemeleri de kapsar", () => {
    const raw = withExams(makeFixture({ weeks: 4 })); // ödev kayıtları ~4 hafta; ilk deneme 20 Eylül
    expect(buildReport(raw, { now: FIXTURE_NOW }).denemeler.TYT.list).toHaveLength(3);
    const all = buildReport(raw, { window: "all", now: FIXTURE_NOW }).denemeler;
    expect(all.TYT.list).toHaveLength(5);
    expect(all.count).toBe(6);
  });

  it("deneme ödev kayıtlarına ve net oranına karışmaz", () => {
    const raw = makeFixture({ weeks: 10 });
    const a = buildReport(raw, { now: FIXTURE_NOW });
    const b = buildReport(withExams(raw), { now: FIXTURE_NOW });
    expect(b.totalRecords).toBe(a.totalRecords);
    expect(b.kpi.questions.Q).toBe(a.kpi.questions.Q);
    expect(b.exams.TYT.agg.NO).toBe(a.exams.TYT.agg.NO);
    expect(a.denemeler.all).toBe(0);
  });
});

describe("otomatik değerlendirme — deneme olguları", () => {
  const rich = withExams(makeFixture({ weeks: 20 }));
  const facts = (raw, keys) => extractFacts(keys.map((k) => buildReport(raw, { window: monthWindowKey(k), now: FIXTURE_NOW })), keys);

  it("ozet.deneme: ayın son denemesi ve önceki denemeye göre fark", () => {
    const F = facts(rich, ["2026-11", "2026-10"]);
    expect(F.ozet.deneme).toEqual({ sinav: "TYT", net: 51, tarih: "15 Kas", ad: "Kurgu Yayınları TYT-5", fark: 4.25, oncekiNet: 46.75, sayi: 2, soru: 77 });
    // Denemesiz ay: olgu yok.
    expect(facts(rich, ["2026-08"]).ozet.deneme).toBeUndefined();
  });

  it("guclu.deneme: son üç denemede yükseliş (rekordan önce gelir)", () => {
    const g = facts(rich, ["2026-11", "2026-10"]).guclu.filter((x) => x.key === "guclu.deneme");
    expect(g).toHaveLength(1);
    expect(g[0].f).toMatchObject({ sinav: "TYT", tip: "yukselis", net: 51, ilkNet: 41.5, artis: 9.5, degerler: [41.5, 46.75, 51] });
  });

  it("gelisim.denemeDers: ayın denemelerinde en çok net kaçan ders, ödev ders anahtarıyla", () => {
    const g = facts(rich, ["2026-11", "2026-10"]).gelisim.find((x) => x.key === "gelisim.denemeDers");
    expect(g.subject).toBe("TYT|Matematik");
    expect(g.f).toMatchObject({ ders: "TYT Matematik", soru: 30, deneme: 2, ortNet: 13.5, kayip: 16.5, sonNet: 14.5, yanlisPay: 45 });
  });

  it("özette deneme cümlesi her zaman yer alır; metinde yasak kelime ve tanımsız değer yok", { timeout: 30000 }, () => {
    for (let i = 0; i < 4; i++) {
      const n = buildNarrative({ ...rich, student: { ...rich.student, id: `ogr-${i}` } }, { month: "2026-11", now: FIXTURE_NOW });
      expect(n.ozet).toMatch(/51 net/);
      const all = [n.ozet, ...n.gucluYonler, ...n.gelisimAlanlari.flatMap((x) => [x.alan, x.kanit, x.oneri]), ...n.kocaOneriler, n.ogrenciyleKonusma, ...n.dikkat];
      for (const s of all) {
        expect(s).not.toMatch(/undefined|NaN|null|\[object/);
        expect(s).not.toMatch(FORBIDDEN);
      }
    }
  });

  it("yalnızca denemesi olan öğrenci: veri yetersiz ama özet denemeyi anar", () => {
    const n = buildNarrative({ viewer: "coach", student: { id: "yalniz-deneme" }, items: [], sessions: [], practiceExams: EXAMS() }, { month: "2026-11", now: FIXTURE_NOW });
    expect(n.veriYeterliligi).toBe("yetersiz");
    expect(n.ozet).toMatch(/51 net/);
  });
});
