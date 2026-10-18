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
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Playwright fixtures are called `use`, which the React hooks rule mistakes for React's `use`.
  { files: ["tests/playwright/**"], rules: { "react-hooks/rules-of-hooks": "off" } },
]);

export default eslintConfig;
