// Golden (görsel regresyon) testlerinin ortak altyapısı.
//
// NASIL ÇALIŞIR
//  • Uygulamanın kendisi (golden derlemesi, bkz. vite.golden.config.js) telefon boyutunda açılır; tüm /api istekleri burada yakalanır.
//  • KAYIT (GOLDEN_RECORD=1, `npm run golden:record`): istekler golden API'sine (gerçek sunucu kodu + uydurma verili ayrı DB)
//    gider, yanıtlar recordings/<persona>.json'a yazılır.
//  • OYNATMA (varsayılan): sunucu yok; yanıtlar kayıtlardan verilir. Tarayıcı saati kayıt anına (meta.now) sabitlenir, fontlar
//    yereldir, dış ağ kapalıdır → her çalıştırma birebir aynı pikselleri üretir.
//  • Her sahne iki görüntü: telefonda ilk görünen ekran (alt menüyle) ve sayfanın tamamı (sabit alt menü gizli — tam sayfa
//    görüntüde ekranın ortasına düşüyordu).
//  • Kayıtta olmayan bir istek, sayfa hatası ya da "Bir şeyler ters gitti" ekranı testi kırar.
import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REC_DIR = path.join(here, "recordings");
const FONT_DIR = path.join(here, "assets", "fonts");
export const RECORD = !!process.env.GOLDEN_RECORD;
// Erişilebilirlik modu (`npm run a11y`): ekran görüntüsü YERİNE axe denetimi; a11y-baseline.json'daki sayıların ÜSTÜNE çıkan
// (yeni) ihlalde kırılır. `npm run a11y:update` temel çizgiyi yeniden yazar (yalnızca düzeltmeden sonra, aşağı yönlü kullanın).
const A11Y = !!process.env.GOLDEN_A11Y;
const A11Y_UPDATE = !!process.env.A11Y_UPDATE;
const A11Y_BASELINE = path.join(here, "a11y-baseline.json");
export const meta = JSON.parse(fs.readFileSync(path.join(REC_DIR, "meta.json"), "utf8"));

const tokenFor = (persona) => {
  if (!persona) return null;
  if (!RECORD) return `golden-${persona}`; // oynatmada sunucu yok; token yalnızca "oturum açık" durumunu başlatır
  return JSON.parse(fs.readFileSync(path.join(REC_DIR, ".tokens.json"), "utf8"))[persona];
};

// ---- kayıtlar ----------------------------------------------------------------------------------------------------------
const recFile = (persona) => path.join(REC_DIR, `${persona}.json`);
const loadRec = (persona) => {
  try { return JSON.parse(fs.readFileSync(recFile(persona), "utf8")); } catch { return {}; }
};
function saveRec(persona, entries) {
  const merged = { ...loadRec(persona), ...entries };
  const sorted = Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
  fs.writeFileSync(recFile(persona), JSON.stringify(sorted, null, 1));
}
const keyOf = (method, url) => { const u = new URL(url); return `${method} ${u.pathname}${u.search}`; };

// ---- yerel fontlar (record.mjs indirir) ---------------------------------------------------------------------------------
const fontCssPath = path.join(FONT_DIR, "google.css");
const fontFileFor = (url) => path.join(FONT_DIR, new URL(url).pathname.replace(/^\//, "").replace(/\//g, "_"));

async function setupPage(page, persona, theme, ctx) {
  ctx.persona = persona || "anon";
  const recorded = loadRec(ctx.persona);
  await page.clock.setFixedTime(new Date(meta.now));
  await page.addInitScript(({ token, theme }) => {
    try {
      localStorage.clear();
      if (token) localStorage.setItem("kocluk:token", token);
      localStorage.setItem("kocluk-theme", theme);
    } catch { /* yok say */ }
  }, { token: tokenFor(persona), theme });

  page.on("pageerror", (e) => ctx.errors.push(e.message));
  // Varsayılan: dış ağ KAPALI (fontlar yerelden).
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort("blockedbyclient"));
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: fs.readFileSync(fontCssPath, "utf8") }));
  await page.route("https://fonts.gstatic.com/**", (r) => r.fulfill({ contentType: "font/woff2", body: fs.readFileSync(fontFileFor(r.request().url())) }));
  await page.route("**/api/**", async (r) => {
    ctx.net.inflight += 1;
    ctx.net.last = Date.now();
    try {
      const req = r.request();
      const key = keyOf(req.method(), req.url());
      if (RECORD) {
        const resp = await r.fetch();
        const body = await resp.text();
        ctx.fresh[key] = { status: resp.status(), body };
        await r.fulfill({ response: resp, body });
        return;
      }
      const rec = recorded[key];
      if (!rec) {
        ctx.misses.add(key);
        await r.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "golden kaydında yok" }) });
        return;
      }
      await r.fulfill({ status: rec.status, contentType: "application/json", body: rec.body });
    } finally {
      ctx.net.inflight -= 1;
      ctx.net.last = Date.now();
    }
  });
}

