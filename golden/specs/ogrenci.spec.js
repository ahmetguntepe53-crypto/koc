// Öğrenci (Zeynep Kaya, 12-A, koçu Ayşe Yılmaz) — şartname Z1, Z2 ve diğer sekmeler.
import { test } from "../support.js";

test("Z1 bu hafta", async ({ golden }) => {
  await golden.open("ogrenci");
  await golden.snap("z1-bu-hafta");
});

test("Z1 bu hafta — açık tema", async ({ golden }) => {
  await golden.open("ogrenci", { theme: "light" });
  await golden.snap("z1-bu-hafta-acik");
});

test("Z2 sonuç girişi — açık ödev, girilmiş sonuç, pas sebebi", async ({ golden, page }) => {
  await golden.open("ogrenci");
  await page.getByText("Limit tekrarı").first().click();
  await golden.snap("z2-sonuc-girisi");
  await page.getByLabel("Doğru", { exact: true }).fill("20");
  await page.getByLabel("Yanlış", { exact: true }).fill("3");
  await page.getByLabel("Boş", { exact: true }).fill("2");
  await golden.snap("z2-dolu");
  await page.getByRole("button", { name: "Bu ödevi pas geç" }).click();
  await page.getByRole("button", { name: "Zaman yetmedi" }).click();
  await golden.snap("z2-pas-sebep");
});

test("Z2 sonucu girilmiş ödev", async ({ golden, page }) => {
  await golden.open("ogrenci");
  await page.getByText("Sözcükte Anlam tekrarı").first().click();
  await golden.snap("z2-cozulmus");
});

test("Çalışmam, Gelişim, Ben, Bildirimler", async ({ golden, page }) => {
  await golden.open("ogrenci");
  await golden.tab("Çalışmam");
  await golden.snap("calismam");
  await golden.tab("Gelişim");
  await golden.snap("gelisim");
  await golden.tab("Ben");
  await golden.snap("ben");
  await page.getByRole("button", { name: "Bildirimler" }).click();
  await golden.snap("bildirimler");
});

test("Gelişim raporu: ders dökümü ve PDF sayfası", async ({ golden, page }) => {
  await golden.open("ogrenci");
  await golden.tab("Gelişim");
  // "Ayın değerlendirmesi" kartı ilk çizimden sonra hesaplanır ve karnenin üstünde yer alır; tıklamadan önce
  // beklenmezse kaydırma konumu (dolayısıyla alttan açılan pencerenin tam sayfa görüntüdeki yeri) değişir.
  await page.getByText("Bu hafta yapabileceklerin").waitFor();
  await golden.settle();
  await page.locator("#rapor-karne").getByRole("button", { name: /Türkçe/ }).first().click();
  await golden.settle();
  await golden.snap("gelisim-ders");
  await page.getByRole("button", { name: "Kapat" }).click();
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  await golden.snap("gelisim-pdf");
});
