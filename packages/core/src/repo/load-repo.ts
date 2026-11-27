import { left, right } from "../either.ts";
import type { ConfigurationRepo } from "./configuration-repo.ts";
import type { Either } from "../either.ts";
import { findNoteFiles } from "./find-note-files.ts";
import { indexNames } from "./index-names.ts";
import type { NoteProblem } from "../note/note-problem.ts";
import { parseNoteFiles } from "../note-cache/parse-note-files.ts";
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

/** The zambil cache folder, to keep the parsed notes in. Without it, every note file is parsed. */
export interface LoadRepoOptions {
  cacheFolder?: string;
}

/**
 * Loads every note of a configuration repo, with the problems of each note and every duplicate name.
 * Only the root failing is an error. A note that cannot be read is a problem, and the others still load.
 * With a cache folder, it parses only the files that changed since the last load.
 */
export function loadRepo(
  root: string,
  options: LoadRepoOptions = {},
): Either<LoadRepoError, ConfigurationRepo> {
  const absoluteRoot = resolve(root);
  const found = findNoteFiles(absoluteRoot);
  if (!found.ok) {
    return left({
      kind: rootErrorKind(found.error),
      root: absoluteRoot,
      message: describeError(found.error),
    });
  }

  const { cacheFolder } = options;
  const { notes, problems: noteProblems } = parseNoteFiles(found.value.files, {
    root: absoluteRoot,
    cacheFolder,
  });
  const problems: NoteProblem[] = [...found.value.problems, ...noteProblems];

  const indexed = indexNames(notes);
  problems.push(...indexed.problems);
  return right({ root: absoluteRoot, notes, names: indexed.names, problems });
}
