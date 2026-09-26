import { isNative, savePdfAndShare } from "./native/index.js";
import {
  fmtPct, fmtDec, fmtInt, fmtNet, fmtSigned, fmtDay, isoWeekNo, weekOf,
  LABELS, PROFILES, STATE_LABEL, SKIP_LABEL, TOPIC_STATUS, TREND_LABEL,
} from "./reportModel.js";

// Gelişim raporu PDF'i. Ekranla AYNI rapor modelini (reportModel.js > buildReport) basar; burada hiçbir istatistik
// farklı biçimde yeniden hesaplanmaz, yalnızca modeldeki sayılar düzenlenir ve biçimlenir (fmtPct, fmtNet …).
// Üç nüsha vardır:
//  • student — "sen" dili; koç eki, notlar, 50'nin altındaki yüzdelikler ve yapay zekâ incelemesi yok.
//  • coach   — tam içerik (koç eki, notlar, kesin yüzdelikler, varsa yapay zekâ incelemesi).
//  • parent  — koçun "Veli/öğrenci için" nüshası: koç metinleri, ama koç eki, öğrenci/pas notları, veri notları,
//              50'nin altındaki yüzdelikler ve yapay zekâ incelemesi çıkarılır.
// Koçun özel notları (CoachNote) modelde yoktur ve hiçbir PDF'e girmez.
//
// jsPDF'in standart fontları (Helvetica vb.) Türkçe'ye özgü karakterleri (ğ ş ı İ ç ö ü) basamıyor. Bu yüzden
// public/fonts/ altındaki Roboto (SIL Open Font License 1.1, bkz. public/fonts/OFL.txt) PDF oluşturulurken — yalnızca
// o an, ilk açılış paketine hiç girmeden — yüklenip PDF'e gömülür. Roboto'nun rakamları eşit genişlikte olduğu için
// ayrı bir mono font gerekmez. Font yüklenemezse (ör. çevrimdışı web) eski yönteme düşülür: metin ASCII'ye çevrilip
// Helvetica ile basılır ("Öğrenci" → "Ogrenci") — kutu/bozuk karakter basmaktan iyidir, PDF yine de oluşur.

const SCHOOL_NAME = "Mehmet Akif İnan Hafız Anadolu İmam Hatip Lisesi";
const VARIANT_LABEL = { student: "Öğrenci nüshası", coach: "Koç nüshası", parent: "Veli/öğrenci nüshası" };

// ---------------------------------------------------------------- sayfa ölçüleri (mm, A4 dikey)
const PT = 0.3528; // 1 pt = 0,3528 mm
const PAGE_W = 210, PAGE_H = 297, M = 14, CW = PAGE_W - 2 * M;
const TOP = 16; // içerik başlangıcı (üst bilgi satırının altı)
const BOTTOM = 281; // içerik sınırı (alt bilgi satırının üstü)

// ---------------------------------------------------------------- renkler (baskıya uygun; renk tek başına anlam taşımaz)
const INK = [30, 30, 30], GREY = [92, 92, 92], SOFT = [140, 140, 140], RULE = [200, 200, 200], FILL = [244, 244, 244], HEAD = [234, 234, 234];
const GREEN = [17, 128, 58], RED = [190, 30, 30], AMBER = [163, 74, 7];
const LABEL_COLOR = { strong: GREEN, ok: INK, focus: AMBER, few: SOFT }; // etiket asla kırmızı değil
const TOPIC_COLOR = { solid: GREEN, growing: INK, review: AMBER, few: SOFT, open: AMBER };
const STATUS_COLOR = { intervene: RED, watch: AMBER, ok: GREEN };
const REASON_TEXT = { KONU: "konu eksiği", ZAMAN: "zaman yetmedi", KAYNAK: "kaynak yok", DIGER: "diğer" };
const OWNER_ORDER = ["Koç", "Branş öğretmeni", "Yönetim", "Öğrenci"];
const HISTORY_LIMIT = 200;

// ---------------------------------------------------------------- metin dönüşümleri
const TR_MAP = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U", â: "a", Â: "A", î: "i", Î: "I", û: "u", Û: "U" };
const SYM_MAP = {
  "−": "-", "–": "-", "—": "-", "→": "->", "›": ">", "·": "-", "…": "...", "≥": ">=", "≤": "<=", "Δ": "D", "Σ": "S", "√": "kok",
  "×": "x", "•": "-", "̃": "~", "≈": "~", "²": "2", "‘": "'", "’": "'", "“": '"', "”": '"',
};
export function toAscii(str) {
  return String(str ?? "")
    .replace(/[çÇğĞıİöÖşŞüÜâÂîÎûÛ]/g, (c) => TR_MAP[c] ?? c)
    .replace(/[−–—→›·…≥≤ΔΣ√ו̃≈²‘’“”]/g, (c) => SYM_MAP[c] ?? c)
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

// Roboto'da olmayan birkaç simge (→ ✓ ok işaretleri) yakın karşılıklarıyla değiştirilir; font tablosunda hiç
// olmayan karakter (ör. yapay zekâ metnindeki emoji) boş kutu basılmasın diye atılır.
function unicodeCleaner(doc) {
  let cm = null;
  try { cm = doc.getFont()?.metadata?.cmap?.unicode?.codeMap || null; } catch { cm = null; }
  return (s) => {
    const out = String(s ?? "").replace(/[→⇒➔⟶➜]/g, "›").replace(/[←⇐]/g, "‹").replace(/[✓✔]/g, "√").replace(/[☐□]/g, "■");
    if (!cm) return out;
    let r = "";
    for (const ch of out) {
      const c = ch.codePointAt(0);
      if (c < 128 || cm[c]) r += ch;
    }
    return r;
  };
}

// Öğrenci ve veli nüshasında 50'nin altındaki yüzdelik basılmaz. Koç metinlerindeki bu kalıplar ayıklanır;
// kalan cümle anlamını korur ("okulun alt çeyreğinde" → "okul medyanının altında").
const low = (p) => Number(p) < 50;
export function scrubLowPercentiles(text) {
  if (text == null) return text;
  return String(text)
    .replace(/\s*\(medyan yüzdelik (\d+), ([^)]*)\)/g, (m0, p, rest) => (low(p) ? ` (${rest})` : m0))
    .replace(/;\s*okul içi medyan yüzdelik (\d+)/g, (m0, p) => (low(p) ? "" : m0))
    .replace(/okul ödevlerinde medyan yüzdelik (\d+) → /g, (m0, p) => (low(p) ? "" : m0))
    .replace(/okulun alt çeyreğinde/g, "okul medyanının altında")
    .replace(/tanesinde alt çeyrek/g, "tanesinde okul medyanının altında")
    .replace(/okulda alt çeyrek/g, "okul medyanının altında")
    .replace(/,?\s*(?:medyan |sıra )?yüzdelik(?:leri)?\s*(\d+)/g, (m0, p) => (low(p) ? "" : m0))
    .replace(/P̃\s*(\d+)/g, (m0, p) => (low(p) ? "P̃ —" : m0));
}
const hasLowPercentile = (s) => /yüzdelik (\d+)/.test(s || "") && [...String(s).matchAll(/yüzdelik (\d+)/g)].some((x) => low(x[1]));

// ---------------------------------------------------------------- küçük biçim yardımcıları
function trStamp(d) {
  const x = new Date(new Date(d ?? Date.now()).getTime() + 3 * 3600e3);
  const p = (n) => String(n).padStart(2, "0");
  return {
    date: `${p(x.getUTCDate())}.${p(x.getUTCMonth() + 1)}.${x.getUTCFullYear()}`,
    time: `${p(x.getUTCHours())}:${p(x.getUTCMinutes())}`,
    iso: `${x.getUTCFullYear()}-${p(x.getUTCMonth() + 1)}-${p(x.getUTCDate())}`,
  };
}
const stampText = (d) => { const s = trStamp(d); return `${s.date} ${s.time}`; };
const daysAgo = (n) => (n == null ? "bilinmiyor" : n === 0 ? "bugün" : `${fmtInt(n)} gün önce`);
const weekLabel = (isoNo, start) => `${isoNo}. hf · ${fmtDay(start)}`;
const subjectShort = (s) => s.subject || String(s.name || "").replace(/^(TYT|AYT)\s+/, "");
const byWeight = (a = {}, b = {}) => (a.examType === b.examType ? 0 : a.examType === "TYT" ? -1 : 1) || (b.weight ?? 0) - (a.weight ?? 0) || String(a.name ?? "").localeCompare(String(b.name ?? ""), "tr");
function signedPct(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const r = Math.round(v);
  return r > 0 ? `+%${r}` : r < 0 ? `−%${Math.abs(r)}` : "%0";
}
// Düzen yüzdeleri 5'ten az ödevde kesir olarak yazılır.
function ratio(num, V) {
  if (!V) return "—";
  return V >= 5 ? fmtPct((num / V) * 100) : `${num}/${V}`;
}
const fewLine = (n, q) => `Veri az (${fmtInt(n)} kayıt · ${fmtInt(q)} soru)`;
function niceMax(v) {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const k of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * p >= v) return k * p;
  return 10 * p;
}
function examDelivery(model, exam) {
  const c = { V: 0, delivered: 0, skip: 0 };
  for (const d of model.discipline.bySubject) {
    if (!d.key.startsWith(`${exam}|`)) continue;
    c.V += d.V; c.delivered += d.delivered; c.skip += d.skip;
  }
  return c;
}
const hasSubjectData = (s) => s.agg.n > 0 || (s.labelAgg?.n ?? 0) > 0 || s.konuPass > 0 || s.openOverdue > 0;

