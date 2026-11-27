import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { wrap } from "@zambil/core/either";

/** The folder of the zambil clone. */
export interface DescribeVersionOptions {
  root: string;
}

const runFile = promisify(execFile);

/**
 * The version as `zambil --version` prints it: `0.1.0` when the clone is at the release tag `v0.1.0`,
 * else `0.1.0 (commit abc1234)`, so that a user on `main` can tell which commit runs. Git reads the
 * `.git` of the root only, so a parent repo or an exported `GIT_DIR` never gives its commit. Without
 * a clone at the root, it is the version alone.
 */
export async function describeVersion(
  version: string,
  options: DescribeVersionOptions,
): Promise<string> {
  const gitDir = `--git-dir=${join(options.root, ".git")}`;
  const [head, tags] = await Promise.all([
    wrap(runFile("git", [gitDir, "rev-parse", "--short", "HEAD"])),
    wrap(runFile("git", [gitDir, "tag", "--points-at", "HEAD"])),
  ]);
  if (!head.ok) return version;
  const tagNames = tags.ok ? tags.value.stdout.split("\n") : [];
  const commit = head.value.stdout.trim();
  return tagNames.includes(`v${version}`) ? version : `${version} (commit ${commit})`;
}
