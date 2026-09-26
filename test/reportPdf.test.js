import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTableMod from "jspdf-autotable";
import {
  buildReportPdfDoc, buildMonthlyReportsPdfDoc, reportPdfFileName, monthlyPdfFileName, scrubLowPercentiles,
} from "../src/reportPdf.js";
import { buildReport, fmtPct } from "../src/reportModel.js";
import { makeFixture, FIXTURE_NOW } from "./fixtures/reportFixture.js";

// PDF'ler Node'da kurulur: jsPDF/autoTable doğrudan içe aktarılır, Roboto diskten okunur (fetch yok).
const realAutoTable = autoTableMod.default || autoTableMod.autoTable || autoTableMod;
const fontFile = (name) => fs.readFileSync(path.resolve(process.cwd(), "public/fonts", name)).toString("base64");
const FONT = { regular: fontFile("Roboto-Regular.ttf"), bold: fontFile("Roboto-Bold.ttf") };

const AI_MARK = "YZOZET7Q";
const AI = {
  ozet: `${AI_MARK} Öğrenci TYT Türkçe'de istikrarlı; matematikte boş oranı yüksek.`,
  veriYeterliligi: "yeterli",
  gucluYonler: ["TYT Türkçe net oranı %78"],
  gelisimAlanlari: [{ alan: "TYT Matematik", kanit: "Boş oranı %29", oneri: "Problemler konusuna kısa tekrar." }],
  kocaOneriler: ["Sessiz ödevleri görüşmede konuşun."],
  ogrenciyleKonusma: "Türkçe'deki düzenini takdir ederek başlayın.",
  dikkat: ["Fizik'te iki konu pası var."],
  generatedAt: FIXTURE_NOW,
};
const NOTE = "Son sorularda zorlandım.";
const FORBIDDEN = /(?<!\p{L})(zayıf|kötü|başarısız|geride|tembel|hile)/iu;

// doc.text'e giden her dizeyi (autoTable hücreleri dahil) ve autoTable ayarlarını yakalar.
function spies() {
  const texts = [];
  const tables = [];
  function SpyPDF(...args) {
    const d = new jsPDF(...args);
    const orig = d.text.bind(d);
    d.text = (text, ...rest) => {
      // bir çağrı = bir paragraf ya da tablo hücresi (satırlara bölünmüş olabilir)
      texts.push((Array.isArray(text) ? text : [text]).map(String).join(" "));
      return orig(text, ...rest);
    };
    return d;
  }
  const autoTable = (doc, opts) => { tables.push(opts); return realAutoTable(doc, opts); };
  return { texts, tables, jsPDF: SpyPDF, autoTable };
}
async function build(model, variant, extra = {}) {
  const s = spies();
  const doc = await buildReportPdfDoc({ model, variant, jsPDF: s.jsPDF, autoTable: s.autoTable, font: FONT, logo: null, ...extra });
  const text = s.texts.join(" ").replace(/\s+/g, " ");
  return { doc, text, texts: s.texts, tables: s.tables, pages: doc.getNumberOfPages() };
}
const cellText = (c) => String(c && typeof c === "object" ? c.content ?? "" : c ?? "");
const rich = (viewer = "coach") => buildReport(makeFixture({ seed: 42, viewer }), { now: FIXTURE_NOW });

