// PDF > "Denemeler" sayfası (src/reportPdf.js > renderDenemeler): üç nüshada tablo + vektör grafik, sayılar modelle aynı,
// deneme yoksa sayfa yok, aylık toplu PDF'te yalnızca o ay deneme varsa. Veriler kurgusal.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTableMod from "jspdf-autotable";
import { buildReportPdfDoc, buildMonthlyReportsPdfDoc } from "../src/reportPdf.js";
import { buildReport, monthWindowKey } from "../src/reportModel.js";
import { makeFixture, FIXTURE_NOW } from "./fixtures/reportFixture.js";

const realAutoTable = autoTableMod.default || autoTableMod.autoTable || autoTableMod;
const fontFile = (name) => fs.readFileSync(path.resolve(process.cwd(), "public/fonts", name)).toString("base64");
const FONT = { regular: fontFile("Roboto-Regular.ttf"), bold: fontFile("Roboto-Bold.ttf") };
const FORBIDDEN = /(?<!\p{L})(zayıf|kötü|başarısız|geride|tembel|hile)/iu;
const cellText = (c) => String(c && typeof c === "object" ? c.content ?? "" : c ?? "");

function spies() {
  const texts = [];
  const tables = [];
  function SpyPDF(...args) {
    const d = new jsPDF(...args);
    const orig = d.text.bind(d);
    d.text = (text, ...rest) => { texts.push((Array.isArray(text) ? text : [text]).map(String).join(" ")); return orig(text, ...rest); };
    return d;
  }
  const autoTable = (doc, opts) => { tables.push(opts); return realAutoTable(doc, opts); };
  return { texts, tables, jsPDF: SpyPDF, autoTable };
}
async function build(model, variant) {
  const s = spies();
  const doc = await buildReportPdfDoc({ model, variant, jsPDF: s.jsPDF, autoTable: s.autoTable, font: FONT, logo: null });
  return { doc, text: s.texts.join(" ").replace(/\s+/g, " "), tables: s.tables };
}

let seq = 0;
const ex = (date, subjects, { examType = "TYT", name = null } = {}) => ({
  id: `p${++seq}`, examType, date: `${date}T00:00:00.000Z`, name, byStudent: true, canEdit: true,
  results: Object.entries(subjects).map(([subject, [correct, wrong, blank]]) => ({ subject, correct, wrong, blank })),
});
const EXAMS = () => [
  ex("2026-10-26", { Türkçe: [30, 8, 2], Matematik: [12, 8, 10], Fizik: [4, 2, 1] }),
  ex("2026-11-08", { Türkçe: [32, 6, 2], Matematik: [14, 6, 10], Fizik: [4, 1, 2] }),
  ex("2026-11-15", { Türkçe: [33, 5, 2], Matematik: [16, 6, 8], Fizik: [5, 1, 1] }, { name: "Kurgu Yayınları TYT-5" }),
];
const model = (viewer = "coach", exams = EXAMS(), window) => buildReport({ ...makeFixture({ viewer }), practiceExams: exams }, { now: FIXTURE_NOW, window });

describe("PDF — Denemeler sayfası", { timeout: 60000 }, () => {
  it("üç nüshada: özet satırı, deneme listesi ve ders tablosu (sayılar modelden), en çok net kaçan ders", async () => {
    for (const variant of ["coach", "parent", "student"]) {
      const m = model(variant === "student" ? "student" : "coach");
      const { text, tables } = await build(m, variant);
      expect(text, variant).toContain("Denemeler");
      expect(text).toContain("TYT denemeleri");
      expect(text).toContain("Son deneme 15 Kas 2026 (Kurgu Yayınları TYT-5): 51 net, önceki denemeye göre +4,25 net.");
      expect(text).toContain("TYT — toplam net (son 3 deneme)");
      const list = tables.find((t) => cellText(t.head?.[0]?.[0]) === "Tarih" && cellText(t.head[0][7]) === "Önceki denemeye göre");
      expect(list.body.map((r) => cellText(r[6]))).toEqual(["51", "46,75", "41,5"]);
      expect(cellText(list.body[0][7])).toBe("+4,25 net");
      expect(cellText(list.body[2][7])).toBe("ilk deneme");
      const subj = tables.find((t) => cellText(t.head?.[0]?.[6]) === "Ort. kaçan net");
      expect(subj.body.map((r) => cellText(r[0]))).toEqual(["Türkçe", "Matematik", "Fizik"]);
      expect(subj.body[1].map(cellText).slice(1, 7)).toEqual(["30", "3", "14,5", "12,33", "14,5", "17,67"]);
      expect(text).toContain("TYT Matematik: son 3 denemede 30 sorudan ortalama 12,33 net; 17,67 net kazanma fırsatı");
      expect(text).not.toMatch(FORBIDDEN);
      expect(text).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it("düşüş rengi: koç ve veli nüshasında amber, öğrenci nüshasında nötr (ekrandaki kuralla aynı)", async () => {
    const AMBER = [163, 74, 7];
    const down = [
      ex("2026-10-26", { Türkçe: [33, 5, 2], Matematik: [16, 6, 8] }),
      ex("2026-11-08", { Türkçe: [32, 6, 2], Matematik: [14, 6, 10] }),
      ex("2026-11-15", { Türkçe: [30, 8, 2], Matematik: [12, 8, 10] }),
    ];
    const colorOf = async (variant) => {
      const { tables } = await build(model(variant === "student" ? "student" : "coach", down), variant);
      const list = tables.find((t) => cellText(t.head?.[0]?.[0]) === "Tarih" && cellText(t.head[0][7]) === "Önceki denemeye göre");
      const cell = list.body[0][7]; // en yeni deneme: bir öncekinden düşük
      expect(cellText(cell)).toMatch(/^−\d/);
      return cell.styles.textColor;
    };
    expect(await colorOf("coach")).toEqual(AMBER);
    expect(await colorOf("parent")).toEqual(AMBER);
    expect(await colorOf("student")).not.toEqual(AMBER);
  });

  it("deneme yoksa sayfa yok; seçili aralıkta deneme yoksa not", async () => {
    const none = await build(model("coach", []), "coach");
    expect(none.text).not.toContain("TYT denemeleri");
    const past = await build(model("coach", [ex("2026-08-20", { Türkçe: [30, 6, 4] })]), "coach");
    expect(past.text).toContain("Seçili aralıkta TYT denemesi yok; son deneme 20 Ağu 2026: 28,5 net.");
  });

  it("aylık toplu PDF: yalnızca o ay deneme varsa", async () => {
    const run = async (exams) => {
      const s = spies();
      const m = model("coach", exams, monthWindowKey("2026-11"));
      await buildMonthlyReportsPdfDoc({ month: "2026-11", monthLabel: "Kasım 2026", coachName: "Koç Hoca", entries: [{ model: m }], jsPDF: s.jsPDF, autoTable: s.autoTable, font: FONT, logo: null });
      return s.texts.join(" ").replace(/\s+/g, " ");
    };
    expect(await run(EXAMS())).toContain("TYT denemeleri");
    expect(await run([ex("2026-10-26", { Türkçe: [30, 8, 2] })])).not.toContain("TYT denemeleri");
  });
});
