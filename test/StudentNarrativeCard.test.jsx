// "Ayın değerlendirmesi" kartı (src/screens/report/StudentNarrative.jsx) — öğrencinin Gelişim ekranında görünür, koçun
// açtığı raporda görünmez; ilk çizimden sonra hesaplanır; koça özel bölüm göstermez; ay çipleriyle yeniden hesaplanır.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { makeFixture, FIXTURE_NOW } from "./fixtures/reportFixture.js";

vi.mock("../src/api.js", async () => {
  const actual = await vi.importActual("../src/api.js");
  return {
    ...actual,
    api: { ...actual.api, getFullReport: vi.fn(), getAiAnalysis: vi.fn(), createAiAnalysis: vi.fn() },
  };
});
import { api } from "../src/api.js";
import ReportScreen from "../src/screens/ReportScreen.jsx";
import { buildNarrative } from "../src/narrative/index.js";

const student = { id: "stu-1", role: "STUDENT", name: "Deniz Kurgu" };
const coach = { id: "t1", role: "TEACHER", name: "Koç Hoca" };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXTURE_NOW);
  api.getAiAnalysis.mockResolvedValue({ enabled: false, configured: false, analysis: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Ayın değerlendirmesi kartı", { timeout: 30000 }, () => {
  it("öğrenci görünümünde: özet, güçlü yönler, gelişim alanları ve bu haftanın adımları; koça özel bölüm yok", async () => {
    api.getFullReport.mockResolvedValue(makeFixture({ viewer: "student", weeks: 20 }));
    render(<ReportScreen user={student} onOpenStudyLog={vi.fn()} onOpenRecipient={vi.fn()} />);
    await screen.findByText("AYIN DEĞERLENDİRMESİ");
    const card = document.querySelector("#rapor-degerlendirme");
    await within(card).findByText("Bu hafta yapabileceklerin");
    expect(within(card).getByText("Güçlü yönlerin")).toBeInTheDocument();
    expect(within(card).getByText("Gelişim alanların")).toBeInTheDocument();
    expect(within(card).getAllByText("Sonraki adım:").length).toBeGreaterThan(0);
    expect(within(card).getByRole("group", { name: "Değerlendirilecek ay" })).toBeInTheDocument();
    const t = card.textContent;
    expect(t).not.toMatch(/Önümüzdeki ay için|Görüşme için|Dikkat:|müdahale|sessiz/i);
    expect(t).not.toMatch(/zayıf|kötü|başarısız|geride|tembel|hile/i);
  });

  it("ay çipiyle başka ay hesaplanır", async () => {
    api.getFullReport.mockResolvedValue(makeFixture({ viewer: "student", weeks: 20 }));
    render(<ReportScreen user={student} />);
    await screen.findByText("AYIN DEĞERLENDİRMESİ");
    const card = document.querySelector("#rapor-degerlendirme");
    await within(card).findByText("Bu hafta yapabileceklerin");
    const raw = makeFixture({ viewer: "student", weeks: 20 });
    const kasim = buildNarrative(raw, { month: "2026-11", now: FIXTURE_NOW, audience: "student" });
    const eylul = buildNarrative(raw, { month: "2026-09", now: FIXTURE_NOW, audience: "student" });
    expect(within(card).getByText(kasim.ozet)).toBeInTheDocument(); // varsayılan: içinde bulunulan ay (ayın 20'si)
    fireEvent.click(within(card).getByRole("button", { name: "Eylül" }));
    expect(within(card).getByRole("button", { name: "Eylül" })).toHaveAttribute("aria-pressed", "true");
    await within(card).findByText(eylul.ozet);
    expect(within(card).queryByText(kasim.ozet)).toBeNull();
  });

  it("koçun açtığı raporda gösterilmez (koçun kendi aylık değerlendirmesi var)", async () => {
    api.getFullReport.mockResolvedValue(makeFixture({ viewer: "coach" }));
    render(<ReportScreen user={coach} studentId="stu-1" studentName="Deniz Kurgu" onAssign={vi.fn()} onOpenAssignment={vi.fn()} />);
    await screen.findByText("KOÇ PANELİ");
    expect(screen.queryByText("AYIN DEĞERLENDİRMESİ")).toBeNull();
    expect(document.querySelector("#rapor-degerlendirme")).toBeNull();
  });
});
