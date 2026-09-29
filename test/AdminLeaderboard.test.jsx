import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("../src/api.js", async () => {
  const actual = await vi.importActual("../src/api.js");
  return { ...actual, api: { ...actual.api, adminLeaderboard: vi.fn() } };
});
import { api } from "../src/api.js";
import AdminLeaderboard from "../src/screens/admin/AdminLeaderboard.jsx";

afterEach(cleanup);

function fixture() {
  return {
    minQuestions: 30,
    students: [
      { id: "s1", name: "Kurgu Öğrenci Bir", gradeLevel: 12, className: "12-A", totalQuestions: 200, correct: 170, wrong: 20, blank: 10, netRate: 82.5, ranked: true },
      { id: "s2", name: "Kurgu Öğrenci İki", gradeLevel: 11, className: "11-B", totalQuestions: 80, correct: 40, wrong: 40, blank: 0, netRate: 37.5, ranked: true },
      { id: "s3", name: "Kurgu Öğrenci Üç", gradeLevel: 12, className: "12-B", totalQuestions: 5, correct: 5, wrong: 0, blank: 0, netRate: 100, ranked: false },
    ],
  };
}

describe("AdminLeaderboard", () => {
  it("sıralı listeyi ve eşik altındakileri ayrı gösterir; öğrenci adı görünür", async () => {
    api.adminLeaderboard.mockResolvedValue(fixture());
    render(<AdminLeaderboard />);
    await screen.findByText("Kurgu Öğrenci Bir");
    expect(screen.getByText("Kurgu Öğrenci İki")).toBeInTheDocument();
    expect(screen.getByText("%83")).toBeInTheDocument(); // 82.5 yuvarlanır
    expect(screen.getByText("YETERLİ VERİ YOK")).toBeInTheDocument();
    // Sıralı listedeki isim, eşik altı gruptan ÖNCE gelmeli (DOM sırası).
    const names = screen.getAllByText(/Kurgu Öğrenci/).map((n) => n.textContent);
    expect(names.indexOf("Kurgu Öğrenci Bir")).toBeLessThan(names.indexOf("Kurgu Öğrenci Üç"));
  });

  it("hata olursa tekrar dene çalışır", async () => {
    api.adminLeaderboard.mockRejectedValueOnce(new Error("Sunucuya ulaşılamadı"));
    render(<AdminLeaderboard />);
    await screen.findByText("Sunucuya ulaşılamadı");
    api.adminLeaderboard.mockResolvedValue(fixture());
    fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    await screen.findByText("Kurgu Öğrenci Bir");
  });
});
