import type { CachedNote, NoteCache } from "./parse-note-cache.ts";
import { dirname, join } from "node:path";
import { formatNoteCache, parseNoteCache } from "./parse-note-cache.ts";
import { left, right } from "../either.ts";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Either } from "../either.ts";
import { randomUUID } from "node:crypto";
import { readTextFile } from "../repo/read-text-file.ts";

/** The zambil cache folder. */
export interface NoteCacheFileOptions {
  cacheFolder: string;
}

/** The zambil cache folder, and the parser key that the cached notes must have. */
export interface ReadNoteCacheOptions extends NoteCacheFileOptions {
  parserKey: string;
}

/** The cache file of a repo. Its name is a hash of the repo root, so each repo has its own file. */
export function noteCachePath(root: string, options: NoteCacheFileOptions): string {
  const name = createHash("sha256").update(root).digest("hex").slice(0, 16);
  return join(options.cacheFolder, "notes", `${name}.json`);
}

/**
 * The cached notes of a repo, by path. A missing or broken file, or one that other code or another
 * repo wrote, gives no notes: the cache only saves time, so the notes are then parsed again.
 */
export function readNoteCache(
  root: string,
  options: ReadNoteCacheOptions,
): Map<string, CachedNote> {
  const text = readTextFile(noteCachePath(root, options));
  const cache = text.ok ? parseNoteCache(text.value) : undefined;
  const isUsable = cache?.parserKey === options.parserKey && cache.root === root;
  return isUsable ? cache.entries : new Map();
}

/** Runs one synchronous file action, and returns its error as a value. */
function attempt(action: () => unknown): Either<unknown, undefined> {
  try {
    action();
    return right(undefined);
  } catch (error: unknown) {
    return left(error);
  }
}

/**
 * Writes the cache of a repo through a temporary file, so that a reader never sees half a file. It
 * writes synchronously, like the note reads, because a hook runs it.
 */
export function writeNoteCache(
  cache: NoteCache,
  options: NoteCacheFileOptions,
): Either<unknown, string> {
  const path = noteCachePath(cache.root, options);
  const partial = `${path}.${randomUUID()}.partial`;
  const text = formatNoteCache(cache);
  const folder = attempt(() => mkdirSync(dirname(path), { recursive: true }));
  const written = folder.ok ? attempt(() => writeFileSync(partial, text)) : folder;
  const moved = written.ok ? attempt(() => renameSync(partial, path)) : written;
  if (moved.ok) return right(path);
  attempt(() => rmSync(partial, { force: true }));
  return left(moved.error);
}
