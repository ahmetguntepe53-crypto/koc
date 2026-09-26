// Golden (görsel regresyon) testleri. Komutlar (kök dizinden):
//   npm run golden          → altınlarla karşılaştır (sunucu GEREKMEZ, kayıtlardan oynatır)
//   npm run golden:update   → kasıtlı tasarım değişikliğinden sonra altınları yenile
//   npm run golden:record   → veri şekli değiştiyse: golden DB'yi yeniden tohumla, yanıtları yeniden kaydet, altınları yenile
//   npm run a11y            → aynı sahnelerde erişilebilirlik (axe), a11y-baseline.json'a göre yalnızca YENİ ihlalde kırılır
import { defineConfig, devices } from "@playwright/test";
import { PREVIEW_PORT } from "./env.mjs";

const RECORD = !!process.env.GOLDEN_RECORD;

export default defineConfig({
  testDir: "./specs",
  snapshotPathTemplate: "{testDir}/../__screenshots__/{testFilePath}/{arg}{ext}",
  outputDir: "./.results",
  fullyParallel: !RECORD,
  workers: RECORD ? 1 : undefined,
  retries: RECORD ? 0 : 1,
  timeout: 60000,
  reporter: [["list"], ["html", { outputFolder: "./.report", open: "never" }]],
  expect: {
    // Neredeyse sıfır tolerans: kenar yumuşatma gürültüsü birkaç piksel; anlamlı her değişiklik yakalanır.
    toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css", threshold: 0.05, maxDiffPixels: 10 },
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${PREVIEW_PORT}`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: false,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    colorScheme: "dark",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite build --config golden/vite.golden.config.js && npx vite preview --config golden/vite.golden.config.js",
    cwd: "..",
    url: `http://127.0.0.1:${PREVIEW_PORT}`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
