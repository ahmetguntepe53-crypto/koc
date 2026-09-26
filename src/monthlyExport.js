import { api } from "./api.js";
import { buildReport, monthWindowKey } from "./reportModel.js";
import { monthLabel } from "./screens/teacher/MonthlyReportsScreen.jsx";

// Aylık raporların tek PDF'i (koç): her öğrencinin o ayki raporu aynı modelle (src/reportModel.js) hesaplanır; varsa
// o ayın yapay zekâ incelemesi de eklenir. Öğrenciler sırayla yüklenir — sunucuyu bir anda 6–7 ağır istekle yormamak için.
export async function exportMonthlyReportsPdf({ month, students, coachName }) {
  const entries = [];
  for (const s of students) {
    const raw = await api.getFullReport(s.id);
    const model = buildReport(raw, { window: monthWindowKey(month) });
    let ai = null;
    try {
      const d = await api.getAiAnalysis(s.id, month);
      if (d?.analysis) ai = { ...d.analysis.content, generatedAt: d.analysis.updatedAt, month };
    } catch { /* inceleme yoksa PDF yine oluşur */ }
    entries.push({ model, ai });
  }
  const { downloadMonthlyReportsPdf } = await import("./reportPdf.js");
  await downloadMonthlyReportsPdf({ month, monthLabel: monthLabel(month), coachName, entries });
}
