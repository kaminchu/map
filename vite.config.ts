import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const base = loadEnv(mode, ".", "").BASE_PATH ?? "/";

  return {
    base,
    plugins: [
      react(),
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
