import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import renderer from "vite-plugin-electron-renderer";
import path from "node:path";

export default defineConfig({
  // Relative base so Electron loadFile can resolve dist/assets/*
  base: "./",
  plugins: [
    react(),
    electron({
      main: { entry: "electron/main.ts" },
      preload: { input: path.join(__dirname, "electron/preload.ts") },
    }),
    renderer(),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  clearScreen: false,
});
