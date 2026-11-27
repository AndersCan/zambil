import { checkRepo } from "../repo/check-repo.ts";
import type { ConfigurationRepo } from "../repo/configuration-repo.ts";
import { indexNames } from "../repo/index-names.ts";
import type { Note } from "../note/note.ts";

interface RepoErrorOptions {
  root: string;
}

function repoErrors(notes: Note[], options: RepoErrorOptions): Set<string> {
  const indexed = indexNames(notes);
  const repo = { root: options.root, notes, names: indexed.names, problems: indexed.problems };
  const errors = new Set<string>();
  for (const problem of checkRepo(repo)) {
    if (problem.severity === "error") errors.add(`${problem.path}: ${problem.message}`);
  }
  return errors;
}

/** The repo before the save. */
export interface AddedRepoErrorsOptions {
  repo: ConfigurationRepo;
}

/**
 * The errors across notes that `zambil check` would report after the note replaces the note at its path,
 * and that it does not report now: a shared name, a missing script file or a missing `when-expired` note,
 * in this note or in another one.
 */
export function addedRepoErrors(note: Note, options: AddedRepoErrorsOptions): string[] {
  const { repo } = options;
  const isNew = !repo.notes.some((other) => other.path === note.path);
  const replaced = repo.notes.map((other) => (other.path === note.path ? note : other));
  const notes = isNew ? [...replaced, note] : replaced;
  const before = repoErrors(repo.notes, { root: repo.root });
  const after = repoErrors(notes, { root: repo.root });
  const added: string[] = [];
  for (const error of after) {
    if (!before.has(error)) added.push(error);
  }
  return added;
}
