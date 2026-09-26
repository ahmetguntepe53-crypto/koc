// Test ortamının TEK kaynağı — hem vitest.config.js (işçi süreçlerine process.env olarak verir) hem globalSetup.js
// (veritabanını kurar) buradan okur; iki yerde ayrı ayrı yazılsaydı biri değişip diğeri eski adrese yazabilirdi.
import os from "node:os";

// DATABASE_URL_TEST verilmezse yerel Postgres'te işletim sistemi kullanıcısıyla (parolasız, Homebrew kurulumu gibi)
// kocluk_test. CI bunu servis konteynerinin adresiyle geçer (bkz. .github/workflows/ci.yml). DATABASE_URL bilerek
// KULLANILMAZ: geliştiricinin .env'indeki (ya da kabuğundaki) geliştirme/canlı veritabanı yanlışlıkla silinmesin.
export function testDatabaseUrl() {
  return process.env.DATABASE_URL_TEST || `postgresql://${os.userInfo().username}@localhost:5432/kocluk_test?schema=public`;
}

// globalSetup her çalıştırmada veritabanını SİLİP yeniden kurar — adında "test" geçmeyen bir veritabanına (ör. yanlış
// kopyalanmış bir canlı adresi) asla dokunulmaz. Ad yalnız harf/rakam/alt çizgi olmalı: SQL'e tırnak içinde gömülüyor.
export function testDatabaseName(url = testDatabaseUrl()) {
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  if (!/^[A-Za-z0-9_]+$/.test(name) || !/test/i.test(name)) {
    throw new Error(`Test veritabanı adı "${name}" güvenli değil — adında "test" geçmeli ve yalnız harf/rakam/_ içermeli (DATABASE_URL_TEST).`);
  }
  return name;
}

// İşçi süreçlerindeki ortam. Boş değerler bilerek "tanımlı ama boş": notify.js boş FIREBASE_SERVICE_ACCOUNT_PATH ile
// push'u kapatır, aiAnalysis.js boş ANTHROPIC_API_KEY ile "yapılandırılmamış" (503) davranır — geliştiricinin kabuğunda
// gerçek bir anahtar olsa bile testler ücretli çağrı yapmaz. Anahtar tanımlı olduğu için dotenv/Prisma'nın .env
// yüklemesi de (var olanı ezmez) server/.env'deki gerçek değerleri içeri alamaz.
// NODE_ENV=test: rateLimiters.js sınırları atlar (bir dosyada onlarca giriş yapılıyor).
export const TEST_ENV = {
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl(),
  JWT_SECRET: "test-jwt-secret-yalnizca-testler-icin",
  FIREBASE_SERVICE_ACCOUNT_PATH: "",
  ANTHROPIC_API_KEY: "",
  RESEND_API_KEY: "",
  MAIL_FROM: "test@okul.test",
  API_PUBLIC_URL: "http://localhost:4199",
};