describe("zengin kurgu — üç nüsha", () => {
  const results = {};
  const get = async (variant) => {
    if (!results[variant]) results[variant] = await build(rich(), variant, { ai: AI });
    return results[variant];
  };

  it.each(["coach", "student", "parent"])("%s nüshası hatasız kurulur, 6–14 sayfa", async (variant) => {
    const r = await get(variant);
    expect(r.pages).toBeGreaterThanOrEqual(6);
    expect(r.pages).toBeLessThanOrEqual(14);
    // alt bilgi sayfa sayısını tüm sayfalar çizildikten sonra yazar
    expect(r.text).toContain(`Sayfa 1/${r.pages}`);
    expect(r.text).toContain(`Sayfa ${r.pages}/${r.pages}`);
    expect(r.text).toContain("Net = D − Y/4");
    expect(r.text).toContain("Deniz Kurgu · 12-A · Koç: Koç Hoca · 24 Ekim – 20 Kasım 2026");
    expect(r.text).toContain("Ek F — Yöntem ve tanımlar");
    expect(r.text).toContain("Ödev neti deneme neti değildir.");
    // ekranla aynı model: KPI ve tablo değerleri modelin biçimlenmiş sayılarıdır
    const m = rich();
    expect(r.text).toContain(fmtPct(m.exams.TYT.agg.NO));
    expect(r.text).toContain("62,75"); // TYT Matematik neti (ondalık virgül)
    expect(r.text).toContain("1.067"); // TYT soru (binlik nokta)
  });

  it("koç nüshası koç ekini, öğrenci notlarını ve yapay zekâ incelemesini içerir", async () => {
    const r = await get("coach");
    expect(r.text).toContain("Koç eki");
    expect(r.text).toContain(AI_MARK);
    expect(r.text).toContain("Yapay zekâ önerisidir; son karar koçundur. Modele kimlik bilgisi gönderilmez.");
    expect(r.text).toContain(NOTE);
    expect(r.text).toContain("Görüşme notları");
    expect(r.text).toMatch(/medyan yüzdelik 14\b/); // koç kesin değeri görür
  });

  it.each(["student", "parent"])("%s nüshasında koç eki, notlar ve yapay zekâ yok", async (variant) => {
    const r = await get(variant);
    expect(r.text).not.toContain("Koç eki");
    expect(r.text).not.toContain(AI_MARK);
    expect(r.text).not.toContain("Yapay zekâ");
    expect(r.text).not.toContain(NOTE);
    expect(r.text).not.toContain("Veri notları");
    expect(r.text).not.toContain("Görüşme notları");
  });

  it.each(["student", "parent"])("%s nüshası 50'nin altında yüzdelik basmaz", async (variant) => {
    const r = await get(variant);
    // her doc.text çağrısı ayrı denetlenir (tablo başlığı "Yüzdelik" + sonraki hücrenin tarihi yan yana okunmasın)
    const nums = r.texts.flatMap((t) => [...t.matchAll(/yüzdelik\D{0,4}(\d+)/gi)].map((x) => Number(x[1])));
    for (const n of nums) expect(n).toBeGreaterThanOrEqual(50);
    expect(r.text).not.toMatch(/P̃/);
    // Ek A'nın Yüzdelik sütunu: yalnız ≥ 50 sayı, altında okul medyanına fark
    const tbl = r.tables.find((t) => t.head?.[0]?.map(cellText).includes("Yüzdelik"));
    expect(tbl).toBeTruthy();
    const col = tbl.head[0].map(cellText).indexOf("Yüzdelik");
    const vals = tbl.body.map((row) => cellText(row[col]));
    expect(vals.length).toBeGreaterThan(0);
    for (const v of vals) {
      if (/^\d+$/.test(v)) expect(Number(v)).toBeGreaterThanOrEqual(50);
      else expect(v).toMatch(/^medyana \d+ puan$/);
    }
    expect(vals.some((v) => v.startsWith("medyana"))).toBe(true);
  });

  it("öğrenci nüshası 'sen' metinlerini, veli nüshası koç metinlerini kullanır", async () => {
    const m = rich();
    const st = await get("student");
    const pa = await get("parent");
    const firstStudent = m.recs.pdfStudent[0].text.student;
    expect(st.text).toContain(firstStudent.slice(0, 40));
    expect(pa.text).toContain("Öneriler");
    expect(pa.text).toContain("okul medyanının altında"); // R10 koç metni, yüzdelik ayıklanmış
    expect(pa.text).not.toContain("alt çeyreğinde");
  });

  it.each(["coach", "student", "parent"])("%s nüshasında yasak kelime yok", async (variant) => {
    const r = await get(variant);
    expect(r.text).not.toMatch(FORBIDDEN);
  });

  it("tüm tablolar başlığı her sayfada tekrarlar ve satırları bölmez", async () => {
    const r = await get("coach");
    expect(r.tables.length).toBeGreaterThan(10);
    for (const t of r.tables) {
      expect(t.rowPageBreak).toBe("avoid");
      expect(t.showHead).toBe("everyPage");
    }
  });
});

describe("pencereler ve 11. sınıf", () => {
  it.each(["4w", "8w", "all", "month:2026-10", "month:2026-11"])("%s penceresi hatasız kurulur", async (window) => {
    const m = buildReport(makeFixture({ seed: 42 }), { now: FIXTURE_NOW, window });
    const r = await build(m, "coach", { ai: AI });
    expect(r.pages).toBeGreaterThanOrEqual(6);
    expect(r.text).toContain(m.rangeText);
    expect(r.text).not.toMatch(FORBIDDEN);
  });

  it("11. sınıfta geri sayım ve müfredat kapsamı basılmaz", async () => {
    const raw = makeFixture({ seed: 42 });
    raw.student.gradeLevel = 11;
    raw.student.className = "11-B";
    const r = await build(buildReport(raw, { now: FIXTURE_NOW }), "student");
    expect(r.text).toContain("11-B");
    expect(r.text).not.toContain("YKS'ye");
    expect(r.text).not.toContain("Müfredat kapsamı (~)");
    expect(r.text).not.toContain("Müfredat konuları");
  });
});

describe("öğrenci hesabının modeli", () => {
  it("koç nüshası istense bile öğrenci nüshası çıkar", async () => {
    const r = await build(rich("student"), "coach", { ai: AI });
    expect(r.text).toContain("Öğrenci nüshası");
    expect(r.text).not.toContain("Koç eki");
    expect(r.text).not.toContain(AI_MARK);
  });
});

