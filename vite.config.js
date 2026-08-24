import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Gerekçesi src/native/firebase-messaging-web-stub.js'de — vitest.config.js de aynı alias'ı
// kullanabilsin diye dışa aktarılıyor.
export const nativeAliases = {
  "firebase/messaging": fileURLToPath(new URL("./src/native/firebase-messaging-web-stub.js", import.meta.url)),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias: nativeAliases },
  build: {
    // ios/App/Podfile > platform :ios, '15.0' ile aynı taban — Vite'ın varsayılan hedefi daha yeni
    // sözdizimi üretip eski iOS sürümlerinde BEYAZ EKRANA yol açabilir (WKWebView'da sözdizimi
    // hatası sessizce kalır, konsol görünmez).
    target: "safari15",
  },
  server: {
    port: 5183,
    open: true,
    // host olmadan Vite yalnızca localhost'ta dinler — telefondan/başka bir cihazdan test edilecekse
    // (Faz 6, Capacitor) buraya ihtiyaç var; şimdiden PP'deki aynı desenle bırakıldı.
    host: true,
  },
});
