import { chmod, mkdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { left, right, wrap } from "@zambil/core/either";
import { dirname } from "node:path";
import type { Either } from "@zambil/core/either";
import { randomUUID } from "node:crypto";

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function isMissingFile(reason: unknown): boolean {
  return reason instanceof Error && "code" in reason && reason.code === "ENOENT";
}

/** The text of a file, `undefined` when there is no file, or why it cannot be read. */
export async function readOptionalText(path: string): Promise<Either<string, string | undefined>> {
  const text = await wrap(readFile(path, "utf8"));
  if (text.ok) return right(text.value);
  if (isMissingFile(text.error)) return right(undefined);
  return left(`cannot read ${path}: ${describe(text.error)}`);
}

/** The new text of the file. */
export interface ReplaceTextOptions {
  text: string;
}

interface Target {
  path: string;
  partial: string;
  mode?: number;
}

function partialPath(path: string): string {
  return `${path}.${randomUUID()}.partial`;
}

/** The file that a symbolic link points to, and its permissions, so that a write keeps both. */
async function findTarget(path: string): Promise<Either<string, Target>> {
  const resolved = await wrap(realpath(path));
  if (!resolved.ok) {
    if (isMissingFile(resolved.error)) return right({ path, partial: partialPath(path) });
    return left(`cannot read ${path}: ${describe(resolved.error)}`);
  }
  const status = await wrap(stat(resolved.value));
  if (!status.ok) return left(`cannot read ${path}: ${describe(status.error)}`);
  const mode = status.value.mode & 0o777;
  return right({ path: resolved.value, partial: partialPath(resolved.value), mode });
}

async function writeThenRename(target: Target, options: ReplaceTextOptions): Promise<void> {
  const { partial } = target;
  await mkdir(dirname(target.path), { recursive: true });
  await writeFile(partial, options.text);
  if (target.mode !== undefined) await chmod(partial, target.mode);
  await rename(partial, target.path);
}

/**
 * Writes a file in one step: a reader sees the old text or the new text, never a part of it. A
 * symbolic link stays a link, and the file keeps its permissions.
 */
export async function replaceText(
  path: string,
  options: ReplaceTextOptions,
): Promise<Either<string, string>> {
  const target = await findTarget(path);
  if (!target.ok) return target;
  const written = await wrap(writeThenRename(target.value, options));
  if (written.ok) return right(path);
  await wrap(rm(target.value.partial, { force: true }));
  return left(`cannot write ${path}: ${describe(written.error)}`);
}
