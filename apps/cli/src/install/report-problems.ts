import { checkHookNames } from "@zambil/claude-code/check-hook-names";
import { checkRepo } from "@zambil/core/check-repo";
import type { CommandOutput } from "../command.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { HookList } from "@zambil/claude-code/hook-list";

/** The hook list to check the hook names against, and where to print. */
export interface ReportProblemsOptions {
  hookList: HookList;
  output: CommandOutput;
}

/** `errors` when one problem makes `zambil check` fail. */
export type ProblemLevel = "clean" | "warnings" | "errors";

/** The problems that install prints. The rest is one line that points to `zambil check`. */
const shownProblems = 10;

interface CountOptions {
  noun: string;
}

function count(amount: number, options: CountOptions): string {
  return amount === 1 ? `1 ${options.noun}` : `${amount} ${options.noun}s`;
}

/** Prints the problems that `zambil check` reports, so that a setup never hides a broken note. */
export function reportProblems(
  repo: ConfigurationRepo,
  options: ReportProblemsOptions,
): ProblemLevel {
  const { output } = options;
  const problems = [...checkRepo(repo), ...checkHookNames(repo.notes, options)];
  const notes = count(repo.notes.length, { noun: "note" });
  if (problems.length === 0) {
    output.write(`Checked ${notes}: no problems.\n`);
    return "clean";
  }
  const errors = problems.filter((problem) => problem.severity === "error").length;
  const errorText = count(errors, { noun: "error" });
  const warningText = count(problems.length - errors, { noun: "warning" });
  output.error(`Checked ${notes}: ${errorText} and ${warningText}.\n`);
  for (const problem of problems.slice(0, shownProblems)) {
    output.error(`  ${problem.path}: ${problem.severity}: ${problem.message}\n`);
  }
  const hidden = problems.length - shownProblems;
  if (hidden > 0) output.error(`  and ${hidden} more.\n`);
  output.error("Run zambil check after a fix to see the problems that are left.\n");
  return errors > 0 ? "errors" : "warnings";
}
