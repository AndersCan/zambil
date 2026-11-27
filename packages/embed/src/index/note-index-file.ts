import { dirname, join } from "node:path";
import { formatNoteIndex, parseNoteIndex } from "./parse-note-index.ts";
import { left, right, wrap } from "@zambil/core/either";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Either } from "@zambil/core/either";
import type { NoteIndex } from "./parse-note-index.ts";
import { readFileSync } from "node:fs";

/** The zambil cache folder, and the model whose vectors the caller can use. */
export interface ReadNoteIndexOptions {
  cacheFolder: string;
  modelKey: string;
}

/** The zambil cache folder. */
export interface WriteNoteIndexOptions {
  cacheFolder: string;
}

/** The index file of a repo. Its name is a hash of the repo root, so each repo has its own file. */
export function noteIndexPath(root: string, options: WriteNoteIndexOptions): string {
  const name = createHash("sha256").update(root).digest("hex").slice(0, 16);
  return join(options.cacheFolder, "index", `${name}.json`);
}

function readIndexText(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Reads the index of a repo. A missing or broken file, or one that another model wrote, gives an
 * empty index: the index is a cache, so search still works and only embeds more at query time.
 */
export function readNoteIndex(root: string, options: ReadNoteIndexOptions): NoteIndex {
  const empty = { modelKey: options.modelKey, root, vectors: new Map<string, Float32Array>() };
  const text = readIndexText(noteIndexPath(root, options));
  if (text === undefined) return empty;
  const index = parseNoteIndex(text);
  const isUsable = index?.modelKey === options.modelKey && index.root === root;
  return isUsable ? index : empty;
}

/** Writes the index of a repo, through a temporary file, so that a reader never sees half a file. */
export async function writeNoteIndex(
  index: NoteIndex,
  options: WriteNoteIndexOptions,
): Promise<Either<string, string>> {
  const path = noteIndexPath(index.root, options);
  const partial = `${path}.${process.pid}.partial`;
  const written = await wrap(
    mkdir(dirname(path), { recursive: true }).then(() =>
      writeFile(partial, formatNoteIndex(index)),
    ),
  );
  if (!written.ok) return left(`cannot write ${partial}: ${String(written.error)}`);
  const moved = await wrap(rename(partial, path));
  if (!moved.ok) return left(`cannot write ${path}: ${String(moved.error)}`);
  return right(path);
}
