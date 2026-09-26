import { defineConfig } from "vitest/config";
import { TEST_ENV } from "./test/env.js";

// Sunucu uçtan uca testleri (bkz. test/README.md): gerçek Postgres'e karşı, src/app.js'teki Express uygulaması supertest
// ile çağrılır. index.js HİÇ yüklenmez — zamanlayıcıyı başlatır, dinlemeye geçer.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
    // Test veritabanını her çalıştırmada sıfırdan kurar (drop + create + prisma migrate deploy).
    globalSetup: ["./test/globalSetup.js"],
    setupFiles: ["./test/setup.js"],
    env: TEST_ENV,
    // Tüm dosyalar TEK veritabanını paylaşır ve her dosya başında onu boşaltır (resetDatabase) — paralel koşarlarsa
    // birbirinin verisini silerler. Sırayla koşmak yine de hızlı: tüm takım birkaç saniye.
    fileParallelism: false,
    // Bir dosyadaki testler sırayla ve birbirinin bıraktığı duruma dayanarak ilerleyebilir (senaryo testleri).
    sequence: { shuffle: false },
    // Rotaların handleErr'i her 4xx'i de console.error'a yazar; yetki/doğrulama testleri bunu bilerek tetikler. Günlükler
    // yalnız BAŞARISIZ testlerde gösterilir — hata ayıklarken kaybolmaz, geçen çalıştırmada gürültü yapmaz.
    silent: "passed-only",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