// ---------------------------------------------------------------- dosya/font yükleme
// Aynı origin'den bir dosyayı data URL'e çevirir — jsPDF addImage bir data URL bekliyor.
// Yüklenemezse null döner; çağıran taraf o parçayı atlar (logo kritik değil).
async function fetchAsDataUrl(path) {
  try {
    if (typeof fetch !== "function" || typeof FileReader === "undefined") return null;
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
// addFileToVFS ham base64 bekler (data URL öneki olmadan).
async function fetchFontBase64(path) {
  const dataUrl = await fetchAsDataUrl(path);
  return dataUrl ? dataUrl.slice(dataUrl.indexOf(",") + 1) : null;
}
async function loadLibs(jsPDF, autoTable) {
  if (jsPDF && autoTable) return { jsPDF, autoTable };
  const [a, b] = await Promise.all([jsPDF ? null : import("jspdf"), autoTable ? null : import("jspdf-autotable")]);
  return { jsPDF: jsPDF || a.jsPDF || a.default, autoTable: autoTable || b.default || b.autoTable };
}
// font: { regular, bold } ham base64 · false → doğrudan Helvetica/ASCII · undefined → /fonts/ altından yüklenir.
async function registerUnicodeFont(doc, font) {
  let regular = null, bold = null;
  if (font === false) return null;
  if (font && font.regular && font.bold) ({ regular, bold } = font);
  else [regular, bold] = await Promise.all([fetchFontBase64("/fonts/Roboto-Regular.ttf"), fetchFontBase64("/fonts/Roboto-Bold.ttf")]);
  if (!regular || !bold) return null;
  try {
    doc.addFileToVFS("Roboto-Regular.ttf", regular);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", bold);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto", "normal");
    return "Roboto";
  } catch {
    return null;
  }
}

// ================================================================ yazıcı: sayfa akışı, bloklar, tablolar
function createWriter({ doc, autoTable, fontName, clean, variant, logo }) {
  const w = {
    doc, variant, logo, y: TOP, headers: {}, headerText: "",
    coach: variant === "coach", student: variant === "student", parent: variant === "parent",
  };
  // Öğrenci/veli nüshasında her metin son bir kez yüzdelik süzgecinden geçer (güvenlik ağı). "P̃" simgesinin
  // birleşik tildesi küçük puntoda okunmadığı için yazıyla basılır.
  const sym = (s) => String(s ?? "").replace(/P̃/g, "medyan yüzdelik");
  w.t = variant === "coach" ? (s) => clean(sym(s)) : (s) => clean(sym(scrubLowPercentiles(s)));
  // Koç metni: veli nüshasında yüzdelikler ayıklanır.
  w.ct = (s) => (variant === "coach" ? s : scrubLowPercentiles(s));
  w.font = (bold = false, size = 8.5, color = INK) => {
    doc.setFont(fontName, bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  w.text = (s, x, y, opts) => doc.text(w.t(s), x, y, opts);
  w.newPage = () => {
    doc.addPage();
    w.y = TOP;
    w.headers[doc.getNumberOfPages()] = w.headerText;
  };
  w.ensure = (h) => {
    if (w.y + h > BOTTOM) { w.newPage(); return true; }
    return false;
  };
  w.gap = (h = 2) => { w.y += h; };

  // Metin öğeleri: { text, size, bold, color, indent, mark ("•" | "1." | "box" | "boxDone" | {dot: renk}), label, labelW, gap, lh }
  function drawMark(mark, x, base, size) {
    if (mark === "box" || mark === "boxDone") {
      const s = 2.7, top = base - s + 0.25;
      doc.setLineWidth(0.25);
      doc.setDrawColor(...INK);
      if (mark === "boxDone") {
        doc.setFillColor(...GREEN);
        doc.rect(x, top, s, s, "FD");
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.4);
        doc.line(x + 0.55, top + 1.45, x + 1.15, top + 2.1);
        doc.line(x + 1.15, top + 2.1, x + 2.2, top + 0.6);
      } else doc.rect(x, top, s, s, "S");
      return;
    }
    if (mark && typeof mark === "object" && mark.dot) {
      doc.setFillColor(...mark.dot);
      doc.circle(x + 1.2, base - size * PT * 0.34, 1.1, "F");
      return;
    }
    w.font(mark !== "•", size, INK);
    doc.text(w.t(mark), x, base);
  }
  w.flow = (items, { x = M, width = CW, dry = false, y } = {}) => {
    const y0 = y ?? w.y;
    let h = 0;
    for (const it of items) {
      if (!it || it.text == null || it.text === "") continue;
      const size = it.size ?? 8.5;
      const lhf = it.lh ?? 1.3;
      const lh = size * PT * lhf;
      const indent = it.indent ?? 0;
      const markW = it.mark ? (it.markW ?? 4.2) : 0;
      let labelW = 0, labelLines = [];
      if (it.label) {
        labelW = it.labelW ?? 30;
        w.font(true, size, it.labelColor ?? INK);
        labelLines = doc.splitTextToSize(w.t(it.label), labelW - 1.5);
      }
      w.font(!!it.bold, size, it.color ?? INK);
      const tx = x + indent + markW + labelW;
      const lines = doc.splitTextToSize(w.t(it.text), Math.max(10, width - indent - markW - labelW));
      if (!dry) {
        const base = y0 + h + lh * 0.78;
        if (it.mark) drawMark(it.mark, x + indent, base, size);
        if (it.label) {
          w.font(true, size, it.labelColor ?? INK);
          doc.text(labelLines, x + indent + markW, base, { lineHeightFactor: lhf });
        }
        w.font(!!it.bold, size, it.color ?? INK);
        doc.text(lines, tx, base, { lineHeightFactor: lhf });
      }
      h += Math.max(lines.length, labelLines.length) * lh + (it.gap ?? 0.9);
    }
    return h;
  };
  // Sayfa sonunda bölünmeyen blok. Sayfadan uzunsa öğe öğe, tek öğe de uzunsa satır satır akar.
  w.block = (items, opts = {}) => {
    const list = items.filter((it) => it && it.text != null && it.text !== "");
    if (!list.length) return;
    const h = w.flow(list, { ...opts, dry: true });
    if (h > BOTTOM - TOP - 4) {
      if (list.length > 1) { for (const it of list) w.block([it], opts); return; }
      const it = list[0];
      const size = it.size ?? 8.5;
      w.font(!!it.bold, size, it.color ?? INK);
      const lines = doc.splitTextToSize(w.t(it.text), (opts.width ?? CW) - (it.indent ?? 0));
      for (const ln of lines) w.block([{ ...it, text: ln, mark: null, label: null, gap: 0 }], opts);
      w.y += it.gap ?? 0.9;
      return;
    }
    w.ensure(h + (opts.keep ?? 0));
    w.flow(list, { ...opts, y: w.y });
    w.y += h;
  };
  // Yan yana iki sütun blok (ör. Güçlü yönler | Gelişim alanları).
  w.columns = (left, right, { gapX = 6, keep = 0 } = {}) => {
    const cw = (CW - gapX) / 2;
    const hl = w.flow(left, { width: cw, dry: true });
    const hr = w.flow(right, { width: cw, dry: true });
    const h = Math.max(hl, hr);
    if (h > BOTTOM - TOP - 4) { w.block(left); w.block(right); return; }
    w.ensure(h + keep);
    w.flow(left, { x: M, width: cw, y: w.y });
    w.flow(right, { x: M + cw + gapX, width: cw, y: w.y });
    w.y += h;
  };

  // newPage: true → her zaman yeni sayfa; "soft" → sayfanın yarısından fazlası doluysa yeni sayfa (boş sayfa bırakmamak için).
  w.h1 = (title, sub, { newPage = false, keep = 40 } = {}) => {
    if (newPage === "soft" && w.y > TOP + (BOTTOM - TOP) * 0.45) w.newPage();
    else if (newPage === true) { if (w.y > TOP + 0.5) w.newPage(); } else {
      if (w.y > TOP + 0.5) w.y += 4;
      const subH = sub ? w.flow([{ text: sub, size: 7.5, color: GREY }], { dry: true }) : 0;
      w.ensure(11 + subH + keep);
    }
    w.font(true, 13, INK);
    doc.text(w.t(title), M, w.y + 5);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.35);
    doc.line(M, w.y + 7, M + CW, w.y + 7);
    w.y += 9.2;
    if (sub) w.y += w.flow([{ text: sub, size: 7.5, color: GREY }]);
    w.y += 1;
  };
  w.h2 = (title, { keep = 22, note, color = INK } = {}) => {
    if (w.y > TOP + 0.5) w.y += 2;
    w.ensure(6 + keep);
    w.font(true, 9.5, color);
    doc.text(w.t(title), M, w.y + 3.8);
    if (note) {
      w.font(false, 7, GREY);
      doc.text(w.t(note), M + CW, w.y + 3.8, { align: "right" });
    }
    w.y += 5.8;
  };
  w.note = (text, opts = {}) => w.block([{ text, size: 7.3, color: GREY, ...opts }]);

  // Tablo hücresi: dize ya da { content, styles, colSpan, draw(doc, cell) }.
  const cellIn = (c) => {
    if (c && typeof c === "object" && !Array.isArray(c)) return { ...c, content: w.t(c.content ?? "") };
    return w.t(c ?? "");
  };
  w.table = ({ head, body, columnStyles = {}, fontSize = 7.3, keep = 14, x, width, headStyles = {}, styles = {}, didDrawCell, gapAfter = 2.5 }) => {
    if (!body.length) return;
    w.ensure(keep);
    autoTable(doc, {
      startY: w.y,
      head: head ? [head.map(cellIn)] : undefined,
      body: body.map((row) => row.map(cellIn)),
      theme: "grid",
      margin: { top: TOP, bottom: PAGE_H - BOTTOM, left: x ?? M, right: width ? PAGE_W - (x ?? M) - width : M },
      tableWidth: width ?? "auto",
      styles: {
        font: fontName, fontStyle: "normal", fontSize, textColor: INK, lineColor: RULE, lineWidth: 0.1,
        cellPadding: { top: 0.85, right: 1.1, bottom: 0.85, left: 1.1 }, valign: "middle", overflow: "linebreak", fillColor: [255, 255, 255], ...styles,
      },
      headStyles: { font: fontName, fontStyle: "bold", fillColor: HEAD, textColor: INK, lineColor: RULE, lineWidth: 0.1, fontSize, ...headStyles },
      rowPageBreak: "avoid",
      showHead: "everyPage",
      columnStyles,
      didDrawCell: (data) => {
        const raw = data.cell.raw;
        if (data.section === "body" && raw && typeof raw === "object" && typeof raw.draw === "function") raw.draw(doc, data.cell);
        if (didDrawCell) didDrawCell(data);
      },
    });
    w.y = doc.lastAutoTable.finalY + gapAfter;
  };
  return w;
}

// ---------------------------------------------------------------- küçük çizimler
function drawArrow(doc, x, cy, dir, color) {
  doc.setFillColor(...color);
  if (dir === "up") doc.triangle(x, cy + 1.1, x + 2.3, cy + 1.1, x + 1.15, cy - 1.1, "F");
  else doc.triangle(x, cy - 1.1, x + 2.3, cy - 1.1, x + 1.15, cy + 1.1, "F");
}
function drawSpark(doc, pts, x, y, w, h) {
  const vals = pts.map((p) => p.NO);
  const real = vals.filter((v) => v != null);
  const lo = Math.min(0, ...real.map((v) => Math.floor(v / 25) * 25));
  const hi = 100;
  const px = (i) => x + (i + 0.5) * (w / vals.length);
  const py = (v) => y + h - ((v - lo) / (hi - lo)) * h;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.1);
  doc.line(x, y + h, x + w, y + h);
  doc.line(x, py(50), x + w, py(50));
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  for (let i = 0; i < vals.length - 1; i++) if (vals[i] != null && vals[i + 1] != null) doc.line(px(i), py(vals[i]), px(i + 1), py(vals[i + 1]));
  doc.setFillColor(...INK);
  for (let i = 0; i < vals.length; i++) if (vals[i] != null) doc.circle(px(i), py(vals[i]), 0.42, "F");
}
const colored = (content, color, bold = false) => ({ content, styles: { textColor: color, ...(bold ? { fontStyle: "bold" } : {}) } });
const pctCell = (v) => (v != null && v < 0 ? colored(fmtPct(v), RED) : fmtPct(v));
const dCell = (v) => (v == null ? "—" : colored(fmtInt(v), GREEN));
const yCell = (v) => (v == null ? "—" : colored(fmtInt(v), RED));
function trendCell(tr) {
  if (!tr || !tr.enough) return colored("Veri az", SOFT);
  if (tr.dir === "up" || tr.dir === "down") {
    const color = tr.dir === "up" ? GREEN : AMBER;
    return {
      content: `${fmtSigned(tr.delta)} puan`, styles: { textColor: color, cellPadding: { top: 0.85, right: 1.1, bottom: 0.85, left: 4.4 } },
      draw: (doc, cell) => drawArrow(doc, cell.x + 1.2, cell.y + cell.height / 2, tr.dir, color),
    };
  }
  return colored(TREND_LABEL.flat, GREY);
}

// ================================================================ bölümler
function headerLine(model) {
  const st = model.student || {};
  return [st.name || "Öğrenci", st.className, st.coach ? `Koç: ${st.coach}` : null, model.rangeText].filter(Boolean).join(" · ");
}
function reasonOf(w, s) {
  if (w.student) return s.reason.student;
  if (w.parent && hasLowPercentile(s.reason.coach)) return s.reason.student;
  return w.ct(s.reason.coach);
}
function schoolText(w, s) {
  if (!s.schoolLine) return null;
  if (w.coach) return s.schoolLine.coach;
  return s.schoolLine.student;
}
const recText = (w, r) => (w.student ? r.text.student : w.ct(r.text.coach));
const recTitle = (w, r) => (w.student ? r.title.student : w.ct(r.title.coach));

// ---------------------------------------------------------------- 1. Özet
function titleBlock(w, model) {
  const { doc } = w;
  const y = w.y;
  const logoSize = 13;
  let x = M;
  if (w.logo) {
    try { doc.addImage(w.logo, "PNG", M, y, logoSize, logoSize); x = M + logoSize + 4; } catch { x = M; }
  }
  w.font(true, 8.5, GREY);
  w.text(SCHOOL_NAME, x, y + 4);
  w.font(true, 16, INK);
  w.text("Gelişim Raporu", x, y + 11.5);
  w.y = y + logoSize + 3;

  // Kimlik şeridi
  const st = model.student || {};
  const parts = [st.className, st.coach ? `Koç: ${st.coach}` : null, `Aralık: ${model.rangeText} (${model.window?.label || ""})`, `Oluşturma: ${stampText(model.generatedAt)}`].filter(Boolean);
  w.font(false, 8, GREY);
  const lines = doc.splitTextToSize(w.t(parts.join(" · ")), CW - 8);
  const h = 9 + lines.length * 3.6;
  doc.setFillColor(...FILL);
  doc.roundedRect(M, w.y, CW, h, 1.5, 1.5, "F");
  w.font(true, 12, INK);
  w.text(st.name || "Öğrenci", M + 4, w.y + 6);
  if (model.daysToYks && (st.grade12 || st.gradeLevel === 12)) {
    w.font(true, 10, INK);
    w.text(`YKS'ye ${fmtInt(model.daysToYks)} gün`, M + CW - 4, w.y + 6, { align: "right" });
  }
  w.font(false, 8, GREY);
  doc.text(lines, M + 4, w.y + 10.8, { lineHeightFactor: 1.3 });
  w.y += h + 3.5;
}

