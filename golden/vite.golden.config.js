// Golden derlemesi: uygulamanın kendisi, API adresi aynı köken (/api). Kayıt modunda önizleme sunucusu /api'yi
// yerel golden API'sine iletir; oynatmada istekler Playwright'ta kayıtlardan yanıtlanır (bkz. support.js).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API_PORT, PREVIEW_PORT } from "./env.mjs";
import { nativeAliases } from "../vite.config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.VITE_API_URL = "/api";

export default defineConfig({
  root,
  envDir: root,
  plugins: [react()],
  // Uygulamanın kendi derlemesiyle aynı takma adlar ve hedef (bkz. ../vite.config.js).
  resolve: { alias: nativeAliases },
  build: { outDir: path.join(root, "golden/.dist"), emptyOutDir: true, chunkSizeWarningLimit: 4000, target: "safari15" },
  preview: {
    port: PREVIEW_PORT, strictPort: true, host: "127.0.0.1",
    proxy: Object.fromEntries(["/api", "/uploads"].map((p) => [p, {
      target: `http://127.0.0.1:${API_PORT}`,
      configure: (proxy) => proxy.on("proxyReq", (req) => req.removeHeader("origin")),
    }])),
  },
  logLevel: "warn",
});
