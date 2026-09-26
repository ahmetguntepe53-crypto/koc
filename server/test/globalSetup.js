// Tüm test çalıştırmasından ÖNCE bir kez (ana süreçte) çalışır: test veritabanını sıfırdan kurar.
//  1. kocluk_test'i (ya da DATABASE_URL_TEST'teki adı) bağlantıları koparıp siler ve yeniden oluşturur
//     (dropdb --if-exists --force + createdb'nin SQL karşılığı — CLI araçlarına ve parolasız bağlantıya bağımlı olmasın,
//     CI'daki parolalı servis adresiyle de aynen çalışsın diye Prisma üzerinden),
//  2. `prisma migrate deploy` ile depodaki TÜM migration'ları uygular — şema, canlıya giden migration'larla birebir aynı
//     olur,
//  3. uygulanan şemayı schema.prisma ile karşılaştırır (`prisma migrate diff --exit-code`): migration'ı yazılmamış bir
//     şema değişikliği CI'da testleri durdurur; yerelde (başkasının yarım kalmış değişikliği olabilir) yalnız uyarır.
// Veritabanı çalıştırma bitince SİLİNMEZ: başarısız bir testten sonra psql ile içine bakılabilsin.
//
// Aynı makinede iki `npm test` aynı anda başlarsa (ör. iki geliştirici/ajan) ikincisi birincinin veritabanını
// çalıştırmanın ortasında silerdi. Bu yüzden bakım veritabanında (postgres) bir advisory lock tutulur: ikinci çalıştırma
// birincinin bitmesini bekler. Kilit bağlantıya bağlıdır — süreç çökerse Postgres kilidi kendiliğinden bırakır.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl, testDatabaseName } from "./env.js";

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_BIN = path.join(SERVER_DIR, "node_modules", ".bin", "prisma");
const LOCK_WAIT_MS = 10 * 60 * 1000;

function runPrisma(args, url) {
  return execFileSync(PRISMA_BIN, args, { cwd: SERVER_DIR, env: { ...process.env, DATABASE_URL: url }, stdio: "pipe", encoding: "utf8" });
}

function maintenanceUrl(url) {
  const u = new URL(url);
  u.pathname = "/postgres";
  u.searchParams.delete("schema");
  // Tek bağlantı: advisory lock oturuma bağlı, DROP/CREATE de aynı oturumdan gitmeli.
  u.searchParams.set("connection_limit", "1");
  return u.toString();
}

export default async function setup() {
  const url = testDatabaseUrl();
  const name = testDatabaseName(url);
  const admin = new PrismaClient({ datasourceUrl: maintenanceUrl(url) });
  let keepAlive = null;
  try {
    const started = Date.now();
    let announced = false;
    for (;;) {
      let ok;
      try {
        [{ ok }] = await admin.$queryRaw`SELECT pg_try_advisory_lock(hashtext(${`kocluk-test:${name}`})) AS ok`;
      } catch (e) {
        throw new Error(`Test Postgres'ine bağlanılamadı (${new URL(url).host}) — Postgres çalışıyor mu, DATABASE_URL_TEST doğru mu? ${e.message}`);
      }
      if (ok) break;
      if (Date.now() - started > LOCK_WAIT_MS) throw new Error(`"${name}" veritabanını kullanan başka bir test çalıştırması 10 dakikadır bitmedi.`);
      if (!announced) {
        console.log(`[test] "${name}" veritabanını başka bir test çalıştırması kullanıyor — bitmesi bekleniyor…`);
        announced = true;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    // Kilidi tutan bağlantı boşta kalıp havuzdan düşmesin.
    keepAlive = setInterval(() => admin.$queryRaw`SELECT 1`.catch(() => {}), 20 * 1000);
    keepAlive.unref();

    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);

    try {
      runPrisma(["migrate", "deploy"], url);
    } catch (e) {
      throw new Error(`prisma migrate deploy başarısız:\n${e.stdout || ""}${e.stderr || ""}`);
    }
    try {
      runPrisma(["migrate", "diff", "--from-url", url, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"], url);
    } catch (e) {
      // --exit-code: 2 = fark var, 1 = komut hatası.
      const detail = `${e.stdout || ""}${e.stderr || ""}`.trim();
      const message = e.status === 2
        ? `schema.prisma ile migration'lar uyuşmuyor — eksik migration var (prisma/migrations/<zaman>_<ad>/migration.sql):\n${detail}`
        : `prisma migrate diff çalışmadı:\n${detail}`;
      if (process.env.CI) throw new Error(message);
      console.warn(`[test] UYARI: ${message}`);
    }
  } catch (e) {
    clearInterval(keepAlive);
    await admin.$disconnect().catch(() => {});
    throw e;
  }

  return async function teardown() {
    clearInterval(keepAlive);
    await admin.$queryRaw`SELECT pg_advisory_unlock(hashtext(${`kocluk-test:${name}`}))`.catch(() => {});
    await admin.$disconnect();
  };
}
