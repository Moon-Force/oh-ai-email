import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/**/*.{ts,tsx}"],
    plugins: { react: reactPlugin, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "target/**",
      "apps/desktop/dist/**",
      "apps/desktop/dist-electron/**",
      "apps/desktop/.vite/**",
      "apps/desktop/release/**",
      "coverage/**",
      "pnpm-lock.yaml",
    ],
  }
);
