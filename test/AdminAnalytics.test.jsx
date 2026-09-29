import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";

vi.mock("../src/api.js", async () => {
  const actual = await vi.importActual("../src/api.js");
  return {
    ...actual,
    api: {
      ...actual.api,
      adminAnalytics: vi.fn(),
      adminListUsers: vi.fn(),
      adminListTeachers: vi.fn(),
      adminStats: vi.fn(),
    },
  };
});
import { api } from "../src/api.js";
import AdminAnalytics from "../src/screens/admin/AdminAnalytics.jsx";
import AdminUsersScreen from "../src/screens/admin/AdminUsersScreen.jsx";

// Sunucu yanıtı biçiminde kurgusal veri (bkz. server/src/routes/adminAnalytics.js) — öğrenci adı zaten hiç yok.
const row = (over) => ({
  id: "a1", examType: "TYT", subject: "Matematik", topic: "Kurgu: Üslü sayılar", teacher: "Kurgu Branş Hoca",
  scheduledDate: "2026-09-14T00:00:00.000Z", endDate: "2026-09-18T00:00:00.000Z", week: "2026-W38", targetGrade: null,
  questionCount: 20, closed: true, recipients: 24, submitted: 16, skipped: 5, silent: 3, open: 0, participation: 66.7,
  skips: { KONU: 4, ZAMAN: 1, KAYNAK: 0, DIGER: 0 }, konuPassRate: 16.7, n: 12, median: 52.5, q1: 38.8, q3: 66.3, flags: [],
  ...over,
});
const week = (w, start, over) => ({ week: w, start, assignments: 0, recipients: 0, submitted: 0, participation: null, median: null, konuPassRate: null, medianCount: 0, ...over });
function fixture() {
  return {
    window: { weeks: 8, from: "2026-08-03", to: "2026-09-26", gradeLevel: null },
    thresholds: { minGroup: 10, minQuestions: 10, hardMedian: 35, konuSignal: 20, lowParticipation: 60 },
    summary: { assignments: 3, recipients: 60, submitted: 39, participation: 65, median: 47.5, konuPassRate: 21.7, medianCount: 2, flagged: 2 },
    hidden: 2,
    assignments: [
      row({ id: "a3", examType: "AYT", subject: "Fizik", topic: "Kurgu: Vektörler", recipients: 12, submitted: 11, participation: 91.7, median: 30, q1: 28, q3: 33, konuPassRate: 0, skips: { KONU: 0, ZAMAN: 0, KAYNAK: 0, DIGER: 0 }, silent: 1, flags: ["zor"], targetGrade: 12 }),
      row({ id: "a2", subject: "Türkçe", topic: "Kurgu: Paragraf", participation: 50, submitted: 12, konuPassRate: 25, skips: { KONU: 6, ZAMAN: 0, KAYNAK: 0, DIGER: 0 }, median: null, q1: null, q3: null, n: 4, flags: ["konu", "katilim"] }),
      row({ id: "a1" }),
    ],
    subjects: [
      { examType: "AYT", subject: "Fizik", assignments: 1, recipients: 12, submitted: 11, participation: 91.7, median: 30, konuPassRate: 0, medianCount: 1, trend: { median: null, participation: null }, flags: ["zor"] },
      { examType: "TYT", subject: "Matematik", assignments: 1, recipients: 24, submitted: 16, participation: 66.7, median: 52.5, konuPassRate: 16.7, medianCount: 1, trend: { median: 12.4, participation: -4 }, flags: [] },
      { examType: "TYT", subject: "Türkçe", assignments: 1, recipients: 24, submitted: 12, participation: 50, median: null, konuPassRate: 25, medianCount: 0, trend: { median: -6, participation: null }, flags: ["konu", "katilim"] },
    ],
    weeks: [
      week("2026-W32", "2026-08-03"), week("2026-W33", "2026-08-10"), week("2026-W34", "2026-08-17"), week("2026-W35", "2026-08-24"),
      week("2026-W36", "2026-08-31"), week("2026-W37", "2026-09-07", { assignments: 1, participation: 91.7, median: 30 }),
      week("2026-W38", "2026-09-14", { assignments: 2, participation: 58.3, median: 52.5 }), week("2026-W39", "2026-09-21"),
    ],
  };
}

beforeEach(() => {
  api.adminAnalytics.mockReset();
  api.adminAnalytics.mockResolvedValue(fixture());
});
afterEach(() => cleanup());

