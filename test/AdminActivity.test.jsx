import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("../src/api.js", async () => {
  const actual = await vi.importActual("../src/api.js");
  return { ...actual, api: { ...actual.api, adminActivity: vi.fn() } };
});
import { api } from "../src/api.js";
import AdminActivity from "../src/screens/admin/AdminActivity.jsx";

afterEach(cleanup);

// Sunucu yanıtı biçiminde kurgusal veri (bkz. server/src/routes/adminActivity.js) — burada da öğrenci/öğretmen
// adı yok, yalnızca toplu sayılar.
function fixture(days = 14) {
  const daily = Array.from({ length: days }, (_, i) => ({
    day: new Date(Date.UTC(2026, 8, 15 + i)).toISOString(),
    students: i === days - 1 ? 30 : 5,
    teachers: i === days - 1 ? 8 : 2,
  }));
  return {
    days, inactiveDays: 7,
    today: { day: daily[daily.length - 1].day, students: 30, teachers: 8 },
    daily,
    totals: { students: 40, teachers: 10 },
    activeThisWeek: { students: 35, teachers: 9 },
    inactive: { students: 3, teachers: 1 },
  };
}

describe("AdminActivity", () => {
  it("bugünkü ve haftalık sayıları, girmeyenleri gösterir", async () => {
    api.adminActivity.mockResolvedValue(fixture());
    render(<AdminActivity />);
    expect(await screen.findByText("30/40")).toBeInTheDocument();
    expect(screen.getByText("8/10")).toBeInTheDocument();
    expect(screen.getByText("35/40")).toBeInTheDocument();
    expect(screen.getByText("9/10")).toBeInTheDocument();
    // "hiç girmedi" sayıları — burada tek tek öğrenci/öğretmen adı hiç geçmez.
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/@|\bogr\d/i);
    expect(api.adminActivity).toHaveBeenCalledWith(14);
  });

  it("pencere değişince yeniden yüklenir", async () => {
    api.adminActivity.mockResolvedValue(fixture(14));
    render(<AdminActivity />);
    await screen.findByText("30/40");
    api.adminActivity.mockResolvedValue(fixture(7));
    fireEvent.click(screen.getByRole("button", { name: "7 gün" }));
    await screen.findByText("7 gün", { selector: "span" });
    expect(api.adminActivity).toHaveBeenLastCalledWith(7);
  });

  it("hata olursa tekrar dene düğmesi çalışır", async () => {
    api.adminActivity.mockRejectedValueOnce(new Error("Sunucuya ulaşılamadı"));
    render(<AdminActivity />);
    await screen.findByText("Sunucuya ulaşılamadı");
    api.adminActivity.mockResolvedValue(fixture());
    fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    await screen.findByText("30/40");
  });
});
