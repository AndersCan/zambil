import { defineConfig } from "vite-plus";
import { globSync } from "node:fs";

/** Only folders become test projects, so a stray file such as `packages/.gitkeep` does not stop the run. */
const packageFolders = globSync("{apps,packages}/*/", { cwd: import.meta.dirname });

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "typescript/no-explicit-any": "error",
    },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
  test: {
    projects: [...packageFolders, { test: { name: "scripts", include: ["scripts/**/*.test.ts"] } }],
  },
});
