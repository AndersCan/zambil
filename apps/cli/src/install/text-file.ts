import { left, right, wrap } from "@zambil/core/either";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Either } from "@zambil/core/either";

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

/** Writes a file in one step: a reader sees the old text or the new text, never a part of it. */
export async function replaceText(
  path: string,
  options: ReplaceTextOptions,
): Promise<Either<string, string>> {
  const { text } = options;
  const partial = `${path}.zambil-partial`;
  const written = await wrap(
    mkdir(dirname(path), { recursive: true })
      .then(() => writeFile(partial, text))
      .then(() => rename(partial, path)),
  );
  if (!written.ok) return left(`cannot write ${path}: ${describe(written.error)}`);
  return right(path);
}
