import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { nativeAliases } from "./vite.config.js";

export default defineConfig({
  plugins: [react()],
  // Uygulama derlemesiyle aynı alias'lar — App.jsx'i (ve dolayısıyla native/push.js'i) import eden
  // bir test yazıldığında çözümleme hatası almamak için.
  resolve: { alias: nativeAliases },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.js"],
    include: ["test/**/*.test.jsx", "test/**/*.test.js"],
    globals: true,
  },
});
