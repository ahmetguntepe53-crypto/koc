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

  it("api.me() başarısız olursa token temizlenir", async () => {
    mockTokenStore = "gecersiz-token";
    api.me.mockRejectedValueOnce(new Error("Yetkisiz"));
    const params = makeParams();
    renderHook(() => useAuthSession(params));
    await waitFor(() => expect(params.setAuthChecked).toHaveBeenCalledWith(true));
    expect(getToken()).toBe(null);
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
