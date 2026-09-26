import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import { makeFixture, FIXTURE_NOW } from "./fixtures/reportFixture.js";

vi.mock("../src/api.js", async () => {
  const actual = await vi.importActual("../src/api.js");
  return {
    ...actual,
    api: {
      ...actual.api,
      getFullReport: vi.fn(),
      getAiAnalysis: vi.fn(),
      createAiAnalysis: vi.fn(),
    },
  };
});
import { api } from "../src/api.js";
import ReportScreen from "../src/screens/ReportScreen.jsx";

const student = { id: "stu-1", role: "STUDENT", name: "Deniz Kurgu" };
const coach = { id: "t1", role: "TEACHER", name: "Koç Hoca" };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXTURE_NOW);
  api.getAiAnalysis.mockResolvedValue({ enabled: false, configured: false, analysis: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("ReportScreen", { timeout: 30000 }, () => {
  it("öğrenci görünümü: bölümler, en fazla 3 öneri kartı, koç paneli yok", async () => {
    api.getFullReport.mockResolvedValue(makeFixture({ viewer: "student" }));
    render(<ReportScreen user={student} onOpenStudyLog={vi.fn()} onOpenRecipient={vi.fn()} />);
    await screen.findByText("BU HAFTA");
    for (const t of ["SENİN İÇİN", "DERS KARNESİ", "ÖDEV DÜZENİ", "ÖNCELİKLİ KONULAR", "GELİŞİMİN", "NET NEREDEN KAÇIYOR?", "KAPSAM VE TELAFİ"]) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
    expect(screen.queryByText("KOÇ PANELİ")).toBeNull();
    expect(screen.queryByText("Müdahale")).toBeNull();
    const recs = document.querySelector("#rapor-oneriler");
    expect(within(recs).getAllByText("Neden?").length).toBeLessThanOrEqual(3);
    expect(document.body.textContent).not.toMatch(/zayıf|kötü|başarısız|geride|tembel|hile/i);
  });

  it("koç görünümü: koç paneli, durum, yapay zekâ kapalı notu; ders dökümü açılır", async () => {
    api.getFullReport.mockResolvedValue(makeFixture({ viewer: "coach" }));
    render(<ReportScreen user={coach} studentId="stu-1" studentName="Deniz Kurgu" onAssign={vi.fn()} onOpenAssignment={vi.fn()} />);
    await screen.findByText("KOÇ PANELİ");
    expect(screen.getByText("DİKKAT GEREKTİRENLER")).toBeInTheDocument();
    expect(screen.getByText("Görüşme gündemi")).toBeInTheDocument();
    await screen.findByText(/Okulda kapalı/);
    const karne = document.querySelector("#rapor-karne");
    fireEvent.click(within(karne).getAllByRole("button", { name: /Matematik/ })[0]);
    await screen.findByRole("dialog");
    expect(within(screen.getByRole("dialog")).getByText("Önce bunlar")).toBeInTheDocument();
  });

  it("pencere değişince yeniden hesaplanır (Tüm dönem)", async () => {
    api.getFullReport.mockResolvedValue(makeFixture({ viewer: "student" }));
    render(<ReportScreen user={student} />);
    await screen.findByText("BU HAFTA");
    fireEvent.click(screen.getByRole("button", { name: "Tüm dönem" }));
    await waitFor(() => expect(screen.getByText(/14 Eylül – 20 Kasım 2026/)).toBeInTheDocument());
  });

  it("az veride 'Raporun oluşuyor' kartı", async () => {
    api.getFullReport.mockResolvedValue(makeFixture({ viewer: "student", sparse: true, weeks: 1 }));
    render(<ReportScreen user={student} onOpenStudyLog={vi.fn()} onOpenHome={vi.fn()} />);
    await screen.findByText("Raporun oluşuyor");
    expect(screen.getByRole("button", { name: /Serbest çalışma ekle/ })).toBeInTheDocument();
  });

  it("aylık rapordan açılınca ay penceresi seçili gelir", async () => {
    api.getFullReport.mockResolvedValue(makeFixture({ viewer: "coach" }));
    render(<ReportScreen user={coach} studentId="stu-1" month="2026-10" />);
    await screen.findByText("KOÇ PANELİ");
    expect(screen.getByRole("button", { name: "Ekim 2026" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1–31 Ekim 2026")).toBeInTheDocument();
  });
});
