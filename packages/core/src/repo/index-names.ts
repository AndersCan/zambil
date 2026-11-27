import type { NameEntry, NameIndex } from "./configuration-repo.ts";
import type { Note } from "../note/note.ts";
import type { NoteProblem } from "../note/note-problem.ts";

/** The names of all notes, and an error for each name that more than one note uses. */
export interface IndexedNames {
  names: NameIndex;
  problems: NoteProblem[];
}

/**
 * The form in which two names are the same. Obsidian resolves links without regard to case, and macOS
 * stores names in decomposed Unicode, so both are folded.
 */
export function nameKey(name: string): string {
  return name.normalize("NFC").toLowerCase();
}

function addNames(note: Note, names: NameIndex): void {
  const keys = new Set<string>();
  const spellings: [string, NameEntry][] = [[note.name, { note, source: "name" }]];
  for (const alias of note.aliases) spellings.push([alias, { note, source: "alias" }]);
  for (const [spelling, entry] of spellings) {
    const key = nameKey(spelling);
    if (keys.has(key)) continue;
    keys.add(key);
    const entries = names.get(key);
    if (entries === undefined) names.set(key, [entry]);
    else entries.push(entry);
  }
}

function describeEntries(entries: NameEntry[]): string {
  const files: string[] = [];
  for (const entry of entries) {
    files.push(entry.source === "name" ? entry.note.path : `${entry.note.path} (alias)`);
  }
  return files.join(", ");
}

/** Indexes each filename and alias. A name that two notes share is an error that names every file. */
export function indexNames(notes: Note[]): IndexedNames {
  const names: NameIndex = new Map();
  for (const note of notes) addNames(note, names);

  const problems: NoteProblem[] = [];
  for (const [key, entries] of names) {
    const [first] = entries;
    if (first === undefined || entries.length < 2) continue;
    const message = `the name "${key}" is used by ${entries.length} notes: ${describeEntries(entries)}`;
    problems.push({ severity: "error", path: first.note.path, message });
  }
  return { names, problems };
}
