import { nameKey } from "@zambil/core/index-names";
import type { Note } from "@zambil/core/note";

/** The text to look for. Empty text keeps every note. */
export interface FilterNotesOptions {
  text: string;
}

function searchableText(note: Note): string {
  const text = [note.name, ...note.aliases, note.description ?? ""].join("\n");
  return nameKey(text);
}

/** The notes that have each word of the text in the name, an alias or the description, in any case. */
export function filterNotes(notes: Note[], options: FilterNotesOptions): Note[] {
  const words = nameKey(options.text)
    .split(/\s+/)
    .filter((word) => word !== "");
  if (words.length === 0) return notes;
  return notes.filter((note) => {
    const text = searchableText(note);
    return words.every((word) => text.includes(word));
  });
}