describe("az veri (toplam kayıt < 3)", () => {
  const sparse = () => buildReport(makeFixture({ sparse: true, weeks: 1 }), { now: FIXTURE_NOW });
  it.each(["coach", "student", "parent"])("%s nüshası kısa ama geçerli", async (variant) => {
    const m = sparse();
    expect(m.enough).toBe(false);
    const r = await build(m, variant, { ai: AI });
    expect(r.pages).toBeGreaterThanOrEqual(1);
    expect(r.pages).toBeLessThanOrEqual(4);
    expect(r.text).toContain("Raporun oluşuyor");
    expect(r.text).toContain("Ödev düzeni");
    expect(r.text).toContain("Ek F — Yöntem ve tanımlar");
    expect(r.text).not.toContain("Ders karnesi");
    expect(r.text).not.toMatch(FORBIDDEN);
    if (variant === "coach") expect(r.text).toContain("Koç eki");
    else expect(r.text).not.toContain("Koç eki");
  });
});

describe("aylık toplu koç PDF'i", () => {
  it("kapak tablosu ve her öğrenci için yeni sayfadan başlayan bölümler", async () => {
    const s = spies();
    const entries = [
      { model: buildReport(makeFixture({ seed: 42 }), { now: FIXTURE_NOW, window: "month:2026-10" }), ai: AI },
      { model: buildReport(makeFixture({ seed: 7 }), { now: FIXTURE_NOW, window: "month:2026-10" }), ai: null },
    ];
    entries[1].model.student.name = "Ece Örnek";
    const doc = await buildMonthlyReportsPdfDoc({
      month: "2026-10", monthLabel: "Ekim 2026", coachName: "Koç Hoca", entries, jsPDF: s.jsPDF, autoTable: s.autoTable, font: FONT, logo: null,
    });
    const text = s.texts.join(" ").replace(/\s+/g, " ");
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThanOrEqual(5);
    expect(pages).toBeLessThanOrEqual(14);
    expect(text).toContain("Aylık raporlar — Ekim 2026");
    expect(text).toContain(`Sayfa ${pages}/${pages}`);
    const cover = s.tables[0];
    expect(cover.head[0].map(cellText)).toEqual(["Ad", "Teslim %", "Ele alınan %", "Aktif gün", "TYT net oranı", "AYT net oranı", "Odak dersler", "Durum"]);
    expect(cover.body.map((row) => cellText(row[0]))).toEqual(["Deniz Kurgu", "Ece Örnek"]);
    expect(text).toContain("Deniz Kurgu · 12-A · Koç: Koç Hoca · 1–31 Ekim 2026");
    expect(text).toContain("Ece Örnek · 12-A · Koç: Koç Hoca · 1–31 Ekim 2026");
    expect(text.split("Koç eki").length - 1).toBe(2);
    expect(text.split("Ders karnesi").length - 1).toBe(2);
    expect(text.split(AI_MARK).length - 1).toBe(1);
    expect(text).not.toMatch(FORBIDDEN);
  });
});

describe("yardımcılar", () => {
  it("dosya adları ASCII", () => {
    const m = rich();
    expect(reportPdfFileName(m)).toBe("Gelisim-Raporu_Deniz-Kurgu_2026-11-20.pdf");
    m.student.name = "Şule Işık Öztürk";
    expect(reportPdfFileName(m)).toBe("Gelisim-Raporu_Sule-Isik-Ozturk_2026-11-20.pdf");
    expect(monthlyPdfFileName("2026-10")).toBe("Aylik-Raporlar_2026-10.pdf");
  });

  it("50'nin altındaki yüzdelikler koç metninden ayıklanır, üstündekiler kalır", () => {
    expect(scrubLowPercentiles("x (175 soru, 6 kayıt; okul içi medyan yüzdelik 14). y")).toBe("x (175 soru, 6 kayıt). y");
    expect(scrubLowPercentiles("son 6 okul ödevinin 6 tanesinde öğrenci okulun alt çeyreğinde (medyan yüzdelik 11, ortalama katılım %80)."))
      .toBe("son 6 okul ödevinin 6 tanesinde öğrenci okul medyanının altında (ortalama katılım %80).");
    expect(scrubLowPercentiles("Net oranı %36 · okul ödevlerinde medyan yüzdelik 14 → aynı ödevlerde okul medyanının altında, Odak"))
      .toBe("Net oranı %36 · aynı ödevlerde okul medyanının altında, Odak");
    expect(scrubLowPercentiles("okul içinde üst çeyrekte (medyan yüzdelik 91, 8 ödev)")).toBe("okul içinde üst çeyrekte (medyan yüzdelik 91, 8 ödev)");
  });

  it("font yüklenemezse Helvetica + ASCII ile yine PDF oluşur", async () => {
    const r = await build(rich(), "coach", { font: false, ai: AI });
    expect(r.pages).toBeGreaterThanOrEqual(6);
    for (const t of r.texts) expect(t).toMatch(/^[\x09\x0A\x0D\x20-\x7E]*$/);
    expect(r.text).toContain("Koc eki");
  });
});
