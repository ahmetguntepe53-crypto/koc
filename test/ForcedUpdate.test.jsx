import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Zorunlu güncelleme duvarı (App.jsx > checkForcedUpdate, UpdateRequiredScreen.jsx) — oturumdan TAMAMEN
// bağımsız olmalı: eski bir native sürüm, giriş ekranını hiç görmeden bu ekranda kalır.
vi.mock("../src/api.js", async () => {
  const actual = await vi.importActual("../src/api.js");
  return { ...actual, api: { ...actual.api, appVersion: vi.fn(), me: vi.fn() } };
});
const nativeBuild = vi.fn();
vi.mock("../src/native/index.js", () => ({
  get isNative() { return true; }, get platform() { return "android"; },
  nativeBuild: () => nativeBuild(),
  onBackButton: () => () => {}, exitApp: () => {}, setStatusBarTheme: async () => {},
  savePdfAndShare: async () => {}, hideSplash: () => {}, initNative: async () => {},
}));
vi.mock("../src/native/push.js", () => ({
  registerPush: vi.fn(async () => {}), unregisterPush: vi.fn(async () => {}), ensurePushRegistered: vi.fn(async () => {}), pushPermissionState: vi.fn(async () => "granted"),
}));
vi.mock("../src/native/badge.js", () => ({ setAppBadge: vi.fn(async () => {}) }));
import { api } from "../src/api.js";
import App from "../src/App.jsx";
import UpdateRequiredScreen, { APP_STORE_URL } from "../src/screens/UpdateRequiredScreen.jsx";

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {},
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("Zorunlu güncelleme", () => {
  // OLAY (2026-10-06): yer tutucu App Store kimliği iPhone'ları duvarda bıraktı — gerçek kimlik olmalı.
  it("iOS'ta gerçek App Store sayfasına gider (yer tutucu kimlik değil)", () => {
    render(<UpdateRequiredScreen platform="ios" onRetry={() => {}} />);
    const href = screen.getByRole("link", { name: "App Store'da aç" }).getAttribute("href");
    expect(href).toBe(APP_STORE_URL);
    expect(href).toContain("id6803681138");
    expect(href).not.toMatch(/id0{6,}/);
  });

  it("Android build sunucu eşiğinin altındaysa giriş ekranı YERİNE güncelleme duvarı gösterilir", async () => {
    nativeBuild.mockResolvedValue(13);
    api.appVersion.mockResolvedValue({ minAndroidBuild: 14, minIosBuild: null });
    render(<App />);
    expect(await screen.findByText("Güncelleme gerekli")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /giriş yap/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Play Store'da aç" })).toHaveAttribute("href", expect.stringContaining("com.kocluk.app"));
  });

  it("build eşiğe eşit ya da üstündeyse engellenmez", async () => {
    nativeBuild.mockResolvedValue(14);
    api.appVersion.mockResolvedValue({ minAndroidBuild: 14, minIosBuild: null });
    render(<App />);
    await screen.findByRole("button", { name: "Giriş Yap" });
    expect(screen.queryByText("Güncelleme gerekli")).toBeNull();
  });

  it("o platform için eşik ayarlanmamışsa (null) engellenmez", async () => {
    nativeBuild.mockResolvedValue(1);
    api.appVersion.mockResolvedValue({ minAndroidBuild: null, minIosBuild: 99 });
    render(<App />);
    await screen.findByRole("button", { name: "Giriş Yap" });
    expect(screen.queryByText("Güncelleme gerekli")).toBeNull();
  });

  it("sunucuya ulaşılamazsa engellenmez (yanlış pozitifle okulu kilitlemez)", async () => {
    nativeBuild.mockResolvedValue(1);
    api.appVersion.mockRejectedValue(new Error("ağ hatası"));
    render(<App />);
    await screen.findByRole("button", { name: "Giriş Yap" });
    expect(screen.queryByText("Güncelleme gerekli")).toBeNull();
  });

  it("'Güncelledim, tekrar dene' sunucudan yeniden okur; güncellenmişse duvar kalkar", async () => {
    nativeBuild.mockResolvedValue(13);
    api.appVersion.mockResolvedValue({ minAndroidBuild: 14, minIosBuild: null });
    render(<App />);
    await screen.findByText("Güncelleme gerekli");

    nativeBuild.mockResolvedValue(14); // kullanıcı güncelledi
    fireEvent.click(screen.getByRole("button", { name: /tekrar dene/i }));
    await screen.findByRole("button", { name: "Giriş Yap" });
    expect(screen.queryByText("Güncelleme gerekli")).toBeNull();
  });
});
