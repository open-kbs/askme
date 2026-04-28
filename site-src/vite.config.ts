import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

import { readFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import type { Plugin } from "vite";

const configJsonPath = path.resolve(__dirname, "../config.json");
const rootConfig = JSON.parse(readFileSync(configJsonPath, "utf-8"));

const assetsDir = path.resolve(__dirname, "../assets");

function serveMedia(): Plugin {
  return {
    name: "serve-media",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        let file: string | undefined;
        if (req.url?.startsWith("/media/")) {
          file = req.url.slice("/media/".length);
        } else if (req.url?.startsWith("/assets/")) {
          file = req.url.slice("/assets/".length);
        }
        if (!file) return next();
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
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: false },
    },
  },
  envDir: path.resolve(__dirname, ".."),
  envPrefix: ["VITE_", "GOOGLE_OAUTH_"],
  build: {
    outDir: path.resolve(__dirname, "../site"),
    emptyOutDir: true,
    rollupOptions: {
      plugins: [
        {
          name: "copy-avatar",
          closeBundle() {
            const src = path.join(assetsDir, "avatar.png");
            const dest = path.resolve(__dirname, "../site/assets/avatar.png");
            if (existsSync(src)) {
              mkdirSync(path.dirname(dest), { recursive: true });
              copyFileSync(src, dest);
            }
          },
        },
      ],
    },
  },
});
