import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    testTimeout: 15000,
    setupFiles: ["./src/test/setup.ts"],
    coverage: { provider: "v8", reportsDirectory: "coverage" },
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
