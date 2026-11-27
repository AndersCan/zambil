import { left, right } from "../either.ts";
import type { Either } from "../either.ts";
import type { Note } from "../note/note.ts";
import { readTextFile } from "../repo/read-text-file.ts";
import { splitFrontmatter } from "../properties/split-frontmatter.ts";

/** The absolute root of the repo that the note is in. */
export interface ReadNoteContentOptions {
  root: string;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reads the text of a note after its frontmatter, from the file as it is now. A repo loads without
 * the text of its notes, so that a hook reads only the notes that it shows.
 */
export function readNoteContent(
  note: Note,
  options: ReadNoteContentOptions,
): Either<string, string> {
  const text = readTextFile(`${options.root}/${note.path}`);
  if (!text.ok) return left(`zambil cannot read ${note.path}: ${describeError(text.error)}`);
  return right(splitFrontmatter(text.value).content);
}
