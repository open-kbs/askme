import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

import { readFileSync } from "node:fs";

const configJsonPath = path.resolve(__dirname, "../config.json");
const rootConfig = JSON.parse(readFileSync(configJsonPath, "utf-8"));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "html-config-substitute",
      transformIndexHtml(html) {
        return html
          .replace(/%SITE_NAME%/g, rootConfig.branding.siteName)
          .replace(/%META_DESCRIPTION%/g, rootConfig.branding.metaDescription)
          .replace(/%AVATAR_URL%/g, rootConfig.branding.avatarUrl);
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@config": configJsonPath,
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
    proxy: {
      // Route API calls to the in-process Lambda server (local/server.mjs).
      // Set LOCAL_API_PORT if you change LOCAL_PORT in the api process.
      "/api-chat": { target: "http://127.0.0.1:8787", changeOrigin: false },
      "/api-availability": { target: "http://127.0.0.1:8787", changeOrigin: false },
      "/api-bookings": { target: "http://127.0.0.1:8787", changeOrigin: false },
      "/api-contact": { target: "http://127.0.0.1:8787", changeOrigin: false },
      "/api/setup": { target: "http://127.0.0.1:8787", changeOrigin: false },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../site"),
    emptyOutDir: true,
  },
});
