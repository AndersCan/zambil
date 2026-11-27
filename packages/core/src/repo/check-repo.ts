import type { ConfigurationRepo } from "./configuration-repo.ts";
import { findNote } from "./find-note.ts";
import { join } from "node:path";
import type { Note } from "../note/note.ts";
import type { NoteProblem } from "../note/note-problem.ts";
import { stat } from "node:fs/promises";
import { wrap } from "../either.ts";

async function scriptProblem(
  note: Note,
  repo: ConfigurationRepo,
): Promise<NoteProblem | undefined> {
  if (note.kind !== "script") return undefined;
  const script = await wrap(stat(join(repo.root, note.script.path)));
  if (script.ok && script.value.isFile()) return undefined;
  const message = `\`script\` points to ${note.script.path}, but no file is there`;
  return { severity: "error", path: note.path, message };
}

function whenExpiredProblem(note: Note, repo: ConfigurationRepo): NoteProblem | undefined {
  if (note.whenExpired === undefined) return undefined;
  const lookup = findNote(repo, { name: note.whenExpired });
  if (lookup.kind !== "missing") return undefined;
  const message = `\`when-expired\` names "${note.whenExpired}", but no note has that name`;
  return { severity: "error", path: note.path, message };
}

/**
 * Every problem in a loaded repo, sorted by path. It adds the checks that the loader skips to stay fast:
 * that each script file exists, and that each `when-expired` note exists. A script is checked with
 * `stat`, never read.
 */
export async function checkRepo(repo: ConfigurationRepo): Promise<NoteProblem[]> {
  const scriptProblems = await Promise.all(repo.notes.map((note) => scriptProblem(note, repo)));
  const problems = [...repo.problems];
  for (const [position, note] of repo.notes.entries()) {
    const script = scriptProblems[position];
    if (script !== undefined) problems.push(script);
    const whenExpired = whenExpiredProblem(note, repo);
    if (whenExpired !== undefined) problems.push(whenExpired);
  }
  return problems.toSorted((first, second) => first.path.localeCompare(second.path, "en"));
}
