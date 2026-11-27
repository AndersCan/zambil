import { describe, expect, test } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const main = fileURLToPath(new URL("main.ts", import.meta.url));
const sampleRepo = fileURLToPath(
  new URL("../../../packages/core/fixtures/sample-repo", import.meta.url),
);

describe("zambil", () => {
  test("runs as a program and checks the sample repo", () => {
    const stdout = execFileSync(main, ["check", "--repo", sampleRepo], { encoding: "utf8" });
    expect(stdout).toBe("6 notes, no problems.\n");
  });
});
