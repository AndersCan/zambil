import type { Note } from "@zambil/core/note";

/** The text to look for. Empty text keeps every note. */
export interface FilterNotesOptions {
  text: string;
}

function searchableText(note: Note): string {
  return [note.name, ...note.aliases, note.description ?? ""].join("\n").toLowerCase();
}

/** The notes that have each word of the text in the name, an alias or the description, in any case. */
export function filterNotes(notes: Note[], options: FilterNotesOptions): Note[] {
  const words = options.text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "");
  if (words.length === 0) return notes;
  return notes.filter((note) => {
    const text = searchableText(note);
    return words.every((word) => text.includes(word));
  });
}
