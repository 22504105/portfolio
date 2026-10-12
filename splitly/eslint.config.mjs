import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    ".tmp/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    // The receipt reader, copied from its packages: not our code.
    "public/ocr/**",
  ]),
]);

export default eslintConfig;
