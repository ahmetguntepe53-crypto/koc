// Gelişim raporu > "Denemeler" bölümü ve "Deneme ekle" penceresi (ReportScreen içinde, api sahte, model GERÇEK).
// Tüm adlar ve sonuçlar kurgusal.
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
      createPracticeExam: vi.fn(),
      updatePracticeExam: vi.fn(),
      deletePracticeExam: vi.fn(),
    },
  };
});
import { api } from "../src/api.js";
import ReportScreen from "../src/screens/ReportScreen.jsx";

const student = { id: "stu-1", role: "STUDENT", name: "Deniz Kurgu" };
const coach = { id: "t1", role: "TEACHER", name: "Koç Hoca" };
const admin = { id: "a1", role: "ADMIN", name: "Yönetici" };

let seq = 0;
const ex = (date, subjects, { examType = "TYT", name = null, byStudent = true, canEdit = true } = {}) => ({
  id: `d${++seq}`, examType, date: `${date}T00:00:00.000Z`, name, byStudent, canEdit, createdAt: `${date}T15:00:00.000Z`,
  results: Object.entries(subjects).map(([subject, [correct, wrong, blank]]) => ({ subject, correct, wrong, blank })),
});
const EXAMS = () => [
  ex("2026-09-20", { Türkçe: [28, 8, 4], Matematik: [12, 6, 12], Fizik: [3, 2, 2] }),
  ex("2026-10-11", { Türkçe: [30, 6, 4], Matematik: [13, 6, 11], Fizik: [3, 2, 2] }),
  ex("2026-10-26", { Türkçe: [30, 8, 2], Matematik: [12, 8, 10], Fizik: [4, 2, 1] }),
  ex("2026-11-08", { Türkçe: [32, 6, 2], Matematik: [14, 6, 10], Fizik: [4, 1, 2] }, { byStudent: false, canEdit: false, name: "Okul Denemesi" }),
  ex("2026-11-15", { Türkçe: [33, 5, 2], Matematik: [16, 6, 8], Fizik: [5, 1, 1] }, { name: "Kurgu Yayınları TYT-5" }),
  ex("2026-11-01", { Matematik: [10, 5, 15], Geometri: [4, 2, 4], Fizik: [5, 3, 6] }, { examType: "AYT" }),
];
const raw = (viewer, { exams = EXAMS(), field = null, ...opts } = {}) => {
  const r = makeFixture({ viewer, weeks: 4, ...opts }); // ödev verisi burada önemsiz — küçük kurgu, hızlı model
  return { ...r, student: { ...r.student, field }, practiceExams: exams };
};
const section = () => document.querySelector("#rapor-denemeler");
// "Son deneme" kartı (grafikteki son nokta etiketi aynı sayıyı taşıdığı için kartın içinde aranır).
const hero = () => within(within(section()).getByText("SON DENEME").parentElement.parentElement);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXTURE_NOW);
  api.getAiAnalysis.mockResolvedValue({ enabled: false, configured: false, analysis: null });
  api.createPracticeExam.mockResolvedValue({ exam: { id: "yeni", examType: "TYT" } });
  api.updatePracticeExam.mockResolvedValue({ exam: { id: "d5", examType: "TYT" } });
  api.deletePracticeExam.mockResolvedValue({ ok: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Denemeler bölümü", { timeout: 30000 }, () => {
  it("öğrenci: Özet'in hemen ardından; son deneme neti, değişim, rekor, ders tablosu, en çok net kaçan ders", async () => {
    // jsdom'da genişlik 0 — grafik (genişliğe göre çizilir) görünsün diye kap genişliği verilir.
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(360);
    api.getFullReport.mockResolvedValue(raw("student"));
    render(<ReportScreen user={student} onOpenStudyLog={vi.fn()} />);
    await screen.findByText("BU HAFTA");
    expect(document.querySelector("#rapor-ozet").nextElementSibling).toBe(section());
    const s = within(section());
    expect(s.getByText("DENEMELER")).toBeInTheDocument();
    expect(hero().getByText("51")).toBeInTheDocument();
    expect(hero().getByText(/\+4,25 net/)).toBeInTheDocument();
    expect(hero().getByText("Kişisel rekor")).toBeInTheDocument();
    expect(hero().getByText(/Kurgu Yayınları TYT-5/)).toBeInTheDocument();
    // Ders tablosu: Son / Ort. / Soru (120'lik düzen).
    const table = s.getByRole("table");
    const mat = within(table).getByRole("rowheader", { name: "Matematik" }).closest("tr");
    expect(within(mat).getByText("14,5")).toBeInTheDocument();
    expect(within(mat).getByText("12,33")).toBeInTheDocument();
    expect(within(mat).getByText("30")).toBeInTheDocument();
    expect(s.getByText(/En çok net kaçırdığın ders: Matematik/)).toBeInTheDocument();
    // Grafik: toplam net (ölçek net, yüzde değil).
    // Grafik, kap genişliği ölçüldükten sonra (efekt) çizilir.
    expect(await s.findByRole("img", { name: /Deneme netleri: .*15 Kas 51 net/ })).toBeInTheDocument();
    // Aralıktaki 3 deneme; koçun girdiği düzenlenemez.
    expect(s.getAllByRole("button", { name: /denemesini düzenle/ })).toHaveLength(2);
    expect(s.getByText("koçun girdi")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/zayıf|kötü|başarısız|geride|tembel|hile/i);
  });

  it("AYT sekmesi: tek deneme → grafik yerine not", async () => {
    api.getFullReport.mockResolvedValue(raw("student"));
    render(<ReportScreen user={student} />);
    await screen.findByText("BU HAFTA");
    fireEvent.click(within(section()).getByRole("button", { name: /^AYT/ }));
    const s = within(section());
    expect(hero().getByText("16,5")).toBeInTheDocument(); // Matematik 8,75 + Geometri 3,5 + Fizik 4,25
    expect(s.getByText(/Grafik için en az 2 deneme gerekiyor \(1\/2\)/)).toBeInTheDocument();
  });

  it("deneme ekle: canlı net, soru sınırı, kaydet → istek ve raporun yenilenmesi", async () => {
    api.getFullReport.mockResolvedValue(raw("student"));
    render(<ReportScreen user={student} />);
    await screen.findByText("BU HAFTA");
    fireEvent.click(within(section()).getByRole("button", { name: "Deneme ekle" }));
    const dlg = within(await screen.findByRole("dialog"));
    expect(dlg.getByRole("button", { name: "TYT" })).toHaveAttribute("aria-pressed", "true");
    expect(dlg.getByLabelText("Tarih")).toHaveValue("2026-11-20");
    // Hiç ders girilmeden kaydet kapalı — nedeni yazılı (sessizce kapalı kalmaz).
    expect(dlg.getByRole("button", { name: "Denemeyi kaydet" })).toBeDisabled();
    expect(dlg.getByText(/Kaydetmek için en az bir dersin/)).toBeInTheDocument();

    fireEvent.change(dlg.getByLabelText("Türkçe doğru"), { target: { value: "30" } });
    expect(dlg.queryByText(/Kaydetmek için en az bir dersin/)).toBeNull();
    fireEvent.change(dlg.getByLabelText("Türkçe yanlış"), { target: { value: "8" } });
    expect(dlg.getAllByText("28 net")).toHaveLength(2); // ders satırı ve toplam
    // Sınıra gelince + kapanır.
    fireEvent.change(dlg.getByLabelText("Fizik doğru"), { target: { value: "7" } });
    expect(dlg.getByRole("button", { name: "Fizik boş bir artır" })).toBeDisabled();
    // Elle fazlası: uyarı ve kaydet kapalı.
    fireEvent.change(dlg.getByLabelText("Matematik doğru"), { target: { value: "31" } });
    expect(dlg.getByText("Matematik dersinde en fazla 30 soru var.")).toBeInTheDocument();
    expect(dlg.getByRole("button", { name: "Denemeyi kaydet" })).toBeDisabled();
    fireEvent.change(dlg.getByLabelText("Matematik doğru"), { target: { value: "20" } });
    fireEvent.click(dlg.getByRole("button", { name: "Matematik yanlış bir artır" }));
    expect(dlg.getByText("19,75 net")).toBeInTheDocument(); // 20 − 1/4
    expect(dlg.getByText("54,75 net")).toBeInTheDocument(); // toplam: 28 + 19,75 + 7
    fireEvent.change(dlg.getByLabelText("Yayın / deneme adı"), { target: { value: "  Kurgu Deneme 6 " } });
    fireEvent.click(dlg.getByRole("button", { name: "Denemeyi kaydet" }));

    await waitFor(() => expect(api.createPracticeExam).toHaveBeenCalledTimes(1));
    expect(api.createPracticeExam.mock.calls[0][0]).toEqual({
      examType: "TYT", date: "2026-11-20", name: "Kurgu Deneme 6",
      results: [
        { subject: "Türkçe", correct: 30, wrong: 8, blank: 0 },
        { subject: "Matematik", correct: 20, wrong: 1, blank: 0 },
        { subject: "Fizik", correct: 7, wrong: 0, blank: 0 },
      ],
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(api.getFullReport).toHaveBeenCalledTimes(2));
    expect(screen.getByText("BU HAFTA")).toBeInTheDocument(); // sessiz yenileme: yükleniyor ekranına düşmez
  });

  it("koç: kendi öğrencisi için ekler (studentId); AYT'de öğrencinin alanının dersleri ön seçili", async () => {
    // Koç görünümünde sunucu her kayıtta canEdit: true döner (kendi öğrencisi).
    api.getFullReport.mockResolvedValue(raw("coach", { field: "SAY", exams: EXAMS().map((e) => ({ ...e, canEdit: true })) }));
    render(<ReportScreen user={coach} studentId="stu-1" studentName="Deniz Kurgu" />);
    await screen.findByText("KOÇ PANELİ");
    fireEvent.click(within(section()).getByRole("button", { name: "Deneme ekle" }));
    const dlg = within(await screen.findByRole("dialog"));
    fireEvent.click(dlg.getByRole("button", { name: "AYT" }));
    expect(dlg.getByLabelText("Fizik doğru")).toBeInTheDocument();
    expect(dlg.queryByLabelText("Edebiyat doğru")).toBeNull();
    fireEvent.click(dlg.getByRole("button", { name: "Edebiyat" }));
    fireEvent.change(dlg.getByLabelText("Edebiyat doğru"), { target: { value: "12" } });
    fireEvent.change(dlg.getByLabelText("Matematik doğru"), { target: { value: "15" } });
    fireEvent.click(dlg.getByRole("button", { name: "Denemeyi kaydet" }));
    await waitFor(() => expect(api.createPracticeExam).toHaveBeenCalledTimes(1));
    expect(api.createPracticeExam.mock.calls[0][0]).toMatchObject({
      studentId: "stu-1", examType: "AYT",
      results: [{ subject: "Edebiyat", correct: 12, wrong: 0, blank: 0 }, { subject: "Matematik", correct: 15, wrong: 0, blank: 0 }],
    });
    // Koç öğrencinin girdiklerini de düzenleyebilir (aralıktaki 3 TYT denemesinin hepsi).
    expect(within(section()).getAllByRole("button", { name: /denemesini düzenle/ })).toHaveLength(3);
  });

  it("düzenle: form mevcut değerlerle açılır, güncelleme isteği gider; sil: onay → silme", async () => {
    const exams = EXAMS();
    api.getFullReport.mockResolvedValue(raw("student", { exams }));
    render(<ReportScreen user={student} />);
    await screen.findByText("BU HAFTA");
    fireEvent.click(within(section()).getByRole("button", { name: "15 Kas 2026 tarihli TYT denemesini düzenle" }));
    const dlg = within(await screen.findByRole("dialog"));
    expect(dlg.getByText("Denemeyi düzenle")).toBeInTheDocument();
    expect(dlg.getByLabelText("Türkçe doğru")).toHaveValue("33");
    expect(dlg.getByLabelText("Tarih")).toHaveValue("2026-11-15");
    fireEvent.change(dlg.getByLabelText("Türkçe doğru"), { target: { value: "34" } });
    fireEvent.change(dlg.getByLabelText("Türkçe boş"), { target: { value: "1" } });
    fireEvent.click(dlg.getByRole("button", { name: "Değişiklikleri kaydet" }));
    await waitFor(() => expect(api.updatePracticeExam).toHaveBeenCalledTimes(1));
    const [id, payload] = api.updatePracticeExam.mock.calls[0];
    expect(id).toBe(exams[4].id);
    expect(payload.results[0]).toEqual({ subject: "Türkçe", correct: 34, wrong: 5, blank: 1 });
    expect(payload.name).toBe("Kurgu Yayınları TYT-5");

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(within(section()).getByRole("button", { name: "15 Kas 2026 tarihli TYT denemesini sil" }));
    await waitFor(() => expect(api.deletePracticeExam).toHaveBeenCalledWith(exams[4].id));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/15 Kas 2026 · Kurgu Yayınları TYT-5 \(51 net\) silinsin mi/));
    await waitFor(() => expect(api.getFullReport).toHaveBeenCalledTimes(3));
  });

  it("deneme yoksa boş durum ve 'Deneme ekle'; admin ekleyemez", async () => {
    api.getFullReport.mockResolvedValue(raw("student", { exams: [] }));
    render(<ReportScreen user={student} />);
    await screen.findByText("BU HAFTA");
    expect(within(section()).getByText("Henüz deneme kaydı yok")).toBeInTheDocument();
    fireEvent.click(within(section()).getByRole("button", { name: "Deneme ekle" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    cleanup();

    api.getFullReport.mockResolvedValue(raw("coach"));
    render(<ReportScreen user={admin} studentId="stu-1" />);
    await screen.findByText("KOÇ PANELİ");
    expect(within(section()).getByText("SON DENEME")).toBeInTheDocument();
    expect(within(section()).queryByRole("button", { name: /Deneme ekle|düzenle|sil/ })).toBeNull();
  });

  it("hiç ödev/çalışma kaydı yokken: denemesi varsa rapor açılır; hiçbir şey yoksa boş durum + deneme ekle", async () => {
    const bare = { viewer: "student", student: { id: "stu-1", name: "Deniz Kurgu", gradeLevel: 12, createdAt: "2026-09-01T09:00:00Z" }, items: [], sessions: [] };
    api.getFullReport.mockResolvedValue({ ...bare, practiceExams: EXAMS() });
    render(<ReportScreen user={student} />);
    await screen.findByText("Raporun oluşuyor");
    expect(hero().getByText("51")).toBeInTheDocument();
    cleanup();

    api.getFullReport.mockResolvedValue({ ...bare, practiceExams: [] });
    render(<ReportScreen user={student} />);
    await screen.findByText(/Henüz raporlanacak bir sonuç yok/);
    expect(within(section()).getByRole("button", { name: "Deneme ekle" })).toBeInTheDocument();
  });
});
