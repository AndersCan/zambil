import type { Note } from "./note.ts";

/**
 * The texts that similarity search scores a note by: its description and each of its triggers. Both
 * are embedded as documents, so a change of that role must also change the key of the index.
 */
export function searchTextsOf(note: Note): string[] {
  return note.description === undefined ? note.triggers : [note.description, ...note.triggers];
}
