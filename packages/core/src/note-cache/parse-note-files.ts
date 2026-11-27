import { left, right } from "../either.ts";
import { readNoteCache, writeNoteCache } from "./note-cache-file.ts";
import type { CachedNote } from "./parse-note-cache.ts";
import type { Either } from "../either.ts";
import type { Note } from "../note/note.ts";
import type { NoteFile } from "../note/note-file.ts";
import type { NoteProblem } from "../note/note-problem.ts";
import { parseNote } from "../note/parse-note.ts";
import { parserKey } from "./parser-key.ts";
import { readTextFile } from "../repo/read-text-file.ts";
import type { Stats } from "node:fs";
import { statSync } from "node:fs";

/** The absolute repo root, and the zambil cache folder, or `undefined` to parse every file. */
export interface ParseNoteFilesOptions {
  root: string;
  cacheFolder: string | undefined;
}

/** The notes of the files, in the same order, and the problems of each note. */
export interface ParsedNoteFiles {
  notes: Note[];
  problems: NoteProblem[];
}

/**
 * A file modified this recently is parsed again on the next load. A file system can store the
 * modified time in whole seconds, so a second edit within that time, of the same size, would look
 * unchanged.
 */
const settleMs = 2000;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function unsafeStat(path: string): Stats {
  return statSync(path);
}

function statFile(path: string): Either<unknown, Stats> {
  try {
    return right(unsafeStat(path));
  } catch (error: unknown) {
    return left(error);
  }
}

interface ParseFileOptions {
  root: string;
}

function parseFile(file: NoteFile, options: ParseFileOptions): Either<NoteProblem, CachedNote> {
  const stats = statFile(`${options.root}/${file.path}`);
  const text = readTextFile(`${options.root}/${file.path}`);
  if (!text.ok) {
    const message = `zambil cannot read this note: ${describeError(text.error)}`;
    return left({ severity: "error", path: file.path, message });
  }
  const parsed = parseNote(text.value, { file });
  const size = stats.ok ? stats.value.size : -1;
  const modifiedMs = stats.ok ? stats.value.mtimeMs : -1;
  const changedMs = stats.ok ? stats.value.ctimeMs : -1;
  return right({ file, size, modifiedMs, changedMs, ...parsed });
}

interface ReuseOptions {
  root: string;
  previous: Map<string, CachedNote>;
}

/**
 * The cached note of a file whose place, size, modified time and status change time did not change
 * since it was parsed. A tool can set the modified time back, but not the status change time.
 */
function reuse(file: NoteFile, options: ReuseOptions): CachedNote | undefined {
  const cached = options.previous.get(file.path);
  if (cached === undefined) return undefined;
  const stats = statFile(`${options.root}/${file.path}`);
  if (!stats.ok) return undefined;
  const isSameFile = cached.file.name === file.name && cached.file.kind === file.kind;
  const { size, mtimeMs, ctimeMs } = stats.value;
  const isSameTime = cached.modifiedMs === mtimeMs && cached.changedMs === ctimeMs;
  const isUnchanged = cached.size === size && isSameTime;
  return isSameFile && isUnchanged ? cached : undefined;
}

/** Where the cache is and which parser key it needs, or `undefined` when no cache is used. */
interface CacheTarget {
  cacheFolder: string;
  parserKey: string;
}

/**
 * The key holds the time zone too: an `expires` date with no time zone is read as local midnight, so
 * a note parsed in another time zone expires at another moment.
 */
function cacheTarget(options: ParseNoteFilesOptions): CacheTarget | undefined {
  if (options.cacheFolder === undefined) return undefined;
  const key = parserKey();
  if (!key.ok) return undefined;
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
  return { cacheFolder: options.cacheFolder, parserKey: `${key.value} ${timeZone}` };
}

/**
 * Parses each note file. With a cache folder, it reuses the note of each file that did not change, so
 * that it reads only the files that changed. It writes the cache again only when an entry changed. A cache that it cannot read or write only costs time.
 */
export function parseNoteFiles(files: NoteFile[], options: ParseNoteFilesOptions): ParsedNoteFiles {
  const { root } = options;
  const target = cacheTarget(options);
  const previous = target === undefined ? new Map() : readNoteCache(root, target);
  const entries = new Map<string, CachedNote>();
  const parsed: ParsedNoteFiles = { notes: [], problems: [] };
  const settled = Date.now() - settleMs;
  let hasNewEntry = false;
  for (const file of files) {
    const cached = target === undefined ? undefined : reuse(file, { root, previous });
    const entry = cached === undefined ? parseFile(file, { root }) : right(cached);
    if (!entry.ok) {
      parsed.problems.push(entry.error);
      continue;
    }
    parsed.notes.push(entry.value.note);
    parsed.problems.push(...entry.value.problems);
    const isSettled = entry.value.modifiedMs >= 0 && entry.value.modifiedMs < settled;
    if (!isSettled) continue;
    entries.set(file.path, entry.value);
    if (cached === undefined) hasNewEntry = true;
  }
  const isChanged = hasNewEntry || entries.size !== previous.size;
  const shouldWrite = target !== undefined && isChanged;
  if (shouldWrite) writeNoteCache({ parserKey: target.parserKey, root, entries }, target);
  return parsed;
}
