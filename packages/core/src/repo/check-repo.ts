import { comparePaths } from "./compare-paths.ts";
import type { ConfigurationRepo } from "./configuration-repo.ts";
import { findNote } from "./find-note.ts";
import { isFile } from "./is-file.ts";
import { join } from "node:path";
import type { Note } from "../note/note.ts";
import type { NoteProblem } from "../note/note-problem.ts";

/** The repo that the note is in. */
export interface ProblemOptions {
  repo: ConfigurationRepo;
}

function scriptProblem(note: Note, options: ProblemOptions): NoteProblem | undefined {
  if (note.kind !== "script" || isFile(join(options.repo.root, note.script.path))) return undefined;
  const message = `\`script\` points to ${note.script.path}, but no file is there`;
  return { severity: "error", path: note.path, message };
}

function whenExpiredProblem(note: Note, options: ProblemOptions): NoteProblem | undefined {
  if (note.whenExpired === undefined) return undefined;
  const lookup = findNote(options.repo, { name: note.whenExpired });
  if (lookup.kind !== "missing") return undefined;
  const message = `\`when-expired\` names "${note.whenExpired}", but no note has that name`;
  return { severity: "error", path: note.path, message };
}

/** The checks of one note that need the rest of the repo: its script file and its `when-expired` note. */
export function checkNote(note: Note, options: ProblemOptions): NoteProblem[] {
  const problems: NoteProblem[] = [];
  const script = scriptProblem(note, options);
  if (script !== undefined) problems.push(script);
  const whenExpired = whenExpiredProblem(note, options);
  if (whenExpired !== undefined) problems.push(whenExpired);
  return problems;
}

/**
 * Every problem in a loaded repo, sorted by path. It adds the checks that the loader skips to stay fast:
 * that each script file exists, and that each `when-expired` note exists. A script is checked with
 * `stat`, never read.
 */
export function checkRepo(repo: ConfigurationRepo): NoteProblem[] {
  const problems = [...repo.problems];
  for (const note of repo.notes) problems.push(...checkNote(note, { repo }));
  return problems.toSorted((first, second) => comparePaths(first.path, { other: second.path }));
}