function kpiBoxes(w, model) {
  const { doc } = w;
  const bw = (CW - 4) / 2, bh = 29;
  w.ensure(bh + 8);
  const y = w.y;
  ["TYT", "AYT"].forEach((e, i) => {
    const x = M + i * (bw + 4);
    const ex = model.exams[e];
    const a = ex.agg;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, bw, bh, 1.5, 1.5, "S");
    w.font(true, 10, INK);
    w.text(e, x + 4, y + 6);
    w.font(false, 7, GREY);
    w.text("Net oranı", x + 4, y + 11);
    w.font(true, 20, a.NO != null && a.NO < 0 ? RED : INK);
    w.text(a.n ? fmtPct(a.NO) : "—", x + 4, y + 19.5);
    w.font(false, 7, GREY);
    w.text(a.n ? `100 soruda ${fmtInt(a.NO)} net` : "Bu aralıkta kayıt yok", x + 4, y + 24.5);

    const dv = examDelivery(model, e);
    const rows = [
      ["Soru", a.n ? `${fmtInt(a.Q)} (${fmtInt(a.n)} kayıt)` : "0", INK],
      ["Teslim / Ele alınan", dv.V ? `${ratio(dv.delivered, dv.V)} / ${ratio(dv.delivered + dv.skip, dv.V)} (${fmtInt(dv.V)} ödev)` : "Vadesi gelen ödev yok", INK],
    ];
    const tr = ex.trend;
    let arrow = null;
    if (!tr.enough) rows.push(["Trend (son 4 hf / önceki 4 hf)", "Veri az", SOFT]);
    else if (tr.dir === "up") { rows.push(["Trend (son 4 hf / önceki 4 hf)", `Yükselişte: ${fmtPct(tr.a)} › ${fmtPct(tr.b)} (${fmtSigned(tr.delta)} puan)`, GREEN]); arrow = "up"; }
    else if (tr.dir === "down" && !w.student) { rows.push(["Trend (son 4 hf / önceki 4 hf)", `Düşüşte: ${fmtPct(tr.a)} › ${fmtPct(tr.b)} (${fmtSigned(tr.delta)} puan)`, AMBER]); arrow = "down"; }
    else if (tr.dir === "flat") rows.push(["Trend (son 4 hf / önceki 4 hf)", TREND_LABEL.flat, INK]);
    const rx = x + 37;
    rows.forEach(([label, value, color], k) => {
      const ry = y + 5.6 + k * 7.6;
      w.font(false, 6.8, GREY);
      w.text(label, rx, ry);
      let vx = rx;
      if (k === 2 && arrow) { drawArrow(doc, rx, ry + 2.6, arrow, color); vx = rx + 3.4; }
      w.font(true, 8.2, color);
      const v = doc.splitTextToSize(w.t(value), x + bw - 2.5 - vx)[0];
      doc.text(v, vx, ry + 3.7);
    });
  });
  w.y = y + bh + 2.5;
  const k = model.kpi;
  const prevLabel = { "4w": "önceki 4 haftaya göre", "8w": "önceki 8 haftaya göre" }[model.window?.key] || (model.window?.month ? "önceki aya göre" : null);
  const line = [
    `Tüm ödevler: teslim ${ratio(k.delivery.delivered, k.delivery.V)} · ele alınan ${ratio(k.delivery.delivered + k.delivery.skip, k.delivery.V)} (${fmtInt(k.delivery.V)} ödev)`,
    model.discipline.label ? `Düzen: ${model.discipline.label}` : null,
    `Aktif gün ${fmtInt(k.activeDays.n)}/${fmtInt(k.activeDays.of)}`,
    prevLabel && k.questions.pctDelta != null ? `Soru sayısı ${prevLabel} ${signedPct(k.questions.pctDelta)}` : null,
  ].filter(Boolean).join(" · ");
  w.block([{ text: line, size: 7.8, color: GREY }]);
}

function subjectItems(w, list, empty) {
  if (!list.length) return [{ text: empty, size: 8, color: SOFT }];
  const out = [];
  for (const s of list) {
    const school = s.adjusted === 0 && !s.fromKonu ? schoolText(w, s) : null;
    out.push({ text: s.name, bold: true, size: 8.5, mark: "•", gap: 0.2, color: LABEL_COLOR[s.label] === INK ? INK : LABEL_COLOR[s.label] });
    out.push({ text: `${reasonOf(w, s)}${school ? ` · ${school}` : ""}`, size: 7.6, color: GREY, indent: 4.2, gap: 1.4 });
  }
  return out;
}

function strengthsBlock(w, model) {
  const strongTitle = model.chips.strongTitle === "En iyi gidenler" ? "En iyi gidenler" : "Güçlü yönler";
  const left = [{ text: strongTitle, bold: true, size: 9.5, gap: 1.2 }, ...subjectItems(w, model.chips.strong, "Etiket için henüz veri az.")];
  const right = [{ text: "Gelişim alanları", bold: true, size: 9.5, gap: 1.2 }, ...subjectItems(w, model.chips.focusAll.slice(0, 3), "Şu an odak ders yok.")];
  w.gap(2);
  w.columns(left, right);
}

function goalItems(w, model) {
  const goals = model.week.goals || [];
  const items = [{ text: `Bu haftanın hedefleri (${model.week.isoNo}. hafta)`, bold: true, size: 9.5, gap: 1.2 }];
  if (!goals.length) items.push({ text: "Bu hafta için hedef yok.", size: 8, color: SOFT });
  for (const g of goals) {
    items.push({ text: `${g.text} — ${fmtInt(g.progress)}/${fmtInt(g.target)}${g.met ? " · tamam" : ""}`, size: 8.2, mark: g.met ? "boxDone" : "box", gap: 1.1 });
  }
  return items;
}
function winItems(w, model) {
  const items = [{ text: "Bu dönemin kazanımları", bold: true, size: 9.5, gap: 1.2 }];
  const list = model.achievements.filter((r) => recTitle(w, r)).slice(0, 5);
  if (!list.length) items.push({ text: "Bu aralıkta henüz kutlama yok.", size: 8, color: SOFT });
  for (const r of list) {
    const title = recTitle(w, r);
    const ev = recEvidence(w, r);
    const dup = !ev || title.includes(ev) || ev.split(" · ").every((part) => title.includes(part.trim()));
    items.push({ text: title, size: 8.2, mark: "•", gap: dup ? 1.2 : 0.2 });
    if (!dup) items.push({ text: ev, size: 7.2, color: GREY, indent: 4.2, gap: 1.2 });
  }
  return items;
}

// Kanıt satırı: koç nüshasında koç kanıtı; öğrenci ve veli nüshasında öğrenciye uygun kanıt (50 altı yüzdelik içermez).
function recEvidence(w, r) {
  return w.coach ? r.evidence : w.ct(r.evidenceStudent ?? r.evidence);
}
function recItems(w, r, i) {
  const owner = w.student ? null : `Sahibi: ${r.owner}${r.ownerName ? ` (${r.ownerName} Hoca)` : ""}`;
  const kind = r.type === "kutlama" ? "Kutlama" : null;
  return [
    { text: recText(w, r), size: 8.3, mark: `${i + 1}.`, markW: 5.5, gap: 0.4 },
    { text: [kind, `Kanıt: ${recEvidence(w, r)}`, owner].filter(Boolean).join(" · "), size: 7.1, color: GREY, indent: 5.5, gap: 2 },
  ];
}
function recsBlock(w, model, { title } = {}) {
  const list = w.student ? model.recs.pdfStudent : model.recs.pdfCoach;
  const shown = list.filter((r) => recText(w, r));
  w.h2(title || (w.student ? "Senin için öneriler" : "Öneriler"), { keep: 18, note: w.full ? `${shown.length} öneri · tam liste Ek E'de` : `${shown.length} öneri` });
  if (!shown.length) { w.note("Şu an öneri yok."); return; }
  shown.forEach((r, i) => w.block(recItems(w, r, i)));
}

function renderSummary(w, model) {
  titleBlock(w, model);
  if (!model.enough) { renderSparseSummary(w, model); return; }
  kpiBoxes(w, model);
  strengthsBlock(w, model);
  w.gap(1.5);
  w.columns(goalItems(w, model), winItems(w, model));
  recsBlock(w, model);
}

// Toplam kayıt < 3: "Raporun oluşuyor" + ödev düzeni + açık ödevler + hedefler.
function renderSparseSummary(w, model) {
  const r00 = model.recs.all.find((r) => r.id === "R00");
  const text = r00 ? recText(w, r00) : "Raporun oluşuyor.";
  const { doc } = w;
  w.font(false, 9, INK);
  const lines = doc.splitTextToSize(w.t(text), CW - 10);
  const h = 11 + lines.length * 4.2;
  w.ensure(h + 4);
  doc.setFillColor(...FILL);
  doc.roundedRect(M, w.y, CW, h, 1.5, 1.5, "F");
  w.font(true, 11, INK);
  w.text("Raporun oluşuyor", M + 5, w.y + 6.5);
  w.font(false, 9, INK);
  doc.text(lines, M + 5, w.y + 12, { lineHeightFactor: 1.3 });
  w.y += h + 2;
  w.note(`${fewLine(model.totalRecords, model.exams.TYT.agg.Q + model.exams.AYT.agg.Q)} — ders etiketi, trend ve konu analizi için ders başına en az 3 kayıt, 60 soru ve 2 farklı hafta gerekir.`);

  w.h2("Ödev düzeni", { keep: 20 });
  disciplineSummaryTable(w, model);
  const open = model.discipline.open;
  if (open.length) {
    w.h2(`Açık ve süresi geçmiş ödevler (${open.length})`, { keep: 16 });
    w.table({
      head: ["Ders", "Konu", "Son gün", "Durum"],
      body: open.map((it) => [it.name, it.topicName, fmtDay(it.endDay), it.state === "silent" ? colored(`Sessiz · ${fmtInt(it.overdueDays)} gün geçti`, w.coach ? RED : AMBER) : `Açık · ${fmtInt(it.daysLeft)} gün kaldı`]),
      columnStyles: { 0: { cellWidth: 34 }, 2: { cellWidth: 20 }, 3: { cellWidth: 40 } },
    });
  }
  w.gap(1);
  w.columns(goalItems(w, model), winItems(w, model));
  const others = (w.student ? model.recs.pdfStudent : model.recs.pdfCoach).filter((r) => r.id !== "R00" && recText(w, r));
  if (others.length) {
    w.h2(w.student ? "Senin için öneriler" : "Öneriler", { keep: 18 });
    others.forEach((r, i) => w.block(recItems(w, r, i)));
  }
}

// ---------------------------------------------------------------- 2. Koç eki (yalnız koç nüshası)
function renderCoachAppendix(w, model, { ai, withAi = true } = {}) {
  const c = model.coach;
  w.h1("Koç eki", "Yalnızca koç nüshasında yer alır. Koçun özel notları hiçbir PDF'e eklenmez.", { newPage: "soft", keep: 60 });
  w.block([
    { text: `Durum: ${c.statusLabel}`, bold: true, size: 11, color: STATUS_COLOR[c.status] || INK, mark: { dot: STATUS_COLOR[c.status] || INK }, gap: 0.8 },
    { text: c.reasons.length ? `Nedenler: ${c.reasons.join(" · ")}` : "Belirgin bir sorun görünmüyor.", size: 8.3, color: GREY, indent: 4.2, gap: 1 },
  ]);

  w.h2("Görüşme gündemi", { keep: 16 });
  c.agenda.forEach((a, i) => w.block([{ text: a, size: 8.3, mark: `${i + 1}.`, markW: 5.5, gap: 1.3 }]));

  w.h2("İletişim göstergeleri", { keep: 24 });
  const d = model.discipline;
  const kv = [
    ["Son giriş", daysAgo(c.lastSeenDays)],
    ["Son kayıt", daysAgo(c.lastRecordDays)],
    ["Sessiz ödev (son 28 gün)", c.silent28 ? colored(fmtInt(c.silent28), RED, true) : "0"],
    ["Düzen serisi", `${fmtInt(c.streak)} hafta (en uzun ${fmtInt(d.longest)})`],
    ["Okul ödevi: teslim / ele alınan", c.school.V ? `${ratio(c.school.delivered, c.school.V)} / ${ratio(c.school.delivered + c.school.skip, c.school.V)} (${fmtInt(c.school.V)} ödev)` : "Vadesi gelen yok"],
    ["Kişisel ödev: teslim / ele alınan", c.personal.V ? `${ratio(c.personal.delivered, c.personal.V)} / ${ratio(c.personal.delivered + c.personal.skip, c.personal.V)} (${fmtInt(c.personal.V)} ödev)` : "Vadesi gelen yok"],
    ["Hatırlatmadan sonra teslim", c.afterReminder.total ? `${fmtInt(c.afterReminder.done)}/${fmtInt(c.afterReminder.total)}` : "Hatırlatma yok"],
    ["Aktif gün (son 7 / son 28 gün)", `${fmtInt(d.active7)} / ${fmtInt(d.active28)}`],
  ];
  const rows = [];
  for (let i = 0; i < kv.length; i += 2) rows.push([colored(kv[i][0], GREY), kv[i][1], colored(kv[i + 1]?.[0] ?? "", GREY), kv[i + 1]?.[1] ?? ""]);
  w.table({ body: rows, fontSize: 7.8, columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 45 }, 2: { cellWidth: 46 }, 3: { cellWidth: 45 } } });
  if (c.personalLoad) w.note("Kişisel ödevlerde teslim, okul ödevlerinden en az 20 puan düşük: kişisel ödev yükünü gözden geçirin.", { color: AMBER });

  w.h2("Öğrenci notları", { keep: 12, note: "teslim ve pas notları, en yeni 5" });
  if (!c.notes.length) w.note("Bu dönemde öğrenci notu yok.");
  for (const n of c.notes) {
    w.block([{ text: `${n.day != null ? fmtDay(n.day) : "—"} · ${n.kind === "pas" ? "pas notu" : "teslim notu"} · ${n.name} – ${n.topic}: "${n.text}"`, size: 8, mark: "•", gap: 1 }]);
  }

  w.h2("Veri notları", { keep: 12 });
  const dn = c.dataNotes;
  const notes = [];
  if (dn.photoRate != null) notes.push(`Fotoğraflı teslim oranı ${fmtPct(dn.photoRate)}.`);
  if (dn.withE) notes.push(`Beklenen soru sayısı bilinen ${fmtInt(dn.withE)} ödevde kısmi giriş ${fmtPct(dn.partialRate)}, fazla giriş ${fmtPct(dn.overRate)}.`);
  if (dn.freeGap != null) notes.push(`Serbest çalışma net oranı ${fmtPct(dn.freeNO)}, ödev net oranı ${fmtPct(dn.hwNO)} (fark ${fmtSigned(dn.freeGap)} puan).`);
  if (dn.unmatched) notes.push(`Müfredat listesiyle eşleşmeyen konu: ${fmtInt(dn.unmatched)} kayıt (kendi başlığıyla "~" işaretli).`);
  if (dn.untracked?.length) notes.push(`Takip dışı dersler: ${dn.untracked.map((u) => `${u.name} (${fmtInt(u.schoolItems)} okul ödevi, ${fmtInt(u.records)} kayıt)`).join("; ")}.`);
  for (const s of model.subjects) for (const n of s.notes || []) if (n.coachOnly) notes.push(`${s.name}: ${n.text}.`);
  if (dn.approx) notes.push("Bu dönemin D/Y/B oranlarını yaklaşık kabul edin (kısmi/fazla giriş ya da serbest çalışma–ödev farkı yüksek).");
  if (!notes.length) notes.push("Veri girişinde dikkat gerektiren bir durum yok.");
  w.block(notes.map((text) => ({ text, size: 8, mark: "•", gap: 1 })));

  // El yazısı için boş satırlar
  w.h2("Görüşme notları", { keep: 38 });
  const { doc } = w;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  const lines = withAi && ai ? 5 : Math.max(5, Math.min(8, Math.floor((BOTTOM - w.y - 2) / 7.5)));
  for (let i = 0; i < lines; i++) {
    w.y += 7.5;
    doc.line(M, w.y, M + CW, w.y);
  }
  w.y += 3;
  if (withAi && ai) renderAi(w, ai);
}

