// `npm run golden:record` — golden verisini SIFIRDAN üretir:
//   1) `kocluk_golden` veritabanını silip yeniden kurar (geliştirme DB'sine DOKUNMAZ) ve migrasyonları uygular,
//   2) uydurma, deterministik veriyi tohumlar (seed.mjs → recordings/meta.json),
//   3) fontlar yoksa bir kez indirir (assets/fonts — sonraki çalıştırmalar ağsız),
//   4) gerçek sunucu kodunu bu DB ile 4299'da ZAMANLAYICISIZ başlatır (server.mjs), personalar için oturum açar,
//   5) Playwright'ı KAYIT modunda çalıştırır: API yanıtları recordings/*.json'a yazılır, altın görüntüler yenilenir,
//   6) sunucuyu kapatır.
// Sonrasında testler sunucusuz oynatılır (`npm run golden`).
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serverEnv, API_PORT } from "./env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const serverDir = path.join(root, "server");
const REC_DIR = path.join(here, "recordings");
const FONT_DIR = path.join(here, "assets", "fonts");
const DB = "kocluk_golden";
const env = serverEnv(DB);
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", env, ...opts });

// index.html'deki Google Fonts adresi — değişirse fontlar yeniden indirilir.
const FONT_CSS_URL = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap";
async function ensureFonts() {
  const marker = path.join(FONT_DIR, "source.txt");
  if (fs.existsSync(marker) && fs.readFileSync(marker, "utf8").trim() === FONT_CSS_URL) return;
  console.log("[golden] fontlar indiriliyor…");
  fs.mkdirSync(FONT_DIR, { recursive: true });
  const css = await (await fetch(FONT_CSS_URL, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" } })).text();
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]))];
  for (const u of urls) {
    const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
    fs.writeFileSync(path.join(FONT_DIR, new URL(u).pathname.replace(/^\//, "").replace(/\//g, "_")), buf);
  }
  fs.writeFileSync(path.join(FONT_DIR, "google.css"), css);
  fs.writeFileSync(marker, FONT_CSS_URL + "\n");
  console.log(`[golden] ${urls.length} font dosyası`);
}

console.log(`[golden] ${DB} yeniden kuruluyor…`);
run("dropdb", ["--if-exists", "--force", DB]);
run("createdb", ["-O", env.DB_OWNER, DB]);
run("npx", ["prisma", "migrate", "deploy"], { cwd: serverDir });
run("node", [path.join(here, "seed.mjs")], { cwd: serverDir });
for (const f of fs.readdirSync(REC_DIR)) {
  if (f.endsWith(".json") && f !== "meta.json") fs.unlinkSync(path.join(REC_DIR, f));
}
await ensureFonts();

console.log("[golden] API başlatılıyor…");
const api = spawn("node", [path.join(here, "server.mjs")], { cwd: serverDir, env, stdio: "inherit" });
const base = `http://127.0.0.1:${API_PORT}/api`;
let code = 1;
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* henüz açılmadı */ }
    if (i > 60) throw new Error("golden API açılmadı");
    await new Promise((r) => setTimeout(r, 500));
  }
  const meta = JSON.parse(fs.readFileSync(path.join(REC_DIR, "meta.json"), "utf8"));
  const tokens = {};
  for (const [persona, { username, password }] of Object.entries(meta.personas)) {
    const res = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: username, password }) });
    const data = await res.json();
    if (!data.token) throw new Error(`${persona} oturum açamadı: ${JSON.stringify(data)}`);
    tokens[persona] = data.token;
  }
  fs.writeFileSync(path.join(REC_DIR, ".tokens.json"), JSON.stringify(tokens));
  const args = ["playwright", "test", "-c", path.join(here, "playwright.config.js"), "--update-snapshots", ...process.argv.slice(2)];
  const pw = spawn("npx", args, { cwd: root, env: { ...process.env, GOLDEN_RECORD: "1" }, stdio: "inherit" });
  code = await new Promise((r) => pw.on("exit", r));
} finally {
  api.kill();
  fs.rmSync(path.join(REC_DIR, ".tokens.json"), { force: true });
}
process.exit(code);
