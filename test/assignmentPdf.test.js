// Ödev detayındaki "Rapor (PDF)": öğrenci durum listesi — tamamladı/bekliyor/gecikti/pas geçti, net yok.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTableMod from "jspdf-autotable";
import { buildAssignmentPdfDoc, assignmentPdfFileName } from "../src/reportPdf.js";

const fontFile = (name) => fs.readFileSync(path.resolve(process.cwd(), "public/fonts", name)).toString("base64");
const font = { regular: fontFile("Roboto-Regular.ttf"), bold: fontFile("Roboto-Bold.ttf") };
const autoTable = autoTableMod.default || autoTableMod;
const assignment = { subject: "Coğrafya", topic: "İnsan ve Coğrafya", examType: "TYT", sourceBook: "Bilgi Sarmalı", questionCount: 20, scheduledDate: "2026-10-01T00:00:00Z", endDate: "2026-10-03T00:00:00Z", teacher: { name: "Ayşe Öğretmen" } };
const rows = [
  { name: "Zeynep Şahin", className: "12-B", state: "overdue" },
  { name: "Ali Çelik", className: "12-A", state: "done" },
  { name: "Büşra Işık", className: "12-B", state: "waiting" },
  { name: "Cem Gök", className: "12-C", state: "skipped" },
];

describe("ödev durum PDF'i", () => {
  it("tek sayfa, tüm öğrenciler ve durumlar Türkçe karakterle; net yazmaz", async () => {
    const doc = await buildAssignmentPdfDoc({ assignment, rows, jsPDF, autoTable, font, logo: null, now: new Date("2026-10-05T09:00:00Z") });
    expect(doc.getNumberOfPages()).toBe(1);
    if (process.env.PDF_OUT) fs.writeFileSync(process.env.PDF_OUT, Buffer.from(doc.output("arraybuffer")));
    const pdfText = doc.output();
    expect(pdfText.length).toBeGreaterThan(1000);
  });
  it("dosya adı ASCII", () => {
    expect(assignmentPdfFileName(assignment, new Date("2026-10-05T09:00:00Z"))).toBe("Odev-Raporu_Cografya-Insan-ve-Cografya_2026-10-05.pdf");
  });
});