// ---------------------------------------------------------------- Yapay zekâ incelemesi (yalnız koç)
const AI_LEVEL = { yeterli: "Veri yeterli", sinirli: "Veri sınırlı", yetersiz: "Veri yetersiz" };
function renderAi(w, ai, { asSection = false } = {}) {
  if (!ai) return;
  if (asSection) w.h1("Yapay zekâ incelemesi", null, { keep: 40 });
  else w.h2("Yapay zekâ incelemesi", { keep: 40 });
  const meta = [AI_LEVEL[ai.veriYeterliligi] || null, ai.generatedAt ? `Oluşturma: ${stampText(ai.generatedAt)}` : null].filter(Boolean).join(" · ");
  const { doc } = w;
  const disc = "Yapay zekâ önerisidir; son karar koçundur. Modele kimlik bilgisi gönderilmez.";
  w.ensure(12);
  doc.setFillColor(...FILL);
  doc.roundedRect(M, w.y, CW, meta ? 10.5 : 7, 1.2, 1.2, "F");
  w.font(true, 8, AMBER);
  w.text(disc, M + 3, w.y + 4.6);
  if (meta) { w.font(false, 7.3, GREY); w.text(meta, M + 3, w.y + 8.6); }
  w.y += (meta ? 10.5 : 7) + 2.5;
  const arr = (x) => (Array.isArray(x) ? x.filter((v) => v != null && v !== "") : []);
  if (ai.ozet) w.block([{ text: "Özet", bold: true, size: 8.8, gap: 0.6 }, { text: ai.ozet, size: 8.3, gap: 1.6 }]);
  const gy = arr(ai.gucluYonler);
  if (gy.length) w.block([{ text: "Güçlü yönler", bold: true, size: 8.8, gap: 0.6 }, ...gy.map((t) => ({ text: t, size: 8.2, mark: "•", gap: 0.8 }))]);
  const ga = arr(ai.gelisimAlanlari);
  if (ga.length) {
    w.block([{ text: "Gelişim alanları", bold: true, size: 8.8, gap: 0.6 }]);
    for (const g of ga) {
      w.block([
        { text: g.alan || "", bold: true, size: 8.2, mark: "•", gap: 0.3 },
        g.kanit ? { text: `Kanıt: ${g.kanit}`, size: 7.8, color: GREY, indent: 4.2, gap: 0.3 } : null,
        g.oneri ? { text: `Öneri: ${g.oneri}`, size: 8, indent: 4.2, gap: 1.1 } : null,
      ].filter(Boolean));
    }
  }
  const ko = arr(ai.kocaOneriler);
  if (ko.length) w.block([{ text: "Koça öneriler", bold: true, size: 8.8, gap: 0.6 }, ...ko.map((t, i) => ({ text: t, size: 8.2, mark: `${i + 1}.`, markW: 5.5, gap: 0.8 }))]);
  if (ai.ogrenciyleKonusma) w.block([{ text: "Öğrenciyle konuşma", bold: true, size: 8.8, gap: 0.6 }, { text: ai.ogrenciyleKonusma, size: 8.2, gap: 1.4 }]);
  const dk = arr(ai.dikkat);
  if (dk.length) w.block([{ text: "Dikkat", bold: true, size: 8.8, gap: 0.6, color: AMBER }, ...dk.map((t) => ({ text: t, size: 8.2, mark: "•", gap: 0.8 }))]);
}

// ---------------------------------------------------------------- 3. Ders karnesi
function karneRows(w, rows) {
  return rows.map((s) => {
    const a = s.agg;
    const has = a.n > 0;
    const lab = `${LABELS[s.label]}${s.from8w ? " (8 hf)" : ""}${s.konuBadge ? " · konu pası" : ""}`;
    let school = "—";
    if (s.schoolLine) {
      if (w.coach) school = `${fmtInt(s.pTilde)} (${fmtInt(s.compCount)} ödev)`;
      else school = s.schoolLine.student.replace(/^Okul ödevlerinde /, "").replace(/^Okul medyanına/, "medyana");
    }
    return [
      subjectShort(s),
      colored(lab, LABEL_COLOR[s.label], true),
      fmtInt(a.n), fmtInt(a.Q),
      has ? dCell(a.D) : "—", has ? yCell(a.Y) : "—", has ? fmtInt(a.B) : "—",
      has ? fmtNet(a.net) : "—", pctCell(a.NO), fmtPct(a.accuracy), fmtPct(a.blankRate),
      trendCell(s.trend),
      /üst çeyrek/.test(school) ? colored(school, GREEN) : school,
      s.konuPass ? colored(fmtInt(s.konuPass), AMBER, true) : "—",
    ];
  });
}
function renderKarne(w, model, { newPage = "soft" } = {}) {
  w.h1("Ders karnesi", "Net = D − Y/4 · Net oranı = 100 soruda net. Etiket küçültülmüş net oranıyla verilir: ≥ %65 Güçlü, < %40 Odak, arası Yolunda; okul karşılaştırması etiketi en fazla bir kademe değiştirir. Trend: son 4 hafta ile önceki 4 hafta.", { newPage, keep: 50 });
  const head = ["Ders", "Etiket", "Kayıt", "Soru", "D", "Y", "B", "Net", "Net oranı", "İsabet", "Boş", "Trend", w.coach ? "Okul yüzdeliği" : "Okul", "Konu pası"];
  const num = { halign: "right" };
  const cs = {
    0: { cellWidth: w.coach ? 32 : 29 }, 1: { cellWidth: 19 }, 2: { cellWidth: 9, ...num }, 3: { cellWidth: 10, ...num }, 4: { cellWidth: 8, ...num }, 5: { cellWidth: 8, ...num },
    6: { cellWidth: 8, ...num }, 7: { cellWidth: 11, ...num }, 8: { cellWidth: 11, ...num }, 9: { cellWidth: 11, ...num }, 10: { cellWidth: 9, ...num },
    11: { cellWidth: 16 }, 12: { cellWidth: w.coach ? 21 : 24 }, 13: { cellWidth: 9, halign: "center" },
  };
  let any = false;
  for (const e of ["TYT", "AYT"]) {
    const rows = model.subjects.filter((s) => s.examType === e && s.tracked && hasSubjectData(s)).sort(byWeight);
    if (!rows.length) continue;
    any = true;
    w.h2(`${e} dersleri`, { keep: 14 });
    w.table({ head, body: karneRows(w, rows), columnStyles: cs, fontSize: 7 });
  }
  if (!any) w.note(fewLine(model.totalRecords, model.kpi.questions.Q));
  const untracked = model.subjects.filter((s) => !s.tracked);
  if (untracked.length) {
    w.note(`Takip dışı AYT dersleri (son 56 günde teslim, serbest çalışma ya da kişisel ödev yok; alan bilgisi olmadığından hesaplara girmez): ${untracked.map((s) => s.name).join(", ")}.`);
  }

  // Etiket gerekçeleri — her etiketin sayılarla "Neden?" açıklaması
  const labeled = model.subjects.filter((s) => s.tracked && hasSubjectData(s)).sort(byWeight);
  if (labeled.length) {
    w.h2("Etiket gerekçeleri", { keep: 16 });
    const items = [];
    for (const s of labeled) {
      const notes = (s.notes || []).filter((n) => w.coach || !n.coachOnly).map((n) => n.text);
      items.push({ label: s.name, labelW: 34, text: `${reasonOf(w, s)}${notes.length ? ` (${notes.join("; ")})` : ""}`, size: 7.4, gap: 0.9 });
    }
    w.block(items);
  }

  // Güçlü yönler ve gelişim alanları — konu düzeyinde kanıtla
  const strong = model.chips.strong.slice(0, 3);
  const focus = model.chips.focusAll.slice(0, 3);
  const left = [{ text: model.chips.strongTitle === "En iyi gidenler" ? "En iyi gidenler" : "Güçlü yönler", bold: true, size: 9, gap: 1 }];
  for (const s of strong) {
    const top = s.lists.solid.slice(0, 2);
    left.push({ text: `${s.name}: ${top.length ? `en sağlam konular ${top.map((t) => `${t.name} (${fmtPct(t.NO)})`).join(", ")}` : `net oranı ${fmtPct(s.labelAgg.NO)}, ${fmtInt(s.labelAgg.n)} kayıt`}; isabet ${fmtPct(s.agg.accuracy)}.`, size: 7.8, mark: "•", gap: 1 });
  }
  if (!strong.length) left.push({ text: "Etiket için henüz veri az.", size: 7.8, color: SOFT });
  const right = [{ text: "Gelişim alanları", bold: true, size: 9, gap: 1 }];
  for (const s of focus) {
    const first = s.lists.first.slice(0, 2);
    right.push({ text: `${s.name}: ${first.length ? `önce ${first.map((t) => `${t.name} (${fmtPct(t.NO)})`).join(", ")}` : `net oranı ${fmtPct(s.labelAgg.NO)}`}; boş ${fmtPct(s.agg.blankRate)}, isabet ${fmtPct(s.agg.accuracy)}${s.konuPass ? `, ${fmtInt(s.konuPass)} konu pası` : ""}.`, size: 7.8, mark: "•", gap: 1 });
  }
  if (!focus.length) right.push({ text: "Şu an odak ders yok.", size: 7.8, color: SOFT });
  w.gap(1);
  w.columns(left, right);
}