// Ağ sustu + fontlar yüklendi + iskelet kartlar kalktı → görüntü alınabilir.
async function settle(page, ctx) {
  for (let i = 0; i < 100; i++) {
    const quiet = ctx.net.inflight === 0 && Date.now() - ctx.net.last > 350;
    const skeletons = await page.locator(".k-skeleton").count();
    if (quiet && skeletons === 0) break;
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}

function checkA11y(results, scene) {
  let baseline = {};
  try { baseline = JSON.parse(fs.readFileSync(A11Y_BASELINE, "utf8")); } catch { /* ilk çalıştırma */ }
  const counts = Object.fromEntries(results.violations.map((v) => [v.id, v.nodes.length]));
  if (A11Y_UPDATE) {
    if (Object.keys(counts).length) baseline[scene] = counts;
    else delete baseline[scene];
    const sorted = Object.fromEntries(Object.keys(baseline).sort().map((k) => [k, baseline[k]]));
    fs.writeFileSync(A11Y_BASELINE, JSON.stringify(sorted, null, 1) + "\n");
    return;
  }
  const allowed = baseline[scene] || {};
  const regressions = results.violations
    .filter((v) => v.nodes.length > (allowed[v.id] || 0))
    .map((v) => `${v.id} ×${v.nodes.length} (temel çizgi ${allowed[v.id] || 0}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(regressions, `${scene}: yeni erişilebilirlik ihlali`).toEqual([]);
}

async function snap(page, name, ctx, testInfo) {
  await settle(page, ctx);
  const crashed = await page.getByText("Bir şeyler ters gitti").count();
  expect(crashed, `${name}: ekran çöktü (ErrorBoundary)`).toBe(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name}: yatay taşma`).toBeLessThanOrEqual(1);
  if (A11Y) {
    // meta-viewport: user-scalable=no bilinçli (native kabuk) — denetim dışı.
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).disableRules(["meta-viewport"]).analyze();
    checkA11y(results, `${path.basename(testInfo.file, ".spec.js")}/${name}`);
    return;
  }
  await expect(page).toHaveScreenshot(`${name}.png`);
  await expect(page).toHaveScreenshot(`${name}-tam.png`, { fullPage: true, style: ".k-bottom-nav{visibility:hidden!important}.k-sticky-action{position:static!important}" });
}

export const test = base.extend({
  golden: async ({ page }, use, testInfo) => {
    const ctx = { persona: null, fresh: {}, misses: new Set(), errors: [], net: { inflight: 0, last: Date.now() } };
    await use({
      open: async (persona, { theme = "dark" } = {}) => {
        await setupPage(page, persona, theme, ctx);
        await page.goto("/");
        await settle(page, ctx);
      },
      snap: (name) => snap(page, name, ctx, testInfo),
      settle: () => settle(page, ctx),
      // Alt menüden sekme (telefon düzeni) — yazı etiketiyle.
      tab: async (label) => {
        await page.locator("nav.k-bottom-nav button", { hasText: label }).first().click();
        await settle(page, ctx);
      },
    });
    if (RECORD && ctx.persona) saveRec(ctx.persona, ctx.fresh);
    if (!RECORD && ctx.misses.size) throw new Error(`Golden kaydında olmayan istekler (npm run golden:record gerekebilir):\n${[...ctx.misses].join("\n")}`);
    if (ctx.errors.length) throw new Error(`Sayfa hataları:\n${ctx.errors.join("\n")}`);
  },
});

export { expect };
