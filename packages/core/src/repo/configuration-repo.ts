import type { Note } from "../note/note.ts";
import type { NoteProblem } from "../note/note-problem.ts";

/** Whether a name in the index is a note's filename or one of its aliases. */
export type NameSource = "name" | "alias";

/** One note that a name points to. */
export interface NameEntry {
  note: Note;
  source: NameSource;
}

/** Every name and alias, by `nameKey`. A key with more than one entry is a duplicate. */
export type NameIndex = Map<string, NameEntry[]>;

/** A loaded configuration repo. `root` is absolute, and each note path is relative to it. */
export interface ConfigurationRepo {
  root: string;
  notes: Note[];
  names: NameIndex;
  problems: NoteProblem[];
}