// ---------------------------------------------------------------- 4. Gelişim trendi
function trendSummary(w, tr) {
  if (!tr || !tr.enough) return "Trend için veri az";
  const base = `Son 4 hafta ${fmtPct(tr.b)}, önceki 4 hafta ${fmtPct(tr.a)}`;
  if (w.student && tr.dir === "down") return base;
  return `${base} · ${TREND_LABEL[tr.dir]} (Δ ${fmtSigned(tr.delta)} puan)`;
}
function drawExamChart(w, exam, tr) {
  const { doc } = w;
  const weeks = tr.weeks;
  const H = 46;
  w.ensure(H + 2);
  const y0 = w.y;
  w.font(true, 9.5, INK);
  w.text(`${exam} — haftalık net oranı`, M, y0 + 3.8);
  w.font(false, 7.3, GREY);
  w.text(trendSummary(w, tr.trend), M + CW, y0 + 3.8, { align: "right" });
  const px = M + 11, pw = CW - 22, py = y0 + 7.5, ph = H - 17;
  const vals = weeks.map((k) => k.NO);
  const real = vals.filter((v) => v != null);
  const lo = Math.min(0, ...real.map((v) => Math.floor(v / 25) * 25));
  const hi = 100;
  const Y = (v) => py + ph - ((v - lo) / (hi - lo)) * ph;
  const maxQ = niceMax(Math.max(1, ...weeks.map((k) => k.Q)));
  const step = pw / weeks.length;
  const cx = (i) => px + (i + 0.5) * step;
  // ızgara + sol eksen (net oranı)
  doc.setLineWidth(0.1);
  for (let g = lo; g <= hi; g += 25) {
    doc.setDrawColor(...(g === 0 ? SOFT : RULE));
    doc.line(px, Y(g), px + pw, Y(g));
    w.font(false, 6, GREY);
    w.text(fmtPct(g), px - 1.5, Y(g) + 1, { align: "right" });
  }
  // soru sütunları (gri, sağ eksen)
  doc.setFillColor(222, 222, 222);
  weeks.forEach((k, i) => {
    if (!k.Q) return;
    const bh = (k.Q / maxQ) * ph;
    doc.rect(cx(i) - step * 0.28, py + ph - bh, step * 0.56, bh, "F");
  });
  w.font(false, 6, SOFT);
  w.text(fmtInt(maxQ), px + pw + 1.5, py + 1.5);
  w.text(fmtInt(maxQ / 2), px + pw + 1.5, py + ph / 2 + 1);
  w.text("0 soru", px + pw + 1.5, py + ph + 1);
  // net oranı çizgisi: yalnızca ardışık dolu haftalar arasında (boşluk = veri yok)
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  for (let i = 0; i < vals.length - 1; i++) if (vals[i] != null && vals[i + 1] != null) doc.line(cx(i), Y(vals[i]), cx(i + 1), Y(vals[i + 1]));
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] == null) continue;
    doc.setFillColor(...(vals[i] < 0 ? RED : INK));
    doc.circle(cx(i), Y(vals[i]), 0.85, "F");
  }
  let li = -1;
  for (let i = vals.length - 1; i >= 0; i--) if (vals[i] != null) { li = i; break; }
  if (li >= 0) {
    w.font(true, 7.5, vals[li] < 0 ? RED : INK);
    const ly = Y(vals[li]) - 2;
    w.text(fmtPct(vals[li]), cx(li), ly < py + 2 ? Y(vals[li]) + 4 : ly, { align: "center" });
  }
  // x ekseni: hafta no + Pazartesi tarihi
  weeks.forEach((k, i) => {
    w.font(false, 6, GREY);
    w.text(`${k.isoNo}. hf`, cx(i), py + ph + 3.4, { align: "center" });
    w.font(false, 5.6, SOFT);
    w.text(fmtDay(k.start), cx(i), py + ph + 6.2, { align: "center" });
  });
  if (tr.filled < 2) {
    w.font(false, 7.5, GREY);
    w.text("Çizgi için veri az: en az 2 hafta, haftada en az 20 soru gerekir.", px + pw / 2, py + ph / 2, { align: "center" });
  }
  w.y = y0 + H;
}
function renderTrend(w, model) {
  w.h1("Gelişim trendi", "Çizgi: haftalık net oranı (yalnızca en az 20 soru çözülen haftalar; çizgideki boşluk = o hafta veri yok). Gri sütun: haftalık soru sayısı (sağ eksen). Trend son 4 hafta ile önceki 4 hafta arasında test edilir.", { newPage: "soft", keep: 60 });
  for (const e of ["TYT", "AYT"]) {
    const tr = model.trend[e];
    if (!tr.weeks.some((k) => k.Q > 0)) { w.note(`${e}: son 12 haftada kayıt yok.`); continue; }
    drawExamChart(w, e, tr);
  }

  // Ders trendleri
  const rows = model.subjects.filter((s) => s.tracked && hasSubjectData(s)).sort(byWeight);
  if (rows.length) {
    w.h2("Ders trendleri", { keep: 18, note: "sparkline: son 8 hafta, haftada ≥ 20 soru" });
    const body = rows.map((s) => {
      const tr = s.trend;
      let conf = "—";
      if (tr.enough) {
        conf = tr.hasSchool ? `okul medyanı ${fmtPct(tr.ca)} › ${fmtPct(tr.cb)}` : "okul verisi yok";
        if (tr.note) conf += ` · ${tr.note}`;
        if (w.coach && tr.coachNote) conf += ` · ${tr.coachNote}`;
      }
      return [
        s.name,
        { content: "", styles: { minCellHeight: 5.6 }, draw: (doc, cell) => drawSpark(doc, s.spark, cell.x + 1.2, cell.y + 0.9, cell.width - 2.4, cell.height - 1.8) },
        tr.enough ? pctCell(tr.a) : "—", tr.enough ? pctCell(tr.b) : "—",
        trendCell(tr),
        colored(LABELS[s.label], LABEL_COLOR[s.label], true),
        conf,
      ];
    });
    w.table({
      head: ["Ders", "8 haftalık", "Önceki 4 hf", "Son 4 hf", "Δ", "Etiket", "Okul teyidi"], body, fontSize: 7,
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 28 }, 2: { cellWidth: 15, halign: "right" }, 3: { cellWidth: 15, halign: "right" }, 4: { cellWidth: 19 }, 5: { cellWidth: 16 } },
    });
  }

  // Son 12 hafta
  const T = model.trend.TYT.weeks, A = model.trend.AYT.weeks;
  const hasAyt = A.some((k) => k.Q > 0);
  w.h2("Son 12 hafta", { keep: 20, note: "net oranı yalnızca haftada ≥ 20 soru varsa" });
  const head = hasAyt
    ? ["Hafta", "TYT kayıt", "TYT soru", "TYT net oranı", "AYT kayıt", "AYT soru", "AYT net oranı", "Aktif gün"]
    : ["Hafta", "Kayıt", "Soru", "Net oranı", "Aktif gün"];
  const body = T.map((k, i) => (hasAyt
    ? [weekLabel(k.isoNo, k.start), fmtInt(k.n), fmtInt(k.Q), pctCell(k.NO), fmtInt(A[i].n), fmtInt(A[i].Q), pctCell(A[i].NO), `${fmtInt(k.active)}/7`]
    : [weekLabel(k.isoNo, k.start), fmtInt(k.n), fmtInt(k.Q), pctCell(k.NO), `${fmtInt(k.active)}/7`]));
  const cs = {};
  for (let i = 1; i < head.length; i++) cs[i] = { halign: "right" };
  cs[0] = { cellWidth: 28 };
  w.table({ head, body, columnStyles: cs, fontSize: 7 });
}

// ---------------------------------------------------------------- 5. Ödev düzeni
function skipBreakdown(skips) {
  const c = { KONU: 0, ZAMAN: 0, KAYNAK: 0, DIGER: 0 };
  for (const it of skips) if (c[it.skipReason] != null) c[it.skipReason] += 1;
  return `${c.KONU}/${c.ZAMAN}/${c.KAYNAK}/${c.DIGER}`;
}
function discRow(w, name, c, skips, bold = false) {
  const cell = (v) => (bold ? { content: v, styles: { fontStyle: "bold" } } : v);
  return [
    cell(name), cell(fmtInt(c.V)), cell(fmtInt(c.onTime)), cell(fmtInt(c.fixed || 0)), cell(fmtInt(c.late)),
    cell(c.skip ? `${fmtInt(c.skip)} (${skipBreakdown(skips)})` : "0"),
    c.silent ? colored(fmtInt(c.silent), w.coach ? RED : AMBER, true) : cell("0"),
    cell(ratio(c.delivered, c.V)), cell(ratio(c.delivered + c.skip, c.V)),
  ];
}
// "Pastan dönüş": süresi içinde pas geçilip sonra teslim edilen ödev — teslim sayılır, gecikme sayılmaz.
const DISC_HEAD = ["Verilen", "Zamanında", "Pastan dönüş", "Geç", "Pas (K/Z/Ka/D)", "Sessiz", "Teslim %", "Ele alınan %"];
function disciplineSummaryTable(w, model) {
  const d = model.discipline;
  const cs = { 0: { cellWidth: 36 } };
  for (let i = 1; i <= DISC_HEAD.length; i++) cs[i] = { halign: "right" };
  w.table({
    head: ["", ...DISC_HEAD],
    body: [
      discRow(w, "Okul ödevleri", d.school, d.skips.filter((it) => it.isSchool)),
      discRow(w, "Kişisel ödevler", d.personal, d.skips.filter((it) => !it.isSchool)),
      discRow(w, "Toplam", d.total, d.skips, true),
    ],
    columnStyles: cs, fontSize: 7.5,
  });
}
function drawHeatmap(w, model) {
  const { doc } = w;
  const d = model.discipline;
  const hm = d.heatmap;
  if (!hm.length) return;
  const rows = [];
  for (let i = 0; i < hm.length; i += 7) rows.push(hm.slice(i, i + 7));
  const labelW = 25, cw = 13.5, ch = 5.2, headH = 4.5;
  w.ensure(headH + Math.min(rows.length, 8) * ch + 10);
  const x0 = M;
  let y = w.y;
  const drawHead = () => {
    w.font(true, 6.5, GREY);
    ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].forEach((n, i) => w.text(n, x0 + labelW + i * cw + cw / 2, y + 3, { align: "center" }));
    y += headH;
  };
  const panelX = x0 + labelW + 7 * cw + 6;
  const panelY = y;
  drawHead();
  const tone = (q) => (q >= 100 ? [115, 115, 115] : q >= 60 ? [165, 165, 165] : q >= 30 ? [205, 205, 205] : q > 0 ? [234, 234, 234] : null);
  for (const row of rows) {
    if (y + ch > BOTTOM) { w.newPage(); y = w.y; drawHead(); }
    w.font(false, 6.5, GREY);
    w.text(`${isoWeekNo(weekOf(row[0].day))}. hf · ${fmtDay(row[0].day)}`, x0, y + ch / 2 + 1);
    row.forEach((c, i) => {
      const cx = x0 + labelW + i * cw;
      const t = c.future || !c.inWindow ? null : tone(c.Q);
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.15);
      if (t) { doc.setFillColor(...t); doc.rect(cx, y, cw, ch, "FD"); } else doc.rect(cx, y, cw, ch, "S");
      if (!c.future && c.Q > 0) {
        w.font(c.inWindow, 6.8, !c.inWindow ? SOFT : c.Q >= 100 ? [255, 255, 255] : INK);
        if (!c.inWindow) w.font(false, 6.3, SOFT);
        w.text(fmtInt(c.Q), cx + cw / 2, y + ch / 2 + 1.1, { align: "center" });
      }
    });
    y += ch;
  }
  // lejant
  y += 2;
  w.font(false, 6.5, GREY);
  let lx = x0;
  w.text("Hücredeki sayı = o gün çözülen soru. Ton:", lx, y + 2.6);
  lx += doc.getTextWidth(w.t("Hücredeki sayı = o gün çözülen soru. Ton:")) + 2;
  for (const [q, label] of [[1, "1–29"], [30, "30–59"], [60, "60–99"], [100, "100+"]]) {
    doc.setFillColor(...tone(q));
    doc.setDrawColor(...RULE);
    doc.rect(lx, y, 4, 3.2, "FD");
    w.font(false, 6.5, GREY);
    w.text(label, lx + 5, y + 2.6);
    lx += 5 + doc.getTextWidth(w.t(label)) + 3;
  }
  w.text("Tonsuz, soluk sayı: rapor aralığı dışı.", lx + 1, y + 2.6);
  y += 5;
  // yan panel (ısı haritasının sağında)
  if (panelX + 40 <= M + CW && panelY < BOTTOM - 30) {
    const items = [
      { text: "Çalışma düzeni", bold: true, size: 8.3, gap: 1 },
      { label: "Aktif gün", labelW: 24, text: `${fmtInt(model.kpi.activeDays.n)}/${fmtInt(model.kpi.activeDays.of)} (son 7 günde ${fmtInt(d.active7)})`, size: 7.3 },
      { label: "Düzen serisi", labelW: 24, text: `${fmtInt(d.streak)} hafta (en uzun ${fmtInt(d.longest)})`, size: 7.3 },
      d.avgDelay != null ? { label: "Ort. gecikme", labelW: 24, text: `${fmtDec(d.avgDelay, 1)} gün (geç teslimlerde)`, size: 7.3 } : null,
      d.lastDayRate != null ? { label: "Son güne kalan", labelW: 24, text: `${fmtPct(d.lastDayRate)} (${fmtInt(d.multiDay)} çok günlük ödev)`, size: 7.3 } : null,
      d.afterReminder.total ? { label: "Hatırlatma sonrası", labelW: 24, text: `${fmtInt(d.afterReminder.done)}/${fmtInt(d.afterReminder.total)} teslim`, size: 7.3 } : null,
    ].filter(Boolean);
    w.flow(items, { x: panelX, width: M + CW - panelX, y: panelY });
  }
  w.y = Math.max(y, w.y) + 1;
}
function disciplineComment(model) {
  const t = model.discipline.total;
  if (!t.V) return "Bu aralıkta vadesi gelen ödev yok.";
  const s1 = `Vadesi gelen ${fmtInt(t.V)} ödevden ${fmtInt(t.delivered)} tanesi teslim edildi (${fmtInt(t.onTime)} zamanında${t.fixed ? `, ${fmtInt(t.fixed)} pas geçildikten sonra` : ""}, ${fmtInt(t.late)} geç), ${fmtInt(t.skip)} tanesi pas geçildi, ${fmtInt(t.silent)} tanesi sessiz kaldı.`;
  let s2 = "";
  if (t.skip) {
    const parts = [];
    for (const r of ["KONU", "ZAMAN", "KAYNAK", "DIGER"]) {
      const list = model.discipline.skips.filter((it) => it.skipReason === r);
      if (!list.length) continue;
      parts.push(`${fmtInt(list.length)} tanesi ${REASON_TEXT[r]} (${[...new Set(list.map((it) => it.name))].join(", ")})`);
    }
    if (parts.length) s2 = `Pasların ${parts.join(", ")}.`;
  } else if (model.discipline.lastDayRate != null) {
    s2 = `Çok günlük ödevlerin ${fmtPct(model.discipline.lastDayRate)} kadarı son gün ya da hatırlatmadan sonra bitirildi.`;
  }
  return `${s1}${s2 ? ` ${s2}` : ""}`;
}
function renderDiscipline(w, model) {
  const d = model.discipline;
  w.h1("Ödev düzeni", "Teslim % = (zamanında + pastan dönüş + geç) / verilen · Ele alınan % = (teslim + pas) / verilen. Pastan dönüş: süresi içinde pas geçilip sonra teslim edilen ödev; gecikme sayılmaz. 5'ten az ödevde kesir yazılır. Pas nedenleri: K konu, Z zaman, Ka kaynak, D diğer. Açık ve süresi dolmamış ödevler oranlara girmez.", { keep: 45 });
  disciplineSummaryTable(w, model);
  w.block([{ text: disciplineComment(model), size: 8.2, gap: 1 }, d.label ? { text: `Düzen etiketi: ${d.label}`, size: 7.6, color: GREY } : null].filter(Boolean));
  if (d.bySubject.length) {
    w.h2("Ders bazında", { keep: 16 });
    const cs = { 0: { cellWidth: 36 } };
    for (let i = 1; i <= DISC_HEAD.length; i++) cs[i] = { halign: "right" };
    w.table({
      head: ["Ders", ...DISC_HEAD],
      body: [...d.bySubject].sort((a, b) => byWeight(model.subjectMap.get(a.key) || a, model.subjectMap.get(b.key) || b))
        .map((x) => discRow(w, x.name, x, d.skips.filter((it) => it.key === x.key))),
      columnStyles: cs, fontSize: 7,
    });
  }
  w.h2("Pas geçilen ödevler", { keep: 14 });
  if (!d.skips.length) w.note("Bu aralıkta pas geçilen ödev yok.");
  else {
    const head = ["Tarih", "Ders", "Konu", "Neden"];
    if (w.coach) head.push("Not");
    w.table({
      head,
      body: d.skips.map((it) => {
        const row = [fmtDay(it.skipDay), it.name, `${it.topicApprox ? "~ " : ""}${it.topicName}`, colored(`${SKIP_LABEL[it.skipReason] || "—"}${it.skipReason ? ` (${REASON_TEXT[it.skipReason]})` : ""}`, AMBER)];
        if (w.coach) row.push(it.skipNote || "—");
        return row;
      }),
      columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 30 }, 3: { cellWidth: 32 } }, fontSize: 7,
    });
  }
  w.h2("Çalışma takvimi", { keep: 40 });
  drawHeatmap(w, model);
  if (d.weekly.length) {
    w.h2("Haftalık tablo", { keep: 18 });
    const cs = {};
    for (let i = 1; i <= 7; i++) cs[i] = { halign: "right" };
    cs[0] = { cellWidth: 28 };
    w.table({
      head: ["Hafta", "Ödev (ele alınan/toplam)", "Pas", "Sessiz", "Aktif gün", "Soru", "Net oranı", "Hedefler"],
      body: d.weekly.map((k) => [
        weekLabel(k.isoNo, k.start), `${fmtInt(k.handled)}/${fmtInt(k.total)}`, fmtInt(k.skip),
        k.silent ? colored(fmtInt(k.silent), w.coach ? RED : AMBER, true) : "0",
        `${fmtInt(k.active)}/7`, fmtInt(k.Q), pctCell(k.NO), k.goalsTotal ? `${fmtInt(k.goalsMet)}/${fmtInt(k.goalsTotal)}` : "—",
      ]),
      columnStyles: cs, fontSize: 7,
    });
  }
}

