import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["other/推理拓扑/*.js"],
    languageOptions: {
      sourceType: "script",
      parserOptions: { sourceType: "script" },
    },
  },
  globalIgnores([".next/**", ".next-build/**", "out/**", "opensource/**", "src-tauri/**", "backend/**", "shared/**", "qa/**", "**/.venv/**", "**/.runtime/**", "**/.pytest_cache/**", ".playwright-cli/**"]),
])
