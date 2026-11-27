import { describe, expect, test } from "vite-plus/test";
import { join, resolve } from "node:path";
import { readFile } from "node:fs/promises";

const repoRoot = resolve(import.meta.dirname, "..");

/** The `## ` headings of the changelog, without the date: `Unreleased`, `0.1.0`. */
function sectionNames(changelog: string): string[] {
  const names: string[] = [];
  for (const line of changelog.split("\n")) {
    const match = /^## (?<name>\S+)/.exec(line);
    if (match?.groups?.name !== undefined) names.push(match.groups.name);
  }
  return names;
}

describe("CHANGELOG.md", () => {
  test("starts with Unreleased and has a section for the version of the CLI", async () => {
    const [changelog, cliPackage] = await Promise.all([
      readFile(join(repoRoot, "CHANGELOG.md"), "utf8"),
      readFile(join(repoRoot, "apps/cli/package.json"), "utf8"),
    ]);
    const { version } = JSON.parse(cliPackage);
    const names = sectionNames(changelog);
    const isMissing = version !== "0.0.0" && !names.includes(version);
    const missingSections = isMissing ? [`## ${version}`] : [];
    expect({ first: names[0], missingSections }).toEqual({
      first: "Unreleased",
      missingSections: [],
    });
  });
});
