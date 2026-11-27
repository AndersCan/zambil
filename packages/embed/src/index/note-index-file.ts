import { createHash, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { formatNoteIndex, parseNoteIndex } from "./parse-note-index.ts";
import { left, right, wrap } from "@zambil/core/either";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
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

function rootHash(root: string): string {
  return createHash("sha256").update(root).digest("hex").slice(0, 16);
}

/** The index file of a repo. Its name is a hash of the repo root, so each repo has its own file. */
export function noteIndexPath(root: string, options: WriteNoteIndexOptions): string {
  const name = rootHash(root);
  return join(options.cacheFolder, "index", `${name}.index`);
}

/** The JSON index file that zambil wrote before the binary one. A write removes it. */
function oldIndexPath(root: string, options: WriteNoteIndexOptions): string {
  const name = rootHash(root);
  return join(options.cacheFolder, "index", `${name}.json`);
}

function readIndexBytes(path: string): Uint8Array | undefined {
  try {
    return readFileSync(path);
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
  const bytes = readIndexBytes(noteIndexPath(root, options));
  if (bytes === undefined) return empty;
  const index = parseNoteIndex(bytes);
  const isUsable = index?.modelKey === options.modelKey && index.root === root;
  return isUsable ? index : empty;
}

/**
 * Writes the index of a repo, through a temporary file, so that a reader never sees half a file. It
 * removes the JSON index of an older zambil.
 */
export async function writeNoteIndex(
  index: NoteIndex,
  options: WriteNoteIndexOptions,
): Promise<Either<string, string>> {
  const path = noteIndexPath(index.root, options);
  const partial = `${path}.${randomUUID()}.partial`;
  const written = await wrap(
    mkdir(dirname(path), { recursive: true }).then(() =>
      writeFile(partial, formatNoteIndex(index)),
    ),
  );
  const moved = written.ok ? await wrap(rename(partial, path)) : written;
  if (!moved.ok) {
    await rm(partial, { force: true });
    return left(`cannot write ${path}: ${String(moved.error)}`);
  }
  await wrap(rm(oldIndexPath(index.root, options), { force: true }));
  return right(path);
}
