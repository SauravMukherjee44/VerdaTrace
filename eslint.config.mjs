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
    ".netlify/**",
    ".vinext/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Version-matched MapLibre runtime assets copied from node_modules.
    "public/maplibre-gl-*.mjs",
  ]),
]);

export default eslintConfig;
