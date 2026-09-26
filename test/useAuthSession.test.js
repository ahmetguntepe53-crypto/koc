import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuthSession } from "../src/hooks/useAuthSession.js";

let mockTokenStore = null;
vi.mock("../src/api.js", async () => {
  const actual = await vi.importActual("../src/api.js");
  return {
    ...actual,
    getToken: () => mockTokenStore,
    setToken: (t) => { mockTokenStore = t; },
    api: { ...actual.api, me: vi.fn(), login: vi.fn() },
  };
});
import { api, getToken } from "../src/api.js";

function makeParams(overrides = {}) {
  return { setAuthUser: vi.fn(), setAuthChecked: vi.fn(), setScreen: vi.fn(), ...overrides };
}

describe("useAuthSession — mount-time /auth/me kontrolü", () => {
  beforeEach(() => { mockTokenStore = null; api.me.mockReset(); api.login.mockReset(); });

  it("token yoksa api.me() hiç çağrılmaz, authChecked yine de true olur", async () => {
    const params = makeParams();
    renderHook(() => useAuthSession(params));
    await waitFor(() => expect(params.setAuthChecked).toHaveBeenCalledWith(true));
    expect(api.me).not.toHaveBeenCalled();
  });

  it("token varsa api.me() çağrılır, başarılı yanıt authUser'ı günceller", async () => {
    mockTokenStore = "gecerli-token";
    api.me.mockResolvedValueOnce({ user: { id: "u1", name: "Ahmet", role: "TEACHER" } });
    const params = makeParams();
    renderHook(() => useAuthSession(params));
    await waitFor(() => expect(params.setAuthUser).toHaveBeenCalledWith({ id: "u1", name: "Ahmet", role: "TEACHER" }));
    expect(params.setAuthChecked).toHaveBeenCalledWith(true);
  });

  it("sunucu oturumu reddederse (401) token temizlenir", async () => {
    mockTokenStore = "gecersiz-token";
    api.me.mockRejectedValueOnce(Object.assign(new Error("Yetkisiz"), { status: 401, code: "SESSION_INVALID" }));
    const params = makeParams();
    renderHook(() => useAuthSession(params));
    await waitFor(() => expect(params.setAuthChecked).toHaveBeenCalledWith(true));
    expect(getToken()).toBe(null);
  });

  it("askıya alınmış hesapta (BANNED) token temizlenir", async () => {
    mockTokenStore = "banli-token";
    api.me.mockRejectedValueOnce(Object.assign(new Error("Askıda"), { status: 403, code: "BANNED" }));
    const params = makeParams();
    renderHook(() => useAuthSession(params));
    await waitFor(() => expect(params.setAuthChecked).toHaveBeenCalledWith(true));
    expect(getToken()).toBe(null);
  });

  it("ağ hatasında token KORUNUR ve authError set edilir (kullanıcı çıkış yapmış olmaz)", async () => {
    mockTokenStore = "gecerli-token";
    api.me.mockRejectedValueOnce(Object.assign(new Error("Failed to fetch"), { network: true }));
    const params = makeParams({ setAuthError: vi.fn() });
    renderHook(() => useAuthSession(params));
    await waitFor(() => expect(params.setAuthChecked).toHaveBeenCalledWith(true));
    expect(getToken()).toBe("gecerli-token");
    expect(params.setAuthError).toHaveBeenCalledWith(expect.stringContaining("bağlan"));
    expect(params.setAuthUser).not.toHaveBeenCalled();
  });

  it("sunucu hatasında (500/502) token KORUNUR", async () => {
    mockTokenStore = "gecerli-token";
    api.me.mockRejectedValueOnce(Object.assign(new Error("Sunucu hatası"), { status: 502 }));
    const params = makeParams({ setAuthError: vi.fn() });
    renderHook(() => useAuthSession(params));
    await waitFor(() => expect(params.setAuthChecked).toHaveBeenCalledWith(true));
    expect(getToken()).toBe("gecerli-token");
    expect(params.setAuthError).toHaveBeenCalled();
  });

  it("retrySession tekrar denediğinde başarılı yanıt oturumu açar", async () => {
    mockTokenStore = "gecerli-token";
    api.me
      .mockRejectedValueOnce(Object.assign(new Error("Failed to fetch"), { network: true }))
      .mockResolvedValueOnce({ user: { id: "u9", name: "Can", role: "STUDENT" } });
    const params = makeParams({ setAuthError: vi.fn() });
    const { result } = renderHook(() => useAuthSession(params));
    await waitFor(() => expect(params.setAuthChecked).toHaveBeenCalledWith(true));
    await act(async () => { await result.current.retrySession(); });
    expect(params.setAuthUser).toHaveBeenCalledWith({ id: "u9", name: "Can", role: "STUDENT" });
    expect(params.setAuthError).toHaveBeenLastCalledWith("");
  });
});

describe("useAuthSession — login", () => {
  beforeEach(() => { mockTokenStore = null; api.login.mockReset(); });

  it("başarılı girişte token kaydedilir ve authUser set edilir", async () => {
    api.login.mockResolvedValueOnce({ token: "tkn123", user: { id: "u2", name: "Ayşe", role: "STUDENT" } });
    const params = makeParams();
    const { result } = renderHook(() => useAuthSession(params));
    await act(async () => {
      await result.current.login("ayse@ornek.com", "sifre1234");
    });
    expect(getToken()).toBe("tkn123");
    expect(params.setAuthUser).toHaveBeenCalledWith({ id: "u2", name: "Ayşe", role: "STUDENT" });
  });
});
