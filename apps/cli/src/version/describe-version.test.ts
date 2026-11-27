import { describe, expect, test } from "vite-plus/test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { describeVersion } from "./describe-version.ts";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const identity = {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", env: { ...process.env, ...identity } });
}

describe("describeVersion", () => {
  test("adds the commit unless the clone is at the release tag of the version", async () => {
    const plain = await mkdtemp(join(tmpdir(), "zambil-version-"));
    const clone = await mkdtemp(join(tmpdir(), "zambil-version-"));
    git(["init", "--quiet", clone]);
    git(["-C", clone, "commit", "--quiet", "--allow-empty", "-m", "first"]);
    const commit = git(["-C", clone, "rev-parse", "--short", "HEAD"]).trim();
    const inner = join(clone, "apps");
    await mkdir(inner);
    const untagged = await describeVersion("1.2.0", { root: clone });
    const outside = await describeVersion("1.2.0", { root: plain });
    const subfolder = await describeVersion("1.2.0", { root: inner });
    git(["-C", clone, "tag", "v1.1.0"]);
    const otherTag = await describeVersion("1.2.0", { root: clone });
    git(["-C", clone, "tag", "v1.2.0"]);
    const tagged = await describeVersion("1.2.0", { root: clone });
    expect({ untagged, outside, subfolder, otherTag, tagged }).toEqual({
      untagged: `1.2.0 (commit ${commit})`,
      outside: "1.2.0",
      subfolder: "1.2.0",
      otherTag: `1.2.0 (commit ${commit})`,
      tagged: "1.2.0",
    });
  });
});
