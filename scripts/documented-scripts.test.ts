import { expect, test } from "vite-plus/test";
import manifest from "../package.json" with { type: "json" };
import { readFileSync } from "node:fs";

const pnpmCommands = new Set(["add", "dlx", "exec", "install", "remove", "update"]);

function listDocumentedScripts(markdown: string): string[] {
  const scripts = new Set<string>();
  for (const match of markdown.matchAll(/`pnpm (?:run )?([\w:-]+)/g)) {
    const name = match[1];
    if (name !== undefined && !pnpmCommands.has(name)) scripts.add(name);
  }
  return [...scripts].toSorted();
}

test("every pnpm script that AGENTS.md names exists in package.json", () => {
  const agents = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
  const documented = listDocumentedScripts(agents);
  const missing = documented.filter((name) => !Object.hasOwn(manifest.scripts, name));
  expect({ documented: documented.length > 0, missing }).toEqual({ documented: true, missing: [] });
});
