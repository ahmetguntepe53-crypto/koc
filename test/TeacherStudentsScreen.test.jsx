import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import { makeFixture, FIXTURE_NOW } from "./fixtures/reportFixture.js";
import { buildReport } from "../src/reportModel.js";

// Öğrencilerim (koç). api sahte, rapor modeli GERÇEK: kartın gerekçe çipi, aynı yanıttan raporun koç panelinin
// gösterdiği ilk gerekçeyle birebir aynı olmalı. Durum etiketi (Müdahale / Takip et / Yolunda) listede gösterilmez.
// Tüm isimler ve veriler kurgusal.
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
// Sıra: önce gecikmesi olanlar (çoktan aza) → Ece, Ada, Bora, Cem; sonra Dila.
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
  api.getFullReport.mockClear();
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

describe("TeacherStudentsScreen", { timeout: 30000 }, () => {
  it("liste gerekçeleri beklemeden çizilir; istekler listedeki sırayla, en fazla 2'şer", async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    releaseGate = release;
    api.getFullReport.mockImplementation(async (id) => { await gate; return RAWS[id] || Promise.reject(new Error("yok")); });
    render(<TeacherStudentsScreen user={coach} onOpen={vi.fn()} />);
    await screen.findByText("Ada Kurgu", {}, { timeout: 8000 });
    for (const n of ["Bora Örnek", "Cem Deneme", "Dila Taslak", "Ece Model"]) expect(screen.getByText(n)).toBeInTheDocument();
    await waitFor(() => expect(api.getFullReport).toHaveBeenCalledTimes(2), { timeout: 8000 });
    expect(api.getFullReport.mock.calls.map((c) => c[0])).toEqual(["s-ece", "s-ada"]);
    release();
    const reason = expected("s-bora").reasons[0];
    await waitFor(() => expect(rowOf("Bora Örnek").textContent).toContain(reason), { timeout: 8000 });
  });

  it("gerekçe çipi raporun koç panelindeki ilk gerekçe; durum etiketi hiç yok", async () => {
    render(<TeacherStudentsScreen user={coach} onOpen={vi.fn()} />);
    await screen.findByText("Ada Kurgu", {}, { timeout: 8000 });
    await waitFor(() => expect(api.getFullReport).toHaveBeenCalledTimes(5), { timeout: 8000 });
    await waitFor(() => {
      for (const [id, name] of [["s-ada", "Ada Kurgu"], ["s-bora", "Bora Örnek"], ["s-cem", "Cem Deneme"], ["s-ece", "Ece Model"]]) {
        const r = expected(id).reasons[0];
        if (r) expect(rowOf(name).textContent).toContain(r);
      }
    }, { timeout: 8000 });
    for (const label of ["Müdahale", "Takip et", "Yolunda", "Önce müdahale"]) expect(screen.queryByText(label)).toBeNull();
    expect(screen.queryByText(/müdahale ·/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/zayıf|kötü|başarısız|tembel|hile/i);
  });

  it("sıra: önce gecikmesi olanlar, sonra 'benim ödevim' oranı düşük olanlar", async () => {
    api.teacherListStudents.mockResolvedValue({ students: [
      row("s-ada", "Ada Kurgu", { mine: { done: 2, total: 2 } }),
      row("s-bora", "Bora Örnek", { mine: { done: 0, total: 2 } }),
      row("s-cem", "Cem Deneme", { overdueCount: 1, mine: { done: 3, total: 3 } }),
      row("s-dila", "Dila Taslak", { mine: { done: 1, total: 2 } }),
      row("s-ece", "Ece Model"),
    ] });
    render(<TeacherStudentsScreen user={coach} onOpen={vi.fn()} />);
    await screen.findByText("Ada Kurgu", {}, { timeout: 8000 });
    expect(order()).toEqual(["Cem", "Bora", "Dila", "Ada", "Ece"]);
  });

  it("geri dönünce önbellekteki gerekçeler ilk çizimde hazır, yeni istek yok", async () => {
    const first = render(<TeacherStudentsScreen user={coach} onOpen={vi.fn()} />);
    await screen.findByText("Ada Kurgu", {}, { timeout: 8000 });
    await waitFor(() => expect(api.getFullReport).toHaveBeenCalledTimes(5), { timeout: 8000 });
    const reason = expected("s-bora").reasons[0];
    await waitFor(() => expect(rowOf("Bora Örnek").textContent).toContain(reason), { timeout: 8000 });
    const calls = api.getFullReport.mock.calls.length;
    first.unmount();

    render(<TeacherStudentsScreen user={coach} onOpen={vi.fn()} />);
    await screen.findByText("Bora Örnek", {}, { timeout: 8000 });
    expect(rowOf("Bora Örnek").textContent).toContain(reason);
    // Yalnızca önbelleğe girmeyen (hata veren) öğrenci yeniden denenir.
    await waitFor(() => expect(api.getFullReport.mock.calls.length).toBe(calls + 1), { timeout: 8000 });
    expect(api.getFullReport.mock.calls.at(-1)[0]).toBe("s-dila");
  });

  it("karta dokununca öğrenci açılır", async () => {
    const onOpen = vi.fn();
    render(<TeacherStudentsScreen user={coach} onOpen={onOpen} />);
    await screen.findByText("Bora Örnek", {}, { timeout: 8000 });
    fireEvent.click(rowOf("Bora Örnek"));
    expect(onOpen).toHaveBeenCalledWith("s-bora", "Bora Örnek");
  });
});
