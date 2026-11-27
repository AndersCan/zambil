import { left, right } from "../either.ts";
import type { ConfigurationRepo } from "./configuration-repo.ts";
import type { Either } from "../either.ts";
import { findNoteFiles } from "./find-note-files.ts";
import { indexNames } from "./index-names.ts";
import type { Note } from "../note/note.ts";
import type { NoteProblem } from "../note/note-problem.ts";
import { parseNote } from "../note/parse-note.ts";
import { readTextFile } from "./read-text-file.ts";
import { resolve } from "node:path";

/** Why the repo root could not be read: nothing is at the path, a file is there, or reading it failed. */
export type LoadRepoErrorKind = "missing-root" | "not-a-folder" | "unreadable-root";

/** The repo root could not be read. `message` is the error of the system. */
export interface LoadRepoError {
  kind: LoadRepoErrorKind;
  root: string;
  message: string;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function rootErrorKind(error: unknown): LoadRepoErrorKind {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  switch (code) {
    case "ENOENT":
      return "missing-root";
    case "ENOTDIR":
      return "not-a-folder";
    default:
      return "unreadable-root";
  }
}

/**
 * Loads every note of a configuration repo, with the problems of each note and every duplicate name.
 * Only the root failing is an error. A note that cannot be read is a problem, and the others still load.
 */
export function loadRepo(root: string): Either<LoadRepoError, ConfigurationRepo> {
  const absoluteRoot = resolve(root);
  const found = findNoteFiles(absoluteRoot);
  if (!found.ok) {
    return left({
      kind: rootErrorKind(found.error),
      root: absoluteRoot,
      message: describeError(found.error),
    });
  }

  const notes: Note[] = [];
  const problems: NoteProblem[] = [...found.value.problems];
  for (const file of found.value.files) {
    const text = readTextFile(`${absoluteRoot}/${file.path}`);
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
