import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Avatar } from "../src/components/common.jsx";
import { AVATARS, avatarSrc } from "../src/avatars.js";

afterEach(cleanup);
describe("Avatar", () => {
  it("seçilmiş hazır avatar varsa resmi çizer, yoksa baş harfleri", () => {
    const { container, rerender } = render(<Avatar name="Ayşe Betül" avatar="baykus" />);
    expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("avatars/baykus.svg"));
    rerender(<Avatar name="Ayşe Betül" tint />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("AB");
  });
  it("bilinmeyen kimlik resme dönüşmez (yol enjeksiyonu yok)", () => {
    expect(avatarSrc("../../etc")).toBeNull();
    expect(AVATARS).toHaveLength(15);
  });
});
