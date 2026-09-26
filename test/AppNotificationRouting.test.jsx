import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

// Push'a dokununca hedef ekran (App.jsx > goToNotificationTarget). Asıl risk: push dinleyicisi App'in authUser'ın
// geldiği render'ından yakalanır — oturum token'dan geri yüklenirken o render erken return'le biter (authChecked henüz
// false). Hedef fonksiyon return'ün ALTINDA tanımlı bir const'a dokunursa kapanışta o const hiç ilklenmemiştir
// (ReferenceError) ve dokunuş hiçbir şey yapmaz. Test tam bu yolu kurar: kayıtlı token → api.me → push-open olayı.
// Tüm adlar kurgusal.
vi.mock("../src/api.js", async () => {
  const actual = await vi.importActual("../src/api.js");
  return {
    ...actual,
    api: {
      ...actual.api,
      me: vi.fn(),
      listNotifications: vi.fn(async () => ({ notifications: [], unreadCount: 0 })),
      listStudySessions: vi.fn(async () => ({ sessions: [] })),
      getFullReport: vi.fn(),
    },
  };
});
vi.mock("../src/native/push.js", () => ({
  registerPush: vi.fn(async () => {}), unregisterPush: vi.fn(async () => {}), ensurePushRegistered: vi.fn(async () => {}), pushPermissionState: vi.fn(async () => "granted"),
}));
vi.mock("../src/native/badge.js", () => ({ setAppBadge: vi.fn(async () => {}) }));
vi.mock("../src/native/index.js", () => ({
  isNative: false, platform: "web", onBackButton: () => () => {}, exitApp: () => {}, setStatusBarTheme: async () => {},
  savePdfAndShare: async () => {}, hideSplash: () => {}, initNative: async () => {},
}));
// Öğrencinin ana ekranı bu testin konusu değil (kendi api çağrıları var).
vi.mock("../src/screens/student/StudentHomeScreen.jsx", () => ({ default: () => <div>Ana ekran</div> }));
import { api } from "../src/api.js";
import App from "../src/App.jsx";

const student = { id: "stu-1", role: "STUDENT", name: "Deniz Kurgu", gradeLevel: 12, mustChangePassword: false };

beforeEach(() => {
  const store = new Map([["kocluk:token", "kurgu-token"]]);
  vi.stubGlobal("localStorage", {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  });
  api.me.mockResolvedValue({ user: student });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("App — bildirime dokununca", () => {
  it("tekrar hatırlatması (push, JSON metni prefill): oturum geri yüklendikten sonra Çalışma Kaydı ders ve konu dolu açılır", async () => {
    render(<App />);
    await screen.findByText("Ana ekran");
    const prefill = JSON.stringify({ examType: "TYT", subject: "Matematik", topic: "Mutlak Değer" });
    act(() => { window.dispatchEvent(new CustomEvent("kocluk:push-open", { detail: { screen: "studyLog", prefill } })); });
    expect(await screen.findByDisplayValue(/Mutlak Değer/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Matematik")).toBeInTheDocument();
  });

  it("haftalık özet (screen: reports) öğrencinin Gelişim sekmesine gider", async () => {
    api.getFullReport.mockImplementation(() => new Promise(() => {})); // rapor yüklenirken kalsın — yalnızca ekran geçişi sınanıyor
    render(<App />);
    await screen.findByText("Ana ekran");
    act(() => { window.dispatchEvent(new CustomEvent("kocluk:push-open", { detail: { screen: "reports", week: "2026-W39" } })); });
    expect(await screen.findByRole("heading", { name: /Gelişim/ }, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.queryByText("Ana ekran")).toBeNull();
  });
});
