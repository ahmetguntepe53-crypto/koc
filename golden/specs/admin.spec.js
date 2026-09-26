// Okul yönetimi — şartname Z6 (Kurulum) ve kanıt fotoğrafları.
import { test } from "../support.js";

test("Z6 kurulum sekmeleri", async ({ golden, page }) => {
  await golden.open("admin");
  await golden.snap("z6-koc-eslestirme");
  for (const [tab, name] of [["Hesaplar", "z6-hesaplar"], ["Branşlar", "z6-branslar"], ["Sistem", "z6-sistem"]]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await golden.settle();
    await golden.snap(name);
  }
});

test("Z6 koçun öğrencileri (koç yükünden)", async ({ golden, page }) => {
  await golden.open("admin");
  await page.getByText("Ayşe Yılmaz").first().click();
  await golden.settle();
  await golden.snap("z6-koc-ogrencileri");
});

test("Kanıt fotoğrafları", async ({ golden }) => {
  await golden.open("admin");
  await golden.tab("Fotoğraflar");
  await golden.snap("fotograflar");
});
