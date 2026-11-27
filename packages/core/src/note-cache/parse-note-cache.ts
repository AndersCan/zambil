import { asRecord } from "../as-record.ts";
import type { Note } from "../note/note.ts";
import type { NoteFile } from "../note/note-file.ts";
import type { NoteProblem } from "../note/note-problem.ts";

/** One note file as zambil last parsed it, with the size and the modified time that the file had then. */
export interface CachedNote {
  file: NoteFile;
  size: number;
  modifiedMs: number;
  note: Note;
  problems: NoteProblem[];
}

/** The parsed notes of one repo, by path, and the parser that made them. */
export interface NoteCache {
  parserKey: string;
  root: string;
  entries: Map<string, CachedNote>;
}

/** The version of the cache file. A file with another version is ignored and rebuilt. */
export const noteCacheFormat = 1;

function unsafeParseJson(text: string): unknown {
  return JSON.parse(text);
}

function parseJson(text: string): unknown {
  try {
    return unsafeParseJson(text);
  } catch {
    return undefined;
  }
}

function isCachedNote(value: unknown): value is CachedNote {
  const { file, size, modifiedMs, note, problems } = asRecord(value) ?? {};
  const hasStats = typeof size === "number" && typeof modifiedMs === "number";
  const { path } = asRecord(file) ?? {};
  const { name } = asRecord(note) ?? {};
  const hasNote = typeof path === "string" && typeof name === "string";
  return hasStats && hasNote && Array.isArray(problems);
}

/**
 * Reads a cache file. Only zambil writes it, and its parser key says which code parsed the notes, so a
 * light check of each entry is enough. A file that is not valid, or that has another format, is no
 * cache at all.
 */
export function parseNoteCache(text: string): NoteCache | undefined {
  const { format, parserKey, root, entries } = asRecord(parseJson(text)) ?? {};
  const hasHeader = typeof parserKey === "string" && typeof root === "string";
  const isCache = format === noteCacheFormat && hasHeader && Array.isArray(entries);
  if (!isCache) return undefined;
  const cached = new Map<string, CachedNote>();
  for (const entry of entries) {
    if (!isCachedNote(entry)) return undefined;
    const { expiry } = entry.note;
    if (expiry.kind === "at") expiry.time = new Date(expiry.time);
    cached.set(entry.file.path, entry);
  }
  return { parserKey, root, entries: cached };
}

/** The text of a cache file. */
export function formatNoteCache(cache: NoteCache): string {
  const { parserKey, root } = cache;
  const entries = [...cache.entries.values()];
  return JSON.stringify({ format: noteCacheFormat, parserKey, root, entries });
}
