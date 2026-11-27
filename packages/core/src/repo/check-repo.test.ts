import { describe, expect, test } from "vite-plus/test";
import { checkRepo } from "./check-repo.ts";
import { fileURLToPath } from "node:url";
import { loadRepo } from "./load-repo.ts";
import { writeTestRepo } from "./write-test-repo.ts";

async function problemsIn(root: string) {
  const loaded = await loadRepo(root);
  return loaded.ok ? checkRepo(loaded.value) : loaded.error;
}

describe("checkRepo", () => {
  test("finds no problems in the sample repo", async () => {
    const sampleRepo = fileURLToPath(new URL("../../fixtures/sample-repo", import.meta.url));
    expect(await problemsIn(sampleRepo)).toEqual([]);
  });

  test("reports a missing script and a missing when-expired note, sorted by path", async () => {
    const root = await writeTestRepo({
      "z/backup.md": "---\nscript: backup.sh\n---\n",
      "a/today.md": "---\nexpires: 2026-11-28\nwhen-expired: '[[refresh]]'\n---\n",
      "m/dup.md": "",
      "b/dup.md": "",
    });
    expect(await problemsIn(root)).toEqual([
      {
        severity: "error",
        path: "a/today.md",
        message: '`when-expired` names "refresh", but no note has that name',
      },
      {
        severity: "error",
        path: "b/dup.md",
        message: 'the name "dup" is used by 2 notes: b/dup.md, m/dup.md',
      },
      {
        severity: "error",
        path: "z/backup.md",
        message: "`script` points to z/backup.sh, but no file is there",
      },
    ]);
  });
});