// ---------------------------------------------------------------- 6. Net nereden kaçıyor
function renderNetLoss(w, model) {
  w.h1("Net nereden kaçıyor?", "Kaçan net = 1,25 × Y + B. Yanlıştan kayıp = 1,25 × Y (yanlışın kendisi ve götürdüğü doğru), boştan kayıp = B, götürü = Y/4. Profil için en az 60 soru ve 30 işaretli soru gerekir.", { keep: 35 });
  const rows = model.netLoss;
  if (!rows.length) { w.note(fewLine(model.totalRecords, model.kpi.questions.Q)); }
  else {
    const cs = {};
    for (let i = 1; i <= 8; i++) cs[i] = { halign: "right" };
    cs[0] = { cellWidth: 32 };
    w.table({
      head: ["Ders", "D", "Y", "B", "İsabet %", "Boş %", "Yanlıştan kayıp", "Boştan kayıp", "Götürü", "Profil"],
      body: rows.map((x) => [
        x.name, dCell(x.agg.D), yCell(x.agg.Y), fmtInt(x.agg.B), fmtPct(x.agg.accuracy), fmtPct(x.agg.blankRate),
        fmtNet(x.agg.lostWrong), fmtNet(x.agg.lostBlank), fmtNet(x.agg.gotur),
        x.profile ? PROFILES[x.profile].name : colored("Veri az", SOFT),
      ]),
      columnStyles: cs, fontSize: 7.2,
    });
    const used = [...new Set(rows.map((x) => x.profile).filter(Boolean))];
    if (used.length) w.block(used.map((p) => ({ label: PROFILES[p].name, labelW: 28, text: PROFILES[p].rx, size: 7.4, color: GREY, gap: 0.8 })));
  }
  w.gap(1);
  const { doc } = w;
  const items = [
    { text: "Strateji notu: işaretlemek ne zaman kazandırır?", bold: true, size: 8.4, gap: 0.8 },
    { text: "5 şıklı soruda 4 yanlış 1 doğruyu götürür. Emin olunmayan soruda işaretlenen soru başına beklenen net: hiç şık elenmediyse 0; 1 şık elendiyse +0,06; 2 şık elendiyse +0,17; iki şıkka inildiyse (3 şık elendi) +0,375. Yani iki şıkka indirilebilen soruyu boş bırakmak ortalamada net kaybettirir; hiç fikir yoksa işaretlemek ne kazandırır ne kaybettirir.", size: 7.8, gap: 0.5 },
  ];
  const h = w.flow(items, { dry: true, x: M + 3, width: CW - 6 });
  w.ensure(h + 5);
  doc.setFillColor(...FILL);
  doc.roundedRect(M, w.y, CW, h + 4, 1.2, 1.2, "F");
  w.flow(items, { x: M + 3, width: CW - 6, y: w.y + 2 });
  w.y += h + 6;
}

