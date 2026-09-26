// Oturum açılmadan görülen ekranlar + ilk giriş (şartname Z7).
import { test } from "../support.js";

test("giriş ekranı", async ({ golden }) => {
  await golden.open(null);
  await golden.snap("giris");
});

test("Z7 ilk giriş — boş ve kurallar sağlanmış", async ({ golden, page }) => {
  await golden.open("ilk");
  await golden.snap("z7-ilk-giris");
  await page.getByLabel("Yeni şifre", { exact: true }).fill("deneme123");
  await page.getByLabel("Yeni şifre tekrar").fill("deneme123");
  await page.getByRole("checkbox").check();
  await golden.snap("z7-kurallar-tamam");
});
