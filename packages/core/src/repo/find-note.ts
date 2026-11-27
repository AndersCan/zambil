import type { ConfigurationRepo } from "./configuration-repo.ts";
import { nameKey } from "./index-names.ts";
import type { Note } from "../note/note.ts";

/** The result of a name lookup. A name that more than one note uses is ambiguous, not found. */
export type NoteLookup =
  | { kind: "found"; note: Note }
  | { kind: "missing"; name: string }
  | { kind: "ambiguous"; name: string; notes: Note[] };

/** The filename or alias to look up, in any case. */
export interface FindNoteOptions {
  name: string;
}

/** Finds the note that has a filename or alias, as a `[[link]]` or `z:<name>` would. */
export function findNote(
  repo: Pick<ConfigurationRepo, "names">,
  options: FindNoteOptions,
): NoteLookup {
  const entries = repo.names.get(nameKey(options.name.trim())) ?? [];
  const [first] = entries;
  if (first === undefined) return { kind: "missing", name: options.name };
  if (entries.length === 1) return { kind: "found", note: first.note };
  return { kind: "ambiguous", name: options.name, notes: entries.map((entry) => entry.note) };
}
