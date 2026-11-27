import { left, right, wrap } from "../either.ts";
import type { ConfigurationRepo } from "./configuration-repo.ts";
import type { Either } from "../either.ts";
import { findNoteFiles } from "./find-note-files.ts";
import { indexNames } from "./index-names.ts";
import type { Note } from "../note/note.ts";
import type { NoteProblem } from "../note/note-problem.ts";
import { parseNote } from "../note/parse-note.ts";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/** The repo root could not be read: it is missing, not a folder, or not readable. */
export interface LoadRepoError {
  kind: "unreadable-root";
  root: string;
  message: string;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Loads every note of a configuration repo, with the problems of each note and every duplicate name.
 * Only the root failing is an error. A note that cannot be read is a problem, and the others still load.
 */
export async function loadRepo(root: string): Promise<Either<LoadRepoError, ConfigurationRepo>> {
  const absoluteRoot = resolve(root);
  const found = await findNoteFiles(absoluteRoot);
  if (!found.ok) {
    return left({
      kind: "unreadable-root",
      root: absoluteRoot,
      message: describeError(found.error),
    });
  }

  const texts = await Promise.all(
    found.value.files.map(async (file) => ({
      file,
      text: await wrap(readFile(`${absoluteRoot}/${file.path}`, "utf8")),
    })),
  );
  const notes: Note[] = [];
  const problems: NoteProblem[] = [...found.value.problems];
  for (const { file, text } of texts) {
    if (!text.ok) {
      const message = `zambil cannot read this note: ${describeError(text.error)}`;
      problems.push({ severity: "error", path: file.path, message });
      continue;
    }
    const parsed = parseNote(text.value, { file });
    notes.push(parsed.note);
    problems.push(...parsed.problems);
  }

  const indexed = indexNames(notes);
  problems.push(...indexed.problems);
  return right({ root: absoluteRoot, notes, names: indexed.names, problems });
}
