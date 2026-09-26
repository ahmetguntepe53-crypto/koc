import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import { makeFixture, FIXTURE_NOW } from "./fixtures/reportFixture.js";
import { buildReport } from "../src/reportModel.js";
import { C } from "../src/theme.js";

// Öğrencilerim (koç) — isim yanındaki durum çipi. api sahte, rapor modeli GERÇEK: çip, aynı yanıttan raporun
// koç panelinin gösterdiği durumla birebir aynı olmalı. Tüm isimler ve veriler kurgusal.
vi.mock("../src/api.js", async () => {
  const actual = await vi.importActual("../src/api.js");
  return { ...actual, api: { ...actual.api, teacherListStudents: vi.fn(), getFullReport: vi.fn() } };
});
// Bildirim izni uyarısı native Firebase eklentisini (CJS) çeker — jsdom'da çözülemez ve bu testle ilgisi yok.
vi.mock("../src/components/PushPermissionBanner.jsx", () => ({ default: () => null }));
import { api } from "../src/api.js";
import { clearStudentStatusCache } from "../src/studentStatus.js";
import TeacherStudentsScreen from "../src/screens/teacher/TeacherStudentsScreen.jsx";

const coach = { id: "t1", role: "TEACHER", name: "Koç Hoca" };
const seenToday = FIXTURE_NOW.toISOString();
const row = (id, name, extra = {}) => ({
  id, name, gradeLevel: 12, banned: false, lastSeenAt: seenToday, createdAt: "2026-09-01T09:00:00Z",
  overdueCount: 0, week: [], weekNet: null, prevWeekNet: null, mine: { done: 0, total: 0 }, ...extra,
});
// Varsayılan sıra (en geriden): gecikme sayısı çoktan aza → Ece, Ada, Bora, Cem, Dila.
const STUDENTS = [
  row("s-ada", "Ada Kurgu", { overdueCount: 3 }),
  row("s-bora", "Bora Örnek", { overdueCount: 2 }),
  row("s-cem", "Cem Deneme", { overdueCount: 1 }),
  row("s-dila", "Dila Taslak"),
  row("s-ece", "Ece Model", { overdueCount: 5 }),
];
const RAWS = {
  "s-ada": makeFixture({ seed: 99 }), // Takip et
  "s-bora": makeFixture({ seed: 42 }), // Müdahale
  "s-cem": makeFixture({ sparse: true }), // Yolunda
  "s-ece": makeFixture({ sparse: true, seed: 7 }), // Yolunda
};
const expected = (id) => buildReport(RAWS[id], { window: "4w" }).coach;
const rowOf = (name) => screen.getByRole("button", { name: new RegExp(name) });
const order = () => screen.getAllByRole("button").map((b) => b.textContent).filter((t) => /Kurgu|Örnek|Deneme|Taslak|Model/.test(t)).map((t) => t.match(/Ada|Bora|Cem|Dila|Ece/)[0]);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXTURE_NOW);
  clearStudentStatusCache();
  // Node'un deneysel localStorage'ı jsdom'unkini gölgeleyip tanımsız bırakabiliyor — tercih testi için bellek içi depo.
  const store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  });
  api.teacherListStudents.mockResolvedValue({ students: STUDENTS });
  api.getFullReport.mockImplementation(async (id) => {
    if (id === "s-dila") throw new Error("Sunucuyla iletişim kurulamadı");
    return RAWS[id];
  });
});
// Kapı (ilk test) test yarıda düşse bile açılır: yoksa bekleyen iki istek studentStatus.js'in modül düzeyindeki ortak
// eşzamanlılık yuvalarını (2) sonsuza dek tutar ve sonraki testlerin hiçbir isteği başlamaz — tek bir zaman aşımı hepsini
// düşürürdü.
let releaseGate = null;
afterEach(() => { releaseGate?.(); releaseGate = null; cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("TeacherStudentsScreen — durum çipi", { timeout: 30000 }, () => {
  it("liste durumları beklemeden çizilir; çipler geldikçe belirir", async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    releaseGate = release;
    api.getFullReport.mockImplementation(async (id) => { await gate; return RAWS[id] || Promise.reject(new Error("yok")); });
    render(<TeacherStudentsScreen user={coach} onOpen={vi.fn()} />);
    await screen.findByText("Ada Kurgu", {}, { timeout: 8000 });
    for (const n of ["Bora Örnek", "Cem Deneme", "Dila Taslak", "Ece Model"]) expect(screen.getByText(n)).toBeInTheDocument();
    expect(screen.queryByText("Müdahale")).toBeNull();
    expect(screen.getByText(/Durumlar hesaplanıyor/)).toBeInTheDocument();
    // Liste sırasıyla (en geriden) istenir: önce Ece, sonra Ada; aynı anda en fazla 2.
    await waitFor(() => expect(api.getFullReport).toHaveBeenCalledTimes(2), { timeout: 8000 });
    expect(api.getFullReport.mock.calls.map((c) => c[0])).toEqual(["s-ece", "s-ada"]);
    release();
    await within(rowOf("Bora Örnek")).findByText("Müdahale", {}, { timeout: 8000 });
  });

  it("çip ve ilk neden, raporun koç panelindeki durumun aynısı; hata olan öğrencide çip yok", async () => {
    render(<TeacherStudentsScreen user={coach} onOpen={vi.fn()} />);
    await screen.findByText("Ada Kurgu", {}, { timeout: 8000 });
    await waitFor(() => expect(screen.queryByText(/Durumlar hesaplanıyor/)).toBeNull(), { timeout: 8000 });

    for (const [id, name] of [["s-ada", "Ada Kurgu"], ["s-bora", "Bora Örnek"], ["s-cem", "Cem Deneme"], ["s-ece", "Ece Model"]]) {
      const c = expected(id);
      const r = rowOf(name);
      expect(within(r).getByText(c.statusLabel)).toBeInTheDocument();
      if (c.reasons[0]) expect(r.textContent).toContain(c.reasons[0]);
    }
    expect(expected("s-bora").status).toBe("intervene");
    expect(expected("s-ada").status).toBe("watch");
    expect(expected("s-cem").status).toBe("ok");
    // Çip tonları: Müdahale kırmızı, Takip et sarı, Yolunda yeşil (Pill yazı rengi durum tonundan).
    const hex = (el) => el.style.color.replace(/\s/g, "").toLowerCase();
    const rgb = (h) => `rgb(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)})`;
    expect(hex(within(rowOf("Bora Örnek")).getByText("Müdahale"))).toBe(rgb(C.red));
    expect(hex(within(rowOf("Ada Kurgu")).getByText("Takip et"))).toBe(rgb(C.amber));
    expect(hex(within(rowOf("Cem Deneme")).getByText("Yolunda"))).toBe(rgb(C.green));
    const dila = rowOf("Dila Taslak");
    for (const label of ["Müdahale", "Takip et", "Yolunda"]) expect(within(dila).queryByText(label)).toBeNull();
    // Özet satırı (yalnızca gelen durumlar sayılır) ve dil kuralı.
    const summary = screen.getByText(/müdahale ·/).closest("span");
    expect(summary.textContent).toBe("1 müdahale · 1 takip et · 2 yolunda");
    const chipTexts = [...document.querySelectorAll(".k-list-row")].map((b) => b.textContent).join(" ");
    expect(chipTexts).not.toMatch(/zayıf|kötü|başarısız|tembel|hile/i);
  });

  it("'Önce müdahale': sıra durum önceliğine göre, eşitlikte en geriden; tercih hatırlanır", async () => {
    render(<TeacherStudentsScreen user={coach} onOpen={vi.fn()} />);
    await screen.findByText("Ada Kurgu", {}, { timeout: 8000 });
    await waitFor(() => expect(screen.queryByText(/Durumlar hesaplanıyor/)).toBeNull(), { timeout: 8000 });
    expect(order()).toEqual(["Ece", "Ada", "Bora", "Cem", "Dila"]); // varsayılan sıra değişmedi

    const toggle = screen.getByRole("button", { name: "Önce müdahale" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(order()).toEqual(["Bora", "Ada", "Ece", "Cem", "Dila"]);
    expect(screen.getByText("ÖNCE MÜDAHALE GEREKENLER")).toBeInTheDocument();
    expect(localStorage.getItem("kocluk-students-sort")).toBe("status");

    fireEvent.click(toggle);
    expect(order()).toEqual(["Ece", "Ada", "Bora", "Cem", "Dila"]);
    expect(localStorage.getItem("kocluk-students-sort")).toBeNull();
  });

  it("kaydedilmiş 'Önce müdahale' tercihiyle açılır", async () => {
    localStorage.setItem("kocluk-students-sort", "status");
    render(<TeacherStudentsScreen user={coach} onOpen={vi.fn()} />);
    await screen.findByText("Ada Kurgu", {}, { timeout: 8000 });
    expect(screen.getByRole("button", { name: "Önce müdahale" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(order()).toEqual(["Bora", "Ada", "Ece", "Cem", "Dila"]), { timeout: 8000 });
  });

  it("geri dönünce önbellekteki çipler ilk çizimde hazır, yeni istek yok", async () => {
    const first = render(<TeacherStudentsScreen user={coach} onOpen={vi.fn()} />);
    await screen.findByText("Ada Kurgu", {}, { timeout: 8000 });
    await waitFor(() => expect(screen.queryByText(/Durumlar hesaplanıyor/)).toBeNull(), { timeout: 8000 });
    const calls = api.getFullReport.mock.calls.length;
    first.unmount();

    render(<TeacherStudentsScreen user={coach} onOpen={vi.fn()} />);
    await screen.findByText("Bora Örnek", {}, { timeout: 8000 });
    expect(within(rowOf("Bora Örnek")).getByText("Müdahale")).toBeInTheDocument();
    // Yalnızca önbelleğe girmeyen (hata veren) öğrenci yeniden denenir.
    await waitFor(() => expect(api.getFullReport.mock.calls.length).toBe(calls + 1), { timeout: 8000 });
    expect(api.getFullReport.mock.calls.at(-1)[0]).toBe("s-dila");
  });

  it("satıra dokununca öğrenci açılır (çip satırın parçası)", async () => {
    const onOpen = vi.fn();
    render(<TeacherStudentsScreen user={coach} onOpen={onOpen} />);
    await within(await screen.findByRole("button", { name: /Bora Örnek/ })).findByText("Müdahale", {}, { timeout: 8000 });
    fireEvent.click(rowOf("Bora Örnek"));
    expect(onOpen).toHaveBeenCalledWith("s-bora", "Bora Örnek");
  });
});
