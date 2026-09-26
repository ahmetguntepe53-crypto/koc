import { isNative, savePdfAndShare } from "./native/index.js";

// jsPDF'in standart fontları (Helvetica vb.) Türkçe'ye özgü karakterleri (ğ ş ı İ ç ö ü) basamıyor.
// Bu yüzden public/fonts/ altındaki Roboto (SIL Open Font License 1.1, bkz. public/fonts/OFL.txt)
// PDF oluşturulurken — yalnızca o an, ilk açılış paketine hiç girmeden — yüklenip PDF'e gömülür.
// Font yüklenemezse (ör. çevrimdışı web) eski yönteme düşülür: metin ASCII'ye çevrilip Helvetica ile
// basılır ("Öğrenci" → "Ogrenci") — kutu/bozuk karakter basmaktan iyidir, PDF yine de oluşur.
const TR_MAP = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", I: "I", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U" };
function toAscii(str) {
  return String(str ?? "").replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_MAP[c] ?? c);
}

const GROUP_LABELS_TR = { day: "Günlük", week: "Haftalık", month: "Aylık" };

const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function periodLabel(period, groupBy) {
  if (groupBy === "day") {
    const [year, month, day] = period.split("-");
    return `${Number(day)} ${MONTHS_TR[Number(month) - 1]} ${year}`;
  }
  if (groupBy === "month") {
    const [year, month] = period.split("-");
    return `${MONTHS_TR[Number(month) - 1]} ${year}`;
  }
  const [year, week] = period.split("-H");
  return `${Number(week)}. Hafta, ${year}`;
}

// Aynı origin'den bir dosyayı data URL'e çevirir — jsPDF addImage bir data URL bekliyor.
// Yüklenemezse null döner; çağıran taraf o parçayı atlar (logo kritik değil).
async function fetchAsDataUrl(path) {
  try {
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

// Roboto'yu belgeye kaydeder; başarılıysa "Roboto" döner, değilse null (Helvetica + ASCII'ye düşülür).
async function registerUnicodeFont(doc) {
  const [regular, bold] = await Promise.all([fetchFontBase64("/fonts/Roboto-Regular.ttf"), fetchFontBase64("/fonts/Roboto-Bold.ttf")]);
  if (!regular || !bold) return null;
  try {
    doc.addFileToVFS("Roboto-Regular.ttf", regular);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", bold);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    return "Roboto";
  } catch {
    return null;
  }
}

// jsPDF + jspdf-autotable yalnızca bu fonksiyon çağrıldığında (PDF indir butonuna tıklanınca)
// dinamik import edilir — ilk sayfa yüklemesinde hiç kimseye ekstra bundle boyutu yüklenmesin diye.
export async function downloadReportPdf({ data, studentName, groupBy }) {
  const [[{ default: jsPDF }, { default: autoTable }], logoDataUrl] = await Promise.all([
    Promise.all([import("jspdf"), import("jspdf-autotable")]),
    fetchAsDataUrl("/logo.png"),
  ]);
  const doc = new jsPDF();
  const unicodeFont = await registerUnicodeFont(doc);
  const FONT = unicodeFont || "helvetica";
  const t = unicodeFont ? (s) => String(s ?? "") : toAscii;
  const marginX = 14;
  let y = 14;

  // Logo (public/logo.png) sol üstte, okul adı/başlık metni sağında.
  const logoW = 16, logoH = logoW;
  const textX = logoDataUrl ? marginX + logoW + 6 : marginX;
  if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", marginX, y, logoW, logoH);

  doc.setFont(FONT, "bold");
  doc.setFontSize(12);
  doc.text(t("Mehmet Akif İnan Hafız"), textX, y + 6);
  doc.text(t("Anadolu İmam Hatip Lisesi"), textX, y + 13);
  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(t(`Oluşturulma: ${new Date().toLocaleDateString("tr-TR")}  |  Gruplama: ${GROUP_LABELS_TR[groupBy]}`), textX, y + 19);
  doc.setTextColor(0);

  y = Math.max(y + logoH, y + 22) + 6;
  doc.setFont(FONT, "bold");
  doc.setFontSize(13);
  doc.text(t(`${studentName} - Başarı Raporu`), marginX, y);
  y += 10;

  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  doc.text(
    t(`Toplam  -  Doğru: ${data.overall.correctCount}   Yanlış: ${data.overall.wrongCount}   Boş: ${data.overall.blankCount}   Net: ${data.overall.net}`),
    marginX, y
  );
  y += 8;

  const tableStyles = { styles: { fontSize: 9, font: FONT }, headStyles: { fillColor: [12, 100, 120], font: FONT, fontStyle: "bold" } };

  autoTable(doc, {
    startY: y,
    head: [[t("Ders"), t("Kayıt"), t("Doğru"), t("Yanlış"), t("Boş"), "Net"]],
    body: data.bySubject.map((s) => [t(s.subject), s.count, s.correctCount, s.wrongCount, s.blankCount, s.net]),
    ...tableStyles,
    margin: { left: marginX, right: marginX },
  });

  const afterSubjectsY = doc.lastAutoTable.finalY + 10;
  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  doc.text(t("Zamana Göre"), marginX, afterSubjectsY);

  autoTable(doc, {
    startY: afterSubjectsY + 4,
    head: [[t("Dönem"), t("Kayıt"), t("Doğru"), t("Yanlış"), t("Boş"), "Net"]],
    body: [...data.byPeriod].reverse().map((p) => [t(periodLabel(p.period, groupBy)), p.count, p.correctCount, p.wrongCount, p.blankCount, p.net]),
    ...tableStyles,
    margin: { left: marginX, right: marginX },
  });

  // Dosya adı her zaman ASCII — bazı paylaşım hedefleri (e-posta ekleri, eski Android dosya
  // yöneticileri) Türkçe karakterli dosya adlarını bozabiliyor.
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
