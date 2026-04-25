import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

import { readFileSync, existsSync } from "node:fs";
import type { Plugin } from "vite";

const configJsonPath = path.resolve(__dirname, "../config.json");
const rootConfig = JSON.parse(readFileSync(configJsonPath, "utf-8"));

const envLocalPath = path.resolve(__dirname, "../.env.local");
function readEnvLocal(): Record<string, string> {
  if (!existsSync(envLocalPath)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(envLocalPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const envLocal = readEnvLocal();

const assetsDir = path.resolve(__dirname, "../assets");

function serveMedia(): Plugin {
  return {
    name: "serve-media",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url?.startsWith("/media/")) return next();
        const file = req.url.slice("/media/".length);
        const abs = path.join(assetsDir, file);
        if (!abs.startsWith(assetsDir) || !existsSync(abs)) return next();
        req.url = "/@fs/" + abs;
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    serveMedia(),
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
  define: {
    __GOOGLE_CLIENT_ID__: JSON.stringify(envLocal.GOOGLE_OAUTH_CLIENT_ID || ""),
  },
  build: {
    outDir: path.resolve(__dirname, "../site"),
    emptyOutDir: true,
  },
});
