import { checkHookNames } from "@zambil/claude-code/check-hook-names";
import { checkRepo } from "@zambil/core/check-repo";
import type { CheckResult } from "./check-result.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { HookList } from "@zambil/claude-code/hook-list";
import { zambilCommand } from "./zambil-command.ts";

/** The hook list to check the hook names against, and the `--repo` flag for the fix command. */
export interface CheckNotesOptions {
  hookList: HookList;
  repoFlag: string | undefined;
}

/** The problems that the report shows. `zambil check` shows all of them. */
const shownProblems = 3;

interface CountOptions {
  noun: string;
}

function count(amount: number, options: CountOptions): string {
  return amount === 1 ? `1 ${options.noun}` : `${amount} ${options.noun}s`;
}

/** What `zambil check` would report: a fail for an error, a warning for warnings only. */
export function checkNotes(repo: ConfigurationRepo, options: CheckNotesOptions): CheckResult {
  const found = [...checkRepo(repo), ...checkHookNames(repo.notes, options)];
  const problems = found.toSorted((first, second) => first.path.localeCompare(second.path));
  const notes = count(repo.notes.length, { noun: "note" });
  if (problems.length === 0) {
    return { level: "ok", text: `zambil check finds no problem in ${notes}.` };
  }
  const errors = problems.filter((problem) => problem.severity === "error").length;
  const errorText = count(errors, { noun: "error" });
  const warningText = count(problems.length - errors, { noun: "warning" });
  const details: string[] = [];
  for (const problem of problems.slice(0, shownProblems)) {
    details.push(`${problem.path}: ${problem.severity}: ${problem.message}`);
  }
  const hidden = problems.length - shownProblems;
  if (hidden > 0) details.push(`and ${hidden} more.`);
  const check = zambilCommand("check", options);
  return {
    level: errors > 0 ? "fail" : "warn",
    text: `zambil check finds ${errorText} and ${warningText} in ${notes}.`,
    details,
    fixes: [`${check}   # to see each problem, then fix the notes`],
  };
}
