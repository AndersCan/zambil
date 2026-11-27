import type { CheckLevel, CheckResult } from "./check-result.ts";
import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { parseCommandArgs, repoOptionHelp, sharedOptions } from "../parse-command-args.ts";
import { checkHooks } from "./check-hooks.ts";
import { checkNode } from "./check-node.ts";
import { checkNotes } from "./check-notes.ts";
import { checkNotesFolder } from "./check-notes-folder.ts";
import { checkSimilar } from "./check-similar.ts";
import { checkSkill } from "./check-skill.ts";
import { checkUserConfig } from "./check-user-config.ts";
import { checkZambilLink } from "./check-zambil-link.ts";
import { findOnPath } from "../install/find-on-path.ts";
import { loadHookList } from "@zambil/claude-code/load-hook-list";

/** The Node version that runs zambil, such as `24.3.0`. Tests pass their own. */
export interface RunChecksOptions {
  repoFlag: string | undefined;
  nodeVersion: string;
}

function needsRepo(name: string): CheckResult {
  return { level: "skip", text: `${name}: needs the notes folder.` };
}

/** Every check in the order that a setup depends on them. Each later check reuses what an earlier one found. */
export async function runChecks(
  run: CommandRunOptions,
  options: RunChecksOptions,
): Promise<CheckResult[]> {
  const { config } = run;
  const { repoFlag } = options;
  const zambilPath = findOnPath("zambil", { searchPath: config.searchPath ?? [] });
  const { list } = loadHookList(config.environment);
  const folder = checkNotesFolder(config, { repoFlag });
  const { repo } = folder;
  const notes =
    repo === undefined ? needsRepo("zambil check") : checkNotes(repo, { hookList: list, repoFlag });
  const similar =
    repo === undefined
      ? needsRepo("Similar notes")
      : checkSimilar(repo, { environment: config.environment, repoFlag });
  const [link, hooks, skill] = await Promise.all([
    checkZambilLink(zambilPath, { config }),
    checkHooks({ config, repo, zambilPath, hookList: list, repoFlag }),
    checkSkill({ config, repo, repoFlag }),
  ]);
  return [
    checkNode(options.nodeVersion),
    link,
    checkUserConfig(config, { repoFlag }),
    folder.result,
    notes,
    hooks,
    skill,
    similar,
  ];
}

const labelWidth = 6;
const indent = " ".repeat(labelWidth);

function formatResult(result: CheckResult): string[] {
  const label = result.level.padEnd(labelWidth);
  const lines = [`${label}${result.text}`];
  for (const detail of result.details ?? []) lines.push(`${indent}${detail}`);
  for (const fix of result.fixes ?? []) lines.push(`${indent}Fix: ${fix}`);
  return lines;
}

interface CountOptions {
  level: CheckLevel;
}

function countLevel(results: CheckResult[], options: CountOptions): number {
  return results.filter((result) => result.level === options.level).length;
}

function summary(results: CheckResult[]): string {
  const fails = countLevel(results, { level: "fail" });
  const warns = countLevel(results, { level: "warn" });
  if (fails > 0) {
    const problems = fails === 1 ? "1 problem" : `${fails} problems`;
    return `${problems} to fix. Run each Fix command above, then run zambil doctor again.`;
  }
  if (warns > 0) {
    const warnings = warns === 1 ? "1 warning" : `${warns} warnings`;
    return `Nothing to fix, but read the ${warnings} above.`;
  }
  return "Nothing to fix.";
}

/** The report that `zambil doctor` prints, one check per line, and the summary. */
export function formatReport(results: CheckResult[]): string {
  const lines = ["zambil doctor checks your setup. It changes nothing.", ""];
  for (const result of results) lines.push(...formatResult(result));
  lines.push("", summary(results), "");
  return lines.join("\n");
}

async function runDoctor(options: CommandRunOptions): Promise<ExitCode> {
  const { output } = options;
  const parsed = parseCommandArgs({ args: options.args, options: sharedOptions });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${doctorCommand.usage}\n`);
    return 2;
  }
  const repoFlag = parsed.value.values.repo;
  if (repoFlag?.trim() === "") {
    output.error(`--repo needs the path of a folder, but it is empty.\n${doctorCommand.usage}\n`);
    return 2;
  }
  const results = await runChecks(options, { repoFlag, nodeVersion: process.versions.node });
  output.write(formatReport(results));
  return results.some((result) => result.level === "fail") ? 1 : 0;
}

/** `zambil doctor`: reports the state of the whole setup and the command that fixes each problem. */
export const doctorCommand: Command = {
  summary: "Check the whole setup and print the command that fixes each problem.",
  usage: "Usage: zambil doctor [--repo <path>]",
  options: [repoOptionHelp],
  details: [
    "It checks Node, zambil on your PATH, the user config file, the notes folder and the notes, the Claude Code hooks and the zambil-save skill, and the model and the index for similar notes.",
    "It compares the hooks and the skill with what zambil install writes now, so it finds a note that names a new hook, or a notes folder or a clone that moved.",
    "It changes nothing and needs no network. It exits with 1 when something needs a fix.",
  ].join("\n"),
  run: runDoctor,
};
