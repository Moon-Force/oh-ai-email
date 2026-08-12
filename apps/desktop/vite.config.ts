import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import renderer from "vite-plugin-electron-renderer";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json") as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

/** Keep Node-native mail stack out of the main-process bundle. */
const electronExternals = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  "electron",
];

export default defineConfig({
  // Relative base so Electron loadFile can resolve dist/assets/*
  base: "./",
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              external: electronExternals,
            },
          },
        },
      },
      preload: { input: path.join(__dirname, "electron/preload.ts") },
    }),
    renderer(),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  clearScreen: false,
});
