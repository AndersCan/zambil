import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";
import { wrap } from "@zambil/core/either";

/** The folder of the zambil clone. */
export interface DescribeVersionOptions {
  root: string;
}

const runFile = promisify(execFile);

/**
 * The version as `zambil --version` prints it: `0.1.0` when the clone is at the release tag `v0.1.0`,
 * else `0.1.0 (commit abc1234)`, so that a user on `main` can tell which commit runs. Without a git
 * clone at the root, it is the version alone.
 */
export async function describeVersion(
  version: string,
  options: DescribeVersionOptions,
): Promise<string> {
  const { root } = options;
  const [head, tags, folder] = await Promise.all([
    wrap(runFile("git", ["-C", root, "rev-parse", "--show-toplevel", "--short", "HEAD"])),
    wrap(runFile("git", ["-C", root, "tag", "--points-at", "HEAD"])),
    wrap(realpath(root)),
  ]);
  if (!head.ok || !folder.ok) return version;
  const [topLevel = "", commit = ""] = head.value.stdout.trim().split("\n");
  const topFolder = await wrap(realpath(topLevel));
  const isClone = topFolder.ok && topFolder.value === folder.value;
  if (!isClone) return version;
  const tagNames = tags.ok ? tags.value.stdout.split("\n") : [];
  return tagNames.includes(`v${version}`) ? version : `${version} (commit ${commit})`;
}