// ---------------------------------------------------------------- 7. Konu dökümü
function topicListItems(s) {
  const L = s.lists;
  const cap = (arr, n = 5) => (arr.length > n ? [...arr.slice(0, n), `+${arr.length - n}`] : arr);
  const out = [];
  const add = (label, arr) => { if (arr.length) out.push({ label, labelW: 42, text: cap(arr).join(" · "), size: 7.5, gap: 0.6 }); };
  add("Önce bunlar", L.first.map((t) => `${t.approx ? "~" : ""}${t.name} (${fmtPct(t.NO)})`));
  add("En sağlam", L.solid.map((t) => `${t.approx ? "~" : ""}${t.name} (${fmtPct(t.NO)})`));
  const seen = new Set();
  add("Açık konular", L.open.filter((t) => { const k = `${t.key}|${t.reason}|${t.state}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((t) => `${t.approx ? "~" : ""}${t.name} (${t.state === "skip" ? `pas: ${SKIP_LABEL[t.reason] || "—"}` : STATE_LABEL[t.state] || t.state})`));
  add("Okulda işlendi, sende yok", L.schoolNoRecord.map((t) => `${t.approx ? "~" : ""}${t.name}`));
  add("Tekrar zamanı", L.review.map((t) => `${t.approx ? "~" : ""}${t.name} (${fmtInt(t.daysSince)} gün önce, ${fmtPct(t.NO)})`));
  return out;
}
function renderTopics(w, model) {
  const subs = model.subjects.filter((s) => s.tracked && s.records.length > 0).sort(byWeight);
  w.h1("Konu dökümü", "Konu net oranı ham değerdir; sıralama ve durum küçültülmüş oranla (r*) yapılır. Durum: Pekişti ≥ %65, Tekrar gerekli < %40, arası Gelişiyor; 20 sorudan az ise Az veri. \"~\" = konu adı metinden yaklaşık eşleştirildi.", { keep: 45 });
  if (!subs.length) { w.note(fewLine(model.totalRecords, model.kpi.questions.Q)); return; }
  for (const s of subs) {
    const lists = topicListItems(s);
    const title = [{ text: `${s.name} — ${LABELS[s.label]}`, bold: true, size: 9.2, color: LABEL_COLOR[s.label] === INK ? INK : LABEL_COLOR[s.label], gap: 0.8 }];
    const h = w.flow([...title, ...lists], { dry: true });
    w.gap(2);
    w.ensure(h + 16); // başlık + listeler + tablonun başlığı ve ilk satırları birlikte
    w.block([...title, ...lists]);
    w.table({
      head: ["Konu", "Kayıt", "Soru", "Net oranı", "İsabet", "Son çalışma", "Durum"],
      body: s.topics.map((t) => [
        `${t.approx ? "~ " : ""}${t.name}`, fmtInt(t.n), fmtInt(t.Q), pctCell(t.NO), fmtPct(t.accuracy),
        `${fmtDay(t.lastDay)} (${t.daysSince === 0 ? "bugün" : `${fmtInt(t.daysSince)} gün`})`,
        colored(TOPIC_STATUS[t.status] || t.status, TOPIC_COLOR[t.status] || INK, t.status !== "growing"),
      ]),
      columnStyles: { 1: { cellWidth: 12, halign: "right" }, 2: { cellWidth: 12, halign: "right" }, 3: { cellWidth: 16, halign: "right" }, 4: { cellWidth: 14, halign: "right" }, 5: { cellWidth: 28 }, 6: { cellWidth: 24 } },
      fontSize: 7, keep: 12,
    });
  }
  w.note("Konu eşleştirmesi metinden yaklaşık olarak yapılmıştır.");
}

// ---------------------------------------------------------------- 8. Kapsam ve telafi
function renderCoverage(w, model) {
  const cov = model.coverage;
  const grade12 = !!model.student?.grade12;
  w.h1("Kapsam ve telafi", `Okul planı kapsamı: okulda işlenen konulardan teslim edilen ya da sonradan en az 10 soru çalışılanların oranı.${grade12 ? " Müfredat kapsamı (~): müfredattaki konulardan en az 10 soru çalışılanlar." : ""}`, { keep: 40 });
  const sh = cov.share;
  if (grade12 && sh.total) {
    w.block([{ text: `Son 4 haftada çözülen ${fmtInt(sh.total)} sorunun ${fmtPct(sh.tyt)} kadarı TYT, ${fmtPct(sh.ayt)} kadarı AYT.${sh.flag ? ` ${sh.small} payı %25'in altında; puanı iki oturum birlikte belirler.` : ""}`, size: 8.3, color: sh.flag ? AMBER : INK, gap: 1.2 }]);
  }
  if (cov.rows.length) {
    const head = ["Ders", "Okul planı kapsamı"];
    if (grade12) head.push("Müfredat kapsamı (~)");
    if (grade12 && w.coach) head.push("Kalan konu", "Gerekli tempo");
    w.table({
      head,
      body: [...cov.rows].sort((a, b) => byWeight(model.subjectMap.get(a.key), model.subjectMap.get(b.key))).map((r) => {
        const row = [r.name, r.planTotal ? `${fmtInt(r.planDone)}/${fmtInt(r.planTotal)} · ${fmtPct(r.planPct)}` : "—"];
        if (grade12) row.push(r.curriculum ? `~${fmtInt(r.curriculum.done)}/${fmtInt(r.curriculum.total)}` : "—");
        if (grade12 && w.coach) row.push(r.curriculum ? `~${fmtInt(r.U)}` : "—", r.tempo != null ? `~${fmtDec(r.tempo, 1)} konu/hafta` : "—");
        return row;
      }),
      columnStyles: { 0: { cellWidth: 40 } }, fontSize: 7.3,
    });
    if (grade12 && w.coach && cov.weeksLeft != null) w.note(`Gerekli tempo = kalan konu / (kalan ${fmtInt(cov.weeksLeft)} hafta − son 8 hafta tekrar).`);
  }
  w.h2(`Telafi listesi (${cov.makeup.length})`, { keep: 14 });
  if (!cov.makeup.length) w.note("Telafi bekleyen okul ödevi yok.");
  else {
    w.table({
      head: ["Ders", "Konu", "Son gün", "Durum", "Soru", "Telafi"],
      body: cov.makeup.map((x) => [
        x.name, `${x.approx ? "~ " : ""}${x.topic}`, fmtDay(x.endDay),
        x.state === "skip" ? colored(`Pas: ${SKIP_LABEL[x.reason] || "—"}`, AMBER) : colored("Sessiz", w.coach ? RED : AMBER),
        x.expected ? fmtInt(x.expected) : "—",
        x.canSubmit ? "Hâlâ teslim edilebilir" : "Serbest çalışma olarak",
      ]),
      columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 16 }, 3: { cellWidth: 22 }, 4: { cellWidth: 11, halign: "right" }, 5: { cellWidth: 34 } }, fontSize: 7,
    });
  }
  if (grade12 && cov.rows.length) {
    w.h2("Müfredat konuları", { keep: 20, note: "Çalışıldı: ≥ 10 soru · İşlendi, kayıt yok: okulda işlendi · Henüz yok" });
    for (const r of [...cov.rows].sort((a, b) => byWeight(model.subjectMap.get(a.key), model.subjectMap.get(b.key)))) {
      if (!r.canonical?.length) continue;
      const g = (st) => r.canonical.filter((c) => c.state === st).map((c) => c.name);
      const studied = g("studied"), taught = g("taught"), notYet = g("notYet");
      w.block([
        { text: r.name, bold: true, size: 8.2, gap: 0.4 },
        studied.length ? { label: `Çalışıldı (${studied.length})`, labelW: 36, labelColor: GREEN, text: studied.join(", "), size: 7, gap: 0.3 } : null,
        taught.length ? { label: `İşlendi, kayıt yok (${taught.length})`, labelW: 36, labelColor: AMBER, text: taught.join(", "), size: 7, gap: 0.3 } : null,
        notYet.length ? { label: `Henüz yok (${notYet.length})`, labelW: 36, labelColor: GREY, text: notYet.join(", "), size: 7, gap: 1.2 } : null,
      ].filter(Boolean));
    }
  }
  w.note("Konu eşleştirmesi yaklaşıktır.");
}

// ---------------------------------------------------------------- Ekler
function renderSchoolAppendix(w, model) {
  w.h1("Ek A — Okul ödevleri karşılaştırması", "Okul karşılaştırmaları yalnızca aynı ödevi çözenlerin toplu verisidir, kimsenin adı yer almaz. Yalnızca medyan, çeyrekler (Q1–Q3), kişi sayısı ve katılım kullanılır.", { keep: 30 });
  const rows = [...model.schoolRows].sort((a, b) => a.day - b.day);
  if (!rows.length) { w.note("Bu aralıkta karşılaştırılabilir okul ödevi yok."); return; }
  let lowPart = false;
  const body = rows.map((r) => {
    if (r.participation != null && r.participation < 60) lowPart = true;
    let pct;
    if (w.coach) pct = fmtInt(r.pct);
    else pct = r.pct >= 50 ? fmtInt(r.pct) : `medyana ${fmtInt(Math.max(0, r.median - r.mine))} puan`;
    const mine = r.tone === "green" ? colored(fmtPct(r.mine), GREEN, true) : r.tone === "amber" ? colored(fmtPct(r.mine), AMBER, true) : pctCell(r.mine);
    return [
      fmtDay(r.day), r.name, `${r.approx ? "~ " : ""}${r.topic}`, mine, fmtPct(r.median), `${fmtPct(r.q1)}–${fmtPct(r.q3)}`,
      `${fmtPct(r.participation)} · n ${fmtInt(r.n)}${r.scope === "school" ? " · tüm okul" : ""}${r.participation != null && r.participation < 60 ? " *" : ""}`,
      pct,
    ];
  });
  w.table({
    head: ["Tarih", "Ders", "Konu", "Sen", "Okul medyanı", "Q1–Q3", "Katılım", "Yüzdelik"],
    body,
    columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 26 }, 3: { cellWidth: 12, halign: "right" }, 4: { cellWidth: 15, halign: "right" }, 5: { cellWidth: 19 }, 6: { cellWidth: 22 }, 7: { cellWidth: w.coach ? 15 : 24 } },
    fontSize: 7,
  });
  const notes = [];
  if (lowPart) notes.push("* Katılım %60'ın altında: medyan olduğundan yüksek görünebilir.");
  if (!w.coach) notes.push("Yüzdelik yalnızca 50 ve üzerindeyse yazılır; altında okul medyanına olan fark (puan) verilir.");
  if (notes.length) w.note(notes.join(" "));
}

function renderHistoryAppendix(w, model) {
  w.h1("Ek B — Ödev geçmişi", `Rapor aralığındaki (${model.rangeText}) ödevler; son günü aralıkta olan ya da aralıkta teslim edilen/pas geçilen. Sınav türüne göre ayrı ve kronolojik. Net oranı = Net / Soru. Okul medyanı: aynı ödevi çözenlerin net oranı medyanı.`, { keep: 30 });
  const win = model.window || {};
  const inWin = (d) => d != null && (win.start == null || (d >= win.start && d <= win.end));
  const hist = {};
  for (const e of ["TYT", "AYT"]) hist[e] = (model.history[e] || []).filter((it) => inWin(it.endDay) || inWin(it.doneDay) || inWin(it.skipDay));
  const all = [...hist.TYT, ...hist.AYT];
  const dropped = Math.max(0, all.length - HISTORY_LIMIT);
  // 200 satır sınırı: en eski ödevler düşülür.
  const cutoff = dropped ? [...all].sort((a, b) => a.endDay - b.endDay)[dropped - 1].endDay : null;
  let skipLeft = dropped;
  const keep = (list) => list.filter((it) => {
    if (skipLeft > 0 && cutoff != null && it.endDay <= cutoff) { skipLeft -= 1; return false; }
    return true;
  });
  if (dropped) w.note(`Ödev geçmişi ${HISTORY_LIMIT} satırla sınırlıdır; en eski ${fmtInt(dropped)} ödev gösterilmedi.`);
  const head = ["Tarih", "Tür", "Veren", "Ders", "Konu", "Kaynak", "Beklenen", "Durum", "D", "Y", "B", "Net", "Net oranı", "Okul medyanı"];
  const r = { halign: "right" };
  const cs = {
    0: { cellWidth: 11 }, 1: { cellWidth: 11 }, 2: { cellWidth: 17 }, 3: { cellWidth: 15 }, 4: { cellWidth: 31 }, 5: { cellWidth: 18 }, 6: { cellWidth: 10, ...r },
    7: { cellWidth: 16 }, 8: { cellWidth: 7, ...r }, 9: { cellWidth: 7, ...r }, 10: { cellWidth: 7, ...r }, 11: { cellWidth: 9, ...r }, 12: { cellWidth: 12, ...r }, 13: { cellWidth: 11, ...r },
  };
  if (w.coach) {
    // Koç nüshasında foto sayısı ayrı dar sütunda (satır yüksekliği artmasın diye).
    head.push("Foto");
    Object.assign(cs, { 1: { cellWidth: 10 }, 2: { cellWidth: 16 }, 4: { cellWidth: 30 }, 5: { cellWidth: 16 }, 6: { cellWidth: 9, ...r }, 12: { cellWidth: 11, ...r }, 14: { cellWidth: 7, ...r } });
  }
  const span = head.length;
  for (const e of ["TYT", "AYT"]) {
    const list = keep(hist[e]);
    if (!list.length) continue;
    w.h2(`${e} ödevleri (${list.length})`, { keep: 14 });
    const body = [];
    for (const it of list) {
      const done = it.correct != null;
      let state = STATE_LABEL[it.state] || it.state;
      if (it.state === "skip" && it.skipReason) state += ` (${SKIP_LABEL[it.skipReason]})`;
      const stColor = it.state === "onTime" || it.state === "fixed" ? GREEN : it.state === "silent" ? (w.coach ? RED : AMBER) : it.state === "late" || it.state === "skip" ? AMBER : GREY;
      body.push([
        fmtDay(it.endDay), it.isSchool ? "Okul" : "Kişisel", it.teacher || "—", subjectShort(it), `${it.topicApprox ? "~ " : ""}${it.topicName}`, it.sourceBook || "—",
        it.expected ? fmtInt(it.expected) : "—", colored(state, stColor),
        done ? dCell(it.correct) : "—", done ? yCell(it.wrong) : "—", done ? fmtInt(it.blank) : "—", done ? fmtNet(it.net) : "—", done ? pctCell(it.r) : "—",
        it.school?.median != null ? fmtPct(it.school.median) : "—",
        ...(w.coach ? [it.photos ? fmtInt(it.photos) : "—"] : []),
      ]);
      if (w.coach && (it.note || it.skipNote)) {
        const txt = [it.note ? `Teslim notu: "${it.note}"` : null, it.skipNote ? `Pas notu: "${it.skipNote}"` : null].filter(Boolean).join(" · ");
        body.push([{ content: txt, colSpan: span, styles: { textColor: GREY, fontSize: 6.3, cellPadding: { top: 0.5, bottom: 0.7, left: 13, right: 1.1 } } }]);
      }
    }
    w.table({ head, body, columnStyles: cs, fontSize: 6.4 });
  }
  const inProg = model.inProgress || [];
  if (inProg.length) {
    const items = [{ text: `Devam eden ödevler (${inProg.length})`, bold: true, size: 8.4, gap: 0.8 }, ...inProg.map((it) => ({
      text: `${it.name} – ${it.topicApprox ? "~" : ""}${it.topicName} · son gün ${fmtDay(it.endDay)}${it.expected ? ` · ${fmtInt(it.expected)} soru` : ""}`, size: 7.6, mark: "•", gap: 0.5,
    }))];
    const h = w.flow(items, { dry: true, x: M + 3, width: CW - 6 });
    w.gap(1);
    w.ensure(h + 5);
    const { doc } = w;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, w.y, CW, h + 3.5, 1.2, 1.2, "S");
    w.flow(items, { x: M + 3, width: CW - 6, y: w.y + 1.8 });
    w.y += h + 5;
  }
}

function renderSessionsAppendix(w, model) {
  w.h1("Ek C — Serbest çalışmalar", "Ödev dışında girilen çalışmalar (rapor aralığı). Aynı gün aynı ders ve aynı D/Y/B ile girilmiş ödev varsa çift sayılmaz.", { keep: 24 });
  const list = model.sessions || [];
  if (!list.length) { w.note("Bu aralıkta serbest çalışma kaydı yok."); return; }
  const head = ["Tarih", "Ders", "Konu", "Kaynak", "D", "Y", "B", "Net", "Net oranı"];
  if (w.coach) head.push("Not");
  const cs = { 0: { cellWidth: 14 }, 1: { cellWidth: 26 }, 4: { cellWidth: 8, halign: "right" }, 5: { cellWidth: 8, halign: "right" }, 6: { cellWidth: 8, halign: "right" }, 7: { cellWidth: 10, halign: "right" }, 8: { cellWidth: 14, halign: "right" } };
  w.table({
    head,
    body: list.map((r) => {
      const row = [fmtDay(r.day), r.name, `${r.topicApprox ? "~ " : ""}${r.topicName}`, r.sourceBook || "—", dCell(r.D), yCell(r.Y), fmtInt(r.B), fmtNet(r.net), pctCell(r.r)];
      if (w.coach) row.push(r.note || "—");
      return row;
    }),
    columnStyles: cs, fontSize: 7,
  });
}

function renderReviewAppendix(w, model) {
  w.h1("Ek D — Tekrar kontrol listesi", "Yanlış ya da boş bırakılan ve numarası girilen sorular. Çözdükçe kutuyu işaretle.", { keep: 24 });
  const list = model.reviewList || [];
  if (!list.length) { w.note("Soru numarası girilmiş kayıt yok; yanlış ve boş soruların numaraları girildikçe bu liste kendiliğinden oluşur."); return; }
  const { doc } = w;
  const bySubj = new Map();
  for (const x of list) {
    if (!bySubj.has(x.subjectName)) bySubj.set(x.subjectName, new Map());
    const bySrc = bySubj.get(x.subjectName);
    if (!bySrc.has(x.source)) bySrc.set(x.source, []);
    bySrc.get(x.source).push(x);
  }
  const labelW = 70;
  for (const [subj, bySrc] of bySubj) {
    w.gap(1);
    w.ensure(14);
    w.font(true, 9, INK);
    w.text(subj, M, w.y + 3.5);
    w.y += 5;
    for (const [src, items] of bySrc) {
      w.ensure(10);
      w.font(true, 7.8, GREY);
      w.text(src, M + 3, w.y + 3);
      w.y += 4.2;
      for (const x of [...items].sort((a, b) => a.day - b.day)) {
        // numara kutuları: satıra sığdığı kadar, gerekirse alt satıra
        const boxesX = M + 6 + labelW, boxesW = M + CW - boxesX;
        w.font(false, 7.6, INK);
        const per = [];
        let cx = 0, line = 0;
        for (const n of x.numbers) {
          const tw = 3.4 + doc.getTextWidth(String(n)) + 3;
          if (cx + tw > boxesW && cx > 0) { line += 1; cx = 0; }
          per.push({ n, x: cx, line });
          cx += tw;
        }
        const h = (line + 1) * 4.6;
        w.ensure(h + 0.5);
        w.font(false, 7.6, INK);
        const label = doc.splitTextToSize(w.t(`${x.topic} · ${fmtDay(x.day)} · ${fmtInt(x.Y)} Y, ${fmtInt(x.B)} B`), labelW)[0];
        doc.text(label, M + 6, w.y + 3.2);
        for (const p of per) {
          const bx = boxesX + p.x, by = w.y + p.line * 4.6 + 0.6;
          doc.setDrawColor(...INK);
          doc.setLineWidth(0.25);
          doc.rect(bx, by, 2.8, 2.8, "S");
          doc.text(String(p.n), bx + 3.7, by + 2.5);
        }
        w.y += h;
      }
    }
  }
}

function renderAllRecsAppendix(w, model) {
  w.h1("Ek E — Tüm öneriler", w.coach ? "Koç nüshasında öneriler sahibine göre gruplanır. Öneriler her raporda veriden yeniden hesaplanır." : "Öneriler her raporda veriden yeniden hesaplanır.", { keep: 30 });
  const list = (w.student ? model.recs.studentAll : model.recs.coachAll).filter((r) => recText(w, r));
  if (!list.length) { w.note("Şu an öneri yok."); return; }
  const row = (r) => {
    const title = recTitle(w, r) || "";
    const full = recText(w, r) || "";
    const rest = full.startsWith(title) ? full.slice(title.length).trim() : full;
    return [
      { content: title, styles: { fontStyle: "bold" } },
      recEvidence(w, r) || "—",
      rest || "—",
      `${r.owner}${r.ownerName ? `\n(${r.ownerName} Hoca)` : ""}`,
    ];
  };
  const body = [];
  if (w.coach) {
    const owners = [...OWNER_ORDER, ...new Set(list.map((r) => r.owner).filter((o) => !OWNER_ORDER.includes(o)))];
    for (const o of owners) {
      const g = list.filter((r) => r.owner === o);
      if (!g.length) continue;
      body.push([{ content: `${o} (${g.length})`, colSpan: 4, styles: { fontStyle: "bold", fillColor: FILL } }]);
      for (const r of g) body.push(row(r));
    }
  } else for (const r of list) body.push(row(r));
  w.table({
    head: ["Öneri", "Neden", "Önerilen adım", "Sahibi"], body,
    columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 36 }, 3: { cellWidth: 24 } }, fontSize: 6.9, styles: { valign: "top" },
  });
}

function renderMethodAppendix(w) {
  w.h1("Ek F — Yöntem ve tanımlar", null, { keep: 60 });
  const items = [
    ["Net", "Net = D − Y/4 (4 yanlış 1 doğruyu götürür); Q = D + Y + B. Örnek: 40 soruda 30 D, 8 Y, 2 B varsa Net = 30 − 8/4 = 28."],
    ["Net oranı", "Kayıt net oranı r = Net / Q × 100 (\"%58\" = 100 soruda 58 net). Ders net oranı NO = Σw·r / Σw, w = min(Q, 40): 40 sorudan büyük tek bir set dersi tek başına belirleyemez. Değer −25 ile 100 arasındadır; negatif değer kırmızı yazılır."],
    ["Küçültme", "Etiket ve sıralamada küçültülmüş oran kullanılır: ders için adjNO = (Σw·NO_ders + 40·NO_sınav) / (Σw + 40), konu için r* = (Σw·NO_konu + 20·NO_ders) / (Σw + 20). Tablolarda her zaman ham net oranı gösterilir."],
    ["Asgari örneklem", "Ders etiketi: en az 3 kayıt, en az 60 soru ve en az 2 farklı hafta; 4 haftada sağlanmazsa etiket 8 haftalık veriyle verilir (\"8 hf\"). Trend: son 4 hafta ve önceki 4 haftanın her birinde en az 3 kayıt ve 60 soru. Konu durumu ve listeleri: en az 20 soru. Haftalık grafik noktası: haftada en az 20 soru. Düzen yüzdeleri: en az 5 ödev (altında kesir). Eşiğin altında etiket ya da öneri üretilmez, \"Veri az\" yazılır."],
    ["Trend testi", "Δ = NO(son 4 hafta) − NO(önceki 4 hafta). Pencere standart hatası SE = max(4, √(Σw²·(r − NO)²) / Σw); SEΔ = √(SE_son² + SE_önceki²). Yükselişte: Δ ≥ +5 ve Δ ≥ 1,28·SEΔ. Düşüşte: Δ ≤ −5 ve Δ ≤ −1,96·SEΔ. Arası Sabit. Aynı ödevlerde okul medyanı da benzer biçimde düştüyse düşüş Sabit sayılır (konular zorlaşmış olabilir)."],
    ["Ders etiketi", "adjNO ≥ 65 ise Güçlü, adjNO < 40 ise Odak, arası Yolunda. Okul düzeltmesi: en az 3 karşılaştırılabilir okul ödevi varsa, bu ödevlerdeki sıra yüzdeliklerinin medyanına göre etiket en fazla bir kademe değişir: medyan 60 ve üzerindeyse Odak › Yolunda, 75 ve üzerindeyse Yolunda › Güçlü; 40 ve altındaysa Güçlü › Yolunda, 25 ve altındaysa Yolunda › Odak. \"Konuyu bilmiyorum\" öz-beyanı: son 28 günde aynı derste en az 2 çözülmemiş konu pası varsa Veri az ya da Yolunda olan ders Odak olur; Güçlü dersin etiketi kalır, \"konu pası\" notu düşülür."],
    ["Öncelik", "Odak derslerin sırası = YKS test soru sayısı × (65 − adjNO). Bu sayı yalnızca sıralamada kullanılır; puan, sıralama ya da tahmini net üretilmez."],
    ["Ödev düzeni", "Teslim % = (zamanında + pastan dönüş + geç) / verilen; ele alınan % = (teslim + pas) / verilen. Pastan dönüş: bitiş günü bitmeden pas geçilmiş, sonra yine de teslim edilmiş ödev — bir düzeltmedir, gecikme sayılmaz. Sessiz: süresi geçmiş, ne teslim edilmiş ne pas geçilmiş ödev. Açık ve süresi dolmamış ödevler oranlara girmez. Gün ve hafta sınırları Türkiye saatine göredir; hafta Pazartesi–Pazar."],
    ["Veri kaynağı", "Sonuçlar öğrencinin kendi girdiği D/Y/B sayılarına dayanır."],
    ["Konu eşleşmesi", "Konu eşleşmesi yaklaşıktır: ödevdeki konu adı müfredat listesiyle metin benzerliğine göre eşleştirilir; \"~\" işaretli konular yaklaşık eşleşmedir, eşleşmeyen konu kendi başlığıyla ayrı tutulur."],
    ["Gizlilik", "Okul karşılaştırmaları yalnızca aynı ödevi çözenlerin toplu verisidir, kimsenin adı yer almaz. Bir ödev ancak en az 10 başka geçerli teslim varsa karşılaştırılır."],
    ["Deneme değildir", "Ödev neti deneme neti değildir. Ödevlerin zorluğu ve kapsamı denemeden farklıdır; bu rapordaki oranlar sınav sonucunu tahmin etmek için kullanılmamalıdır."],
  ];
  w.block(items.map(([label, text]) => ({ label, labelW: 30, text, size: 7.8, gap: 1.4 })));
}

// ================================================================ belge kurulumu
function stampPages(w, stamp) {
  const { doc } = w;
  const n = doc.getNumberOfPages();
  let last = w.headers[1] || "";
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    const hdr = w.headers[i] ?? last;
    last = hdr;
    w.font(false, 7, GREY);
    doc.text(w.t(hdr), M, 9.3);
    doc.text(w.t(VARIANT_LABEL[w.variant] || ""), M + CW, 9.3, { align: "right" });
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.line(M, 11.2, M + CW, 11.2);
    doc.line(M, 285, M + CW, 285);
    w.font(false, 7, GREY);
    doc.text(w.t(`Sayfa ${i}/${n} · Oluşturma: ${stamp} · Net = D − Y/4`), M, 289.3);
    doc.text(w.t(SCHOOL_NAME), M + CW, 289.3, { align: "right" });
  }
}

async function setup({ jsPDF, autoTable, font, logo, variant }) {
  const libs = await loadLibs(jsPDF, autoTable);
  const doc = new libs.jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const [fontName, logoData] = await Promise.all([registerUnicodeFont(doc, font), logo === undefined ? fetchAsDataUrl("/logo.png") : Promise.resolve(logo)]);
  const FONT = fontName || "helvetica";
  doc.setFont(FONT, "normal");
  const clean = fontName ? unicodeCleaner(doc) : toAscii;
  const w = createWriter({ doc, autoTable: libs.autoTable, fontName: FONT, clean, variant, logo: logoData || null });
  return w;
}

function normalizeVariant(model, variant) {
  const v = ["student", "coach", "parent"].includes(variant) ? variant : model?.viewer === "coach" ? "coach" : "student";
  // Öğrenci modeli koç alanlarını taşımaz; öğrenci hesabından her zaman öğrenci nüshası çıkar.
  return model?.viewer === "student" ? "student" : v;
}

function renderStudentReport(w, model, { ai, monthly = false }) {
  w.full = !monthly && model.enough;
  renderSummary(w, model);
  if (w.coach) renderCoachAppendix(w, model, { ai, withAi: !monthly });
  if (monthly) {
    if (model.enough) renderKarne(w, model);
    if (ai) renderAi(w, ai, { asSection: true });
    return;
  }
  if (!model.enough) { renderMethodAppendix(w); return; }
  renderKarne(w, model);
  renderTrend(w, model);
  renderDiscipline(w, model);
  renderNetLoss(w, model);
  renderTopics(w, model);
  renderCoverage(w, model);
  renderSchoolAppendix(w, model);
  renderHistoryAppendix(w, model);
  renderSessionsAppendix(w, model);
  renderReviewAppendix(w, model);
  renderAllRecsAppendix(w, model);
  renderMethodAppendix(w);
}

// PDF belgesini kurar ama kaydetmez (testler jsPDF/autoTable/font'u enjekte eder).
export async function buildReportPdfDoc({ model, variant, ai = null, jsPDF, autoTable, font, logo } = {}) {
  if (!model) throw new Error("buildReportPdfDoc: model gerekli");
  const v = normalizeVariant(model, variant);
  const w = await setup({ jsPDF, autoTable, font, logo, variant: v });
  w.headerText = headerLine(model);
  w.headers[1] = w.headerText;
  renderStudentReport(w, model, { ai: v === "coach" ? ai : null });
  stampPages(w, stampText(model.generatedAt));
  return w.doc;
}

// Dosya adı her zaman ASCII — bazı paylaşım hedefleri (e-posta ekleri, eski Android dosya yöneticileri) Türkçe
// karakterli dosya adlarını bozabiliyor.
const asciiSlug = (s) => toAscii(s).replace(/[^A-Za-z0-9 -]+/g, "").trim().replace(/\s+/g, "-") || "Ogrenci";
export function reportPdfFileName(model) {
  return `Gelisim-Raporu_${asciiSlug(model?.student?.name || "Ogrenci")}_${trStamp(model?.generatedAt ?? new Date()).iso}.pdf`;
}
export function monthlyPdfFileName(month) {
  return `Aylik-Raporlar_${String(month || "").replace(/[^0-9-]/g, "") || trStamp(new Date()).iso.slice(0, 7)}.pdf`;
}

// Native kabukta (Capacitor WebView) doc.save()'in kullandığı blob+<a download> tekniği sessizce hiçbir şey
// yapmıyor — bunun yerine dosya paylaşım sayfası üzerinden kaydedilir/paylaşılır.
async function saveDoc(doc, fileName) {
  if (isNative) {
    const base64 = doc.output("datauristring").split(",")[1];
    await savePdfAndShare(base64, fileName);
  } else {
    doc.save(fileName);
  }
}

// jsPDF + jspdf-autotable yalnızca PDF istendiğinde dinamik import edilir — ilk sayfa yüklemesine eklenmesin diye.
export async function downloadReportPdf({ model, variant, ai } = {}) {
  const doc = await buildReportPdfDoc({ model, variant, ai });
  await saveDoc(doc, reportPdfFileName(model));
}

// ---------------------------------------------------------------- aylık toplu koç PDF'i
function renderMonthlyCover(w, { monthLabel, coachName, entries, generatedAt }) {
  const { doc } = w;
  const y = w.y;
  let x = M;
  if (w.logo) {
    try { doc.addImage(w.logo, "PNG", M, y, 13, 13); x = M + 17; } catch { x = M; }
  }
  w.font(true, 8.5, GREY);
  w.text(SCHOOL_NAME, x, y + 4);
  w.font(true, 16, INK);
  w.text(`Aylık raporlar — ${monthLabel}`, x, y + 11.5);
  w.y = y + 17;
  w.block([{ text: [coachName ? `Koç: ${coachName}` : null, `${fmtInt(entries.length)} öğrenci`, `Oluşturma: ${stampText(generatedAt)}`].filter(Boolean).join(" · "), size: 8.5, color: GREY, gap: 2 }]);
  const body = entries.map(({ model: m }) => {
    const k = m.kpi;
    const focus = m.chips.focusAll.slice(0, 3).map((s) => s.name).join(", ");
    return [
      { content: m.student?.name || "Öğrenci", styles: { fontStyle: "bold" } },
      ratio(k.delivery.delivered, k.delivery.V), ratio(k.delivery.delivered + k.delivery.skip, k.delivery.V),
      `${fmtInt(k.activeDays.n)}/${fmtInt(k.activeDays.of)}`,
      m.exams.TYT.agg.n ? pctCell(m.exams.TYT.agg.NO) : "—", m.exams.AYT.agg.n ? pctCell(m.exams.AYT.agg.NO) : "—",
      focus || (m.enough ? "—" : colored("Veri az", SOFT)),
      colored(m.coach.statusLabel, STATUS_COLOR[m.coach.status] || INK, true),
    ];
  });
  const cs = { 0: { cellWidth: 34 }, 1: { cellWidth: 15, halign: "right" }, 2: { cellWidth: 17, halign: "right" }, 3: { cellWidth: 15, halign: "right" }, 4: { cellWidth: 17, halign: "right" }, 5: { cellWidth: 17, halign: "right" }, 7: { cellWidth: 20 } };
  w.table({ head: ["Ad", "Teslim %", "Ele alınan %", "Aktif gün", "TYT net oranı", "AYT net oranı", "Odak dersler", "Durum"], body, columnStyles: cs, fontSize: 7.6 });
  w.note("Durum: Müdahale (14 günde en az 2 sessiz ödev, 7 gündür kayıt yok ya da ele alınan < %50) · Takip et (öncelikli öneri var) · Yolunda. 5'ten az ödevde kesir yazılır. Her öğrencinin sayfaları yeni sayfada başlar: özet, koç eki, ders karnesi ve varsa yapay zekâ incelemesi.");
}

export async function buildMonthlyReportsPdfDoc({ month, monthLabel, coachName, entries = [], jsPDF, autoTable, font, logo, now } = {}) {
  const w = await setup({ jsPDF, autoTable, font, logo, variant: "coach" });
  const generatedAt = now ?? entries[0]?.model?.generatedAt ?? new Date();
  const label = monthLabel || month || "";
  w.headerText = [`Aylık raporlar · ${label}`, coachName ? `Koç: ${coachName}` : null].filter(Boolean).join(" · ");
  w.headers[1] = w.headerText;
  renderMonthlyCover(w, { monthLabel: label, coachName, entries, generatedAt });
  for (const { model, ai } of entries) {
    if (!model) continue;
    w.headerText = headerLine(model);
    w.newPage();
    renderStudentReport(w, model, { ai, monthly: true });
  }
  stampPages(w, stampText(generatedAt));
  return w.doc;
}

export async function downloadMonthlyReportsPdf({ month, monthLabel, coachName, entries } = {}) {
  const doc = await buildMonthlyReportsPdfDoc({ month, monthLabel, coachName, entries });
  await saveDoc(doc, monthlyPdfFileName(month));
}
