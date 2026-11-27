import { cpSync, mkdtempSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

const main = fileURLToPath(new URL("main.ts", import.meta.url));
const cliSource = fileURLToPath(new URL(".", import.meta.url));
const sampleRepo = fileURLToPath(
  new URL("../../../packages/core/fixtures/sample-repo", import.meta.url),
);

describe("zambil", () => {
  test("runs as a program and checks the sample repo", () => {
    const stdout = execFileSync(main, ["check", "--repo", sampleRepo], { encoding: "utf8" });
    expect(stdout).toBe("6 notes, no problems.\n");
  });

  test("explains missing dependencies without a stack trace", () => {
    const clone = mkdtempSync(join(tmpdir(), "zambil-clone-"));
    cpSync(cliSource, join(clone, "apps/cli/src"), { recursive: true });
    const result = spawnSync(join(clone, "apps/cli/src/main.ts"), ["help"], { encoding: "utf8" });
    const firstLine = result.stderr.split("\n")[0];
    expect({ status: result.status, stdout: result.stdout, firstLine }).toEqual({
      status: 1,
      stdout: "",
      firstLine: `zambil cannot start, because its dependencies are not installed in ${clone}.`,
    });
  });
});
