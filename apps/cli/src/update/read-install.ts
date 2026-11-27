import { left, right, wrap } from "@zambil/core/either";
import { asRecord } from "@zambil/core/as-record";
import type { Either } from "@zambil/core/either";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

/**
 * The version in `apps/cli/package.json`, the commit of HEAD, and the kind of clone. `development`: a
 * dependency that only development needs is installed, so it is not a clone that install.sh made.
 */
export interface InstallState {
  version: string;
  commit: string;
  kind: "install" | "development";
}

const runFile = promisify(execFile);

function unsafeParseJson(text: string): unknown {
  return JSON.parse(text);
}

async function readJson(path: string): Promise<Record<string, unknown> | undefined> {
  const text = await wrap(readFile(path, "utf8"));
  if (!text.ok) return undefined;
  try {
    return asRecord(unsafeParseJson(text.value));
  } catch {
    return undefined;
  }
}

function hasDevelopmentDependency(root: string, rootPackage: Record<string, unknown>): boolean {
  const names = Object.keys(asRecord(rootPackage.devDependencies) ?? {});
  return names.some((name) => existsSync(join(root, "node_modules", name)));
}

/** Reads the state of the zambil clone at the root, or says why it is not a clone of zambil. */
export async function readInstall(root: string): Promise<Either<string, InstallState>> {
  const gitDir = `--git-dir=${join(root, ".git")}`;
  const [rootPackage, cliPackage, head] = await Promise.all([
    readJson(join(root, "package.json")),
    readJson(join(root, "apps/cli/package.json")),
    wrap(runFile("git", [gitDir, "rev-parse", "HEAD"])),
  ]);
  const version = cliPackage?.version;
  const isClone = rootPackage?.name === "zambil" && typeof version === "string" && head.ok;
  if (!isClone) return left(`${root} is not a git clone of zambil.`);
  const kind = hasDevelopmentDependency(root, rootPackage) ? "development" : "install";
  return right({ version, commit: head.value.stdout.trim(), kind });
}
