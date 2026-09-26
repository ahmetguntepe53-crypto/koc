// Koç + Matematik branş öğretmeni (Ayşe Yılmaz, 6 öğrenci) — şartname Z3, Z4, Z5 ve diğer sekmeler.
import { test } from "../support.js";

test("Z3 öğrencilerim", async ({ golden }) => {
  await golden.open("koc");
  await golden.snap("z3-ogrencilerim");
});

test("Z3 öğrencilerim — açık tema", async ({ golden }) => {
  await golden.open("koc", { theme: "light" });
  await golden.snap("z3-ogrencilerim-acik");
});

test("Z4 öğrenci detayı — bugün, bu hafta, not", async ({ golden, page }) => {
  await golden.open("koc");
  await page.getByText("Zeynep Kaya").first().click();
  await golden.snap("z4-ogrenci-detay");
  await page.getByRole("button", { name: "Bu hafta", exact: true }).click();
  await golden.snap("z4-bu-hafta");
  await page.getByText("Matematik'te tıkanıyor", { exact: false }).first().click();
  await golden.snap("z4-not-duzenle");
});

test("Z4 başlıktaki Notlar bölüme kaydırır; alt çubuktan yeni not", async ({ golden, page }) => {
  await golden.open("koc");
  await page.getByText("Zeynep Kaya").first().click();
  await golden.settle();
  await page.getByRole("button", { name: "Notlar", exact: true }).click();
  await page.waitForTimeout(600); // yumuşak kaydırma
  await golden.snap("z4-notlar-bolumu");
  await page.getByRole("button", { name: "Not ekle", exact: true }).click();
  await golden.snap("z4-yeni-not");
});

test("Z5 branş ve yıllık plan", async ({ golden, page }) => {
  await golden.open("koc");
  await golden.tab("Branş");
  await golden.snap("z5-brans");
  await page.getByRole("button", { name: /takvimi aç/ }).click();
  await golden.settle();
  await golden.snap("takvim");
});

test("Ödev ata, ödevlerim, ödev detayı", async ({ golden, page }) => {
  await golden.open("koc");
  await golden.tab("Ata");
  await golden.snap("ata");
  await golden.tab("Ödevler");
  await golden.snap("odevler");
  await page.getByText("Limit tekrarı").first().click();
  await golden.settle();
  await golden.snap("odev-detay");
});

test("Öğrenci gelişim raporu (koç görünümü), ders dökümü, PDF", async ({ golden, page }) => {
  await golden.open("koc");
  await page.getByText("Zeynep Kaya").first().click();
  await golden.settle();
  await page.getByRole("button", { name: "Rapor", exact: true }).click();
  await golden.settle();
  await golden.snap("koc-rapor");
  await page.locator("#rapor-karne").getByRole("button", { name: /Matematik/ }).first().click();
  await golden.settle();
  await golden.snap("koc-rapor-ders");
  await page.getByRole("button", { name: "Kapat" }).click();
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await golden.snap("koc-rapor-pdf");
});

test("Aylık raporlar ve öğrencinin aylık raporu", async ({ golden, page }) => {
  await golden.open("koc");
  await page.getByRole("button", { name: "Aylık rapor", exact: true }).click();
  await golden.settle();
  await golden.snap("aylik-raporlar");
  await page.getByText("Zeynep Kaya").first().click();
  await golden.settle();
  await golden.snap("aylik-rapor-ogrenci");
});

test("Bildirimler: aylık rapor bildirimi aylık raporlara götürür", async ({ golden, page }) => {
  await golden.open("koc");
  await page.getByRole("button", { name: "Bildirimler" }).click();
  await golden.settle();
  await golden.snap("koc-bildirimler");
  await page.getByText("raporları hazır", { exact: false }).first().click();
  await golden.settle();
  await golden.snap("bildirim-aylik-raporlar");
});

test("Koç paneli: otomatik aylık değerlendirme", async ({ golden, page }) => {
  await golden.open("koc");
  await page.getByText("Zeynep Kaya").first().click();
  await golden.settle();
  await page.getByRole("button", { name: "Rapor", exact: true }).click();
  await golden.settle();
  await page.getByText("Aylık değerlendirme", { exact: true }).scrollIntoViewIfNeeded();
  await golden.snap("koc-aylik-degerlendirme");
});
