import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { flatGeobufPlugin } from "./build/flatGeobufPlugin";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as {
  version: string;
};

function commitHash(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig(({ mode }) => {
  const base = loadEnv(mode, ".", "").BASE_PATH ?? "/";

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __COMMIT_HASH__: JSON.stringify(commitHash()),
    },
    plugins: [
      react(),
      flatGeobufPlugin(),
      VitePWA({
        registerType: "autoUpdate",
        strategies: "generateSW",
        includeAssets: ["favicon.svg", "icons/*.png"],
        manifest: {
          name: "オフライン地図",
          short_name: "オフライン地図",
          lang: "ja",
          display: "standalone",
          orientation: "any",
          start_url: base,
          scope: base,
          theme_color: "#0b1728",
          background_color: "#0b1728",
          icons: [
            { src: `${base}icons/icon-192.png`, sizes: "192x192", type: "image/png" },
            { src: `${base}icons/icon-512.png`, sizes: "512x512", type: "image/png" },
            {
              src: `${base}icons/icon-maskable-512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          navigateFallback: `${base}index.html`,
          globPatterns: ["**/*.{js,css,html,woff2,svg,png,ico,webmanifest}"],
          runtimeCaching: [],
        },
      }),
    ],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      css: true,
    },
  };
});
