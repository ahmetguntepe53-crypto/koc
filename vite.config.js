import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    open: true,
    // host olmadan Vite yalnızca localhost'ta dinler — telefondan/başka bir cihazdan test edilecekse
    // (Faz 6, Capacitor) buraya ihtiyaç var; şimdiden PP'deki aynı desenle bırakıldı.
    host: true,
  },
});
