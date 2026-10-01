import { defineConfig } from "vite";

export default defineConfig({
  base: "/content-monitor/",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
