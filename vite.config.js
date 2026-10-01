import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages needs /content-monitor/, while the native APK must use
  // relative asset paths because it loads the bundled dist/ locally.
  base: process.env.VITE_BASE || "/content-monitor/",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
