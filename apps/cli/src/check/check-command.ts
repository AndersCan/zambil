import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { checkHookNames } from "@zambil/claude-code/check-hook-names";
import { checkRepo } from "@zambil/core/check-repo";
import { loadHookList } from "@zambil/claude-code/load-hook-list";
import type { NoteProblem } from "@zambil/core/note-problem";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { sharedOptions } from "../parse-command-args.ts";

interface CountOptions {
  noun: string;
}

function count(amount: number, options: CountOptions): string {
  return amount === 1 ? `1 ${options.noun}` : `${amount} ${options.noun}s`;
}

interface SummaryOptions {
  noteCount: number;
}

function summarize(problems: NoteProblem[], options: SummaryOptions): string {
  const notes = count(options.noteCount, { noun: "note" });
  if (problems.length === 0) return `${notes}, no problems.`;
  const errors = problems.filter((problem) => problem.severity === "error").length;
  const errorText = count(errors, { noun: "error" });
  const warningText = count(problems.length - errors, { noun: "warning" });
  return `${errorText} and ${warningText} in ${notes}.`;
}

function byPath(first: NoteProblem, second: NoteProblem): number {
  if (first.path === second.path) return 0;
  return first.path < second.path ? -1 : 1;
}

function runCheck(options: CommandRunOptions): ExitCode {
  const { output } = options;
  const parsed = parseCommandArgs({ args: options.args, options: sharedOptions });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${checkCommand.usage}\n`);
    return 2;
  }
  const repo = openRepo({ flag: parsed.value.values.repo, config: options.config });
  if (!repo.ok) {
    output.error(`${repo.error}\n`);
    return 2;
  }
  const { list } = loadHookList(options.config.environment);
  const hookProblems = checkHookNames(repo.value.notes, { hookList: list });
  const problems = [...checkRepo(repo.value), ...hookProblems].toSorted(byPath);
  for (const problem of problems) {
    output.write(`${problem.path}: ${problem.severity}: ${problem.message}\n`);
  }
  output.write(`${summarize(problems, { noteCount: repo.value.notes.length })}\n`);
  const hasErrors = problems.some((problem) => problem.severity === "error");
  return hasErrors ? 1 : 0;
}

/**
 * `zambil check`: every problem in the repo, such as duplicate names, and each hook name that zambil
 * never answers. Exits with 1 when one is an error.
 */
export const checkCommand: Command = {
  summary: "Report invalid notes and hook names that zambil never answers.",
  details:
    "It also warns about a hook name that zambil never answers. An error sets the exit code to 1. A warning does not.",
  usage: "Usage: zambil check [--repo <path>]",
  run: runCheck,
};