describe("AdminAnalytics (Okul analizi)", () => {
  it("özet kartları, k-anonimlik notu, dikkat listesi, ders tablosu ve haftalık seyir", async () => {
    render(<AdminAnalytics />);
    await screen.findByText("DİKKAT GEREKTİREN ÖDEVLER");
    expect(api.adminAnalytics).toHaveBeenCalledWith(8, "");

    // Üç sayaç, yüzde işareti önde ("katılım" ödev satırlarında da geçer — ilki sayaç).
    expect(screen.getAllByText("katılım")[0].previousSibling).toHaveTextContent("%65");
    expect(screen.getByText("medyan net oranı").previousSibling).toHaveTextContent("%48");
    expect(screen.getByText("konu pası oranı").previousSibling).toHaveTextContent("%22");

    // k-anonimlik açıklaması ve gizlenen sayısı.
    expect(screen.getByText(/10'dan az öğrencili ödevler gösterilmez/)).toBeInTheDocument();
    expect(screen.getByText(/ödev bu yüzden gizli/)).toHaveTextContent("Bu seçimde 2 ödev bu yüzden gizli.");

    // Dikkat listesi: yalnızca işaretli iki ödev, işaret rozetleriyle; işaretsiz ödev listede yok.
    const flagged = screen.getByRole("list", { name: "Dikkat gerektiren ödevler" });
    const items = within(flagged).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Zor gelen")).toBeInTheDocument();
    expect(within(items[0]).getByText("%28–%33")).toBeInTheDocument();
    expect(within(items[1]).getByText("Konu eksiği sinyali")).toBeInTheDocument();
    expect(within(items[1]).getByText("Düşük katılım")).toBeInTheDocument();
    expect(within(items[1]).getByText("12/24")).toBeInTheDocument();
    expect(within(flagged).queryByText(/Üslü sayılar/)).toBeNull();

    // Ders tablosu: sayılar ve eğilim (+12 yükseliş, −6 düşüş, veri yoksa —).
    const table = screen.getByRole("table");
    const mat = within(table).getByRole("row", { name: /Matematik/ });
    expect(within(mat).getByText("%67")).toBeInTheDocument();
    expect(within(mat).getByText("+12")).toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /Türkçe/ })).getByText("−6")).toBeInTheDocument();

    // Haftalık seyir: çubukların verisi ekran okuyucuya metin olarak.
    expect(screen.getByRole("img", { name: /Katılım, haftalık: .*14 Eyl %58/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Medyan net oranı, haftalık: .*3 Ağu veri yok/ })).toBeInTheDocument();

    // Dil kuralı.
    expect(document.body.textContent).not.toMatch(/zayıf|kötü|başarısız|geride|tembel|hile/i);
  });

  it("dönem ve sınıf çipleri yeniden yükler", async () => {
    render(<AdminAnalytics />);
    await screen.findByText("DİKKAT GEREKTİREN ÖDEVLER");
    fireEvent.click(screen.getByRole("button", { name: "16 hafta" }));
    await waitFor(() => expect(api.adminAnalytics).toHaveBeenLastCalledWith(16, ""));
    fireEvent.click(screen.getByRole("button", { name: "12. sınıf" }));
    await waitFor(() => expect(api.adminAnalytics).toHaveBeenLastCalledWith(16, 12));
    expect(screen.getByRole("button", { name: "12. sınıf" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Tümü" }));
    await waitFor(() => expect(api.adminAnalytics).toHaveBeenLastCalledWith(16, ""));
  });

  it("tüm ödevler açılır; işaretsiz ödev de görünür", async () => {
    render(<AdminAnalytics />);
    await screen.findByText("DİKKAT GEREKTİREN ÖDEVLER");
    const toggle = screen.getByRole("button", { name: "Tüm ödevleri göster" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    const all = screen.getByRole("list", { name: "Tüm ödevler" });
    expect(within(all).getAllByRole("listitem")).toHaveLength(3);
    expect(within(all).getByText(/Üslü sayılar/)).toBeInTheDocument();
  });

  it("boş dönem ve hata durumu", async () => {
    const empty = { ...fixture(), summary: { assignments: 0, recipients: 0, submitted: 0, participation: null, median: null, konuPassRate: null, medianCount: 0, flagged: 0 }, hidden: 0, assignments: [], subjects: [], weeks: [] };
    api.adminAnalytics.mockResolvedValueOnce(empty);
    render(<AdminAnalytics />);
    await screen.findByText("Bu dönemde gösterilecek okul geneli ödev yok.");
    expect(screen.queryByRole("table")).toBeNull();
    cleanup();

    api.adminAnalytics.mockRejectedValueOnce(new Error("Sunucuya bağlanılamadı"));
    render(<AdminAnalytics />);
    await screen.findByText("Okul analizi yüklenemedi");
    fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    await screen.findByText("DİKKAT GEREKTİREN ÖDEVLER");
  });

  it("Kurulum ekranında 'Okul analizi' sekmesi; diğer sekmeler yerinde", async () => {
    api.adminListUsers.mockResolvedValue({ users: [] });
    api.adminListTeachers.mockResolvedValue({ teachers: [] });
    api.adminStats.mockResolvedValue({ teacherCount: 0, studentCount: 0, studentsWithoutTeacher: 0, teachersWithoutStudents: 0 });
    render(<AdminUsersScreen />);
    const tabs = screen.getByRole("group", { name: "Kurulum bölümleri" });
    expect(within(tabs).getAllByRole("button").map((b) => b.textContent)).toEqual(["Koç eşleştirme", "Hesaplar", "Branşlar", "Aktivite", "Sıralama", "Okul analizi", "Sistem"]);
    fireEvent.click(within(tabs).getByRole("button", { name: "Okul analizi" }));
    // Sekme tembel yüklenir (React.lazy) — ilk dönüşüm yük altında 1 sn'yi aşabilir.
    await screen.findByText("DİKKAT GEREKTİREN ÖDEVLER", {}, { timeout: 10000 });
    expect(api.adminAnalytics).toHaveBeenCalledWith(8, "");
  });
});
