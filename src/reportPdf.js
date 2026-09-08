import { isNative, savePdfAndShare } from "./native/index.js";

// jsPDF'in standart fontları (Helvetica vb.) Türkçe'ye özgü karakterleri (ğ ş ı İ ç ö ü) düzgün
// basmıyor — açık lisanslı bir Unicode font gömmek (ör. Roboto) hem lisans/telif riski hem de ciddi
// bir bundle boyutu artışı getirirdi (yaklaşık 1MB+). Bunun yerine PDF içeriği ASCII'ye çevriliyor
// (ör. "Öğrenci" → "Ogrenci") — okunabilirlik kaybı kozmetik, karakterlerin bozuk/kutu olarak
// basılmasından çok daha iyi. Uygulamanın geri kalanı (ekran, e-posta) Türkçe karakterleri sorunsuz kullanmaya devam ediyor.
const TR_MAP = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", I: "I", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U" };
function toAscii(str) {
  return String(str ?? "").replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_MAP[c] ?? c);
}

const GROUP_LABELS_TR = { day: "Gunluk", week: "Haftalik", month: "Aylik" };

const MONTHS_TR_ASCII = ["Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"];

function periodLabelAscii(period, groupBy) {
  if (groupBy === "day") {
    const [year, month, day] = period.split("-");
    return `${Number(day)} ${MONTHS_TR_ASCII[Number(month) - 1]} ${year}`;
  }
  if (groupBy === "month") {
    const [year, month] = period.split("-");
    return `${MONTHS_TR_ASCII[Number(month) - 1]} ${year}`;
  }
  const [year, week] = period.split("-H");
  return `${Number(week)}. Hafta, ${year}`;
}

// Okulun logosunu (public/logo.png, aynı origin'den) base64'e çevirir — jsPDF addImage bir data
// URL bekliyor. Yüklenemezse (ör. offline) PDF logosuz, sadece metinle devam eder — kritik değil.
async function fetchLogoDataUrl() {
  try {
    const res = await fetch("/logo.png");
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

// jsPDF + jspdf-autotable yalnızca bu fonksiyon çağrıldığında (PDF indir butonuna tıklanınca)
// dinamik import edilir — ilk sayfa yüklemesinde hiç kimseye ekstra bundle boyutu yüklenmesin diye.
export async function downloadReportPdf({ data, studentName, groupBy }) {
  const [[{ default: jsPDF }, { default: autoTable }], logoDataUrl] = await Promise.all([
    Promise.all([import("jspdf"), import("jspdf-autotable")]),
    fetchLogoDataUrl(),
  ]);
  const doc = new jsPDF();
  const marginX = 14;
  let y = 14;

  // Logo (public/logo.png) sol üstte, okul adı/başlık metni sağında.
  const logoW = 16, logoH = logoW;
  const textX = logoDataUrl ? marginX + logoW + 6 : marginX;
  if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", marginX, y, logoW, logoH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Mehmet Akif Inan Hafiz", textX, y + 6);
  doc.text("Anadolu Imam Hatip Lisesi", textX, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Olusturulma: ${new Date().toLocaleDateString("tr-TR")}  |  Gruplama: ${GROUP_LABELS_TR[groupBy]}`, textX, y + 19);
  doc.setTextColor(0);

  y = Math.max(y + logoH, y + 22) + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`${toAscii(studentName)} - Basari Raporu`, marginX, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    `Toplam  -  Dogru: ${data.overall.correctCount}   Yanlis: ${data.overall.wrongCount}   Bos: ${data.overall.blankCount}   Net: ${data.overall.net}`,
    marginX, y
  );
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Ders", "Kayit", "Dogru", "Yanlis", "Bos", "Net"]],
    body: data.bySubject.map((s) => [toAscii(s.subject), s.count, s.correctCount, s.wrongCount, s.blankCount, s.net]),
    styles: { fontSize: 9, font: "helvetica" },
    headStyles: { fillColor: [12, 100, 120] },
    margin: { left: marginX, right: marginX },
  });

  const afterSubjectsY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text("Zamana Gore", marginX, afterSubjectsY);

  autoTable(doc, {
    startY: afterSubjectsY + 4,
    head: [["Donem", "Kayit", "Dogru", "Yanlis", "Bos", "Net"]],
    body: [...data.byPeriod].reverse().map((p) => [periodLabelAscii(p.period, groupBy), p.count, p.correctCount, p.wrongCount, p.blankCount, p.net]),
    styles: { fontSize: 9, font: "helvetica" },
    headStyles: { fillColor: [12, 100, 120] },
    margin: { left: marginX, right: marginX },
  });

  const fileName = `${toAscii(studentName).replace(/\s+/g, "-")}-rapor.pdf`;

  // Native kabukta (Capacitor WebView) doc.save()'in kullandığı blob+<a download> tekniği sessizce
  // hiçbir şey yapmıyor — bunun yerine dosya paylaşım sayfası üzerinden kaydedilir/paylaşılır.
  if (isNative) {
    const base64 = doc.output("datauristring").split(",")[1];
    await savePdfAndShare(base64, fileName);
  } else {
    doc.save(fileName);
  }
}
