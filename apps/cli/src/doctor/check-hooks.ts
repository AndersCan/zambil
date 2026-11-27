import { listZambilHooks, listZambilMatchers } from "@zambil/claude-code/settings-hooks";
import type { CheckResult } from "./check-result.ts";
import type { CliConfig } from "../config.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { existsSync } from "node:fs";
import type { HookList } from "@zambil/claude-code/hook-list";
import { hooksToInstall } from "@zambil/claude-code/hooks-to-install";
import { installHookCommand } from "../install/install-hook-command.ts";
import { isAbsolute } from "node:path";
import type { Note } from "@zambil/core/note";
import { parseHookCommand } from "./parse-hook-command.ts";
import { readSettings } from "../install/settings-file.ts";
import { settingsPath } from "../install/claude-paths.ts";
import { toolMatchers } from "@zambil/claude-code/tool-matchers";
import { zambilCommand } from "./zambil-command.ts";

/** What the hooks must match: the repo, `zambil` on the `PATH` and the hook list, when they are known. */
export interface CheckHooksOptions {
  config: CliConfig;
  repo: ConfigurationRepo | undefined;
  zambilPath: string | undefined;
  hookList: HookList;
  repoFlag: string | undefined;
}

interface WhyOptions {
  notes: Note[];
}

function whyInstalled(hook: string, options: WhyOptions): string {
  const note = options.notes.find((candidate) => candidate.hooks.includes(hook));
  if (note !== undefined) return `the note ${note.path} names it`;
  const subagentReason = "zambil always installs it, so that subagents get the SessionStart notes";
  if (hook === "SubagentStart") return subagentReason;
  return "zambil always installs it";
}

interface EventProblemsOptions {
  repo: ConfigurationRepo;
  hookList: HookList;
  matchers: Record<string, string | undefined>;
}

/** The tools of a matcher, for a message. */
function describeTools(matcher: string | undefined): string {
  return matcher === undefined ? "every tool" : matcher.split("|").join(", ");
}

/** The hooks that install would add or remove now, for example after a note names a new hook. */
function eventProblems(events: string[], options: EventProblemsOptions): string[] {
  const { repo, hookList } = options;
  const expected = hooksToInstall(repo.notes, { hookList });
  const problems: string[] = [];
  for (const hook of expected) {
    if (events.includes(hook)) continue;
    const why = whyInstalled(hook, { notes: repo.notes });
    problems.push(`${hook} has no zambil hook, but ${why}.`);
  }
  for (const hook of events) {
    if (expected.includes(hook)) continue;
    problems.push(`zambil hook runs at ${hook}, but zambil install no longer adds it there.`);
  }
  const needed = toolMatchers(repo.notes, { hookNames: expected });
  for (const hook of events) {
    const isStale = expected.includes(hook) && options.matchers[hook] !== needed[hook];
    if (!isStale) continue;
    const now = describeTools(options.matchers[hook]);
    const tools = describeTools(needed[hook]);
    problems.push(`zambil hook runs at ${hook} for ${now}, but the notes need it for ${tools}.`);
  }
  return problems;
}

interface CommandProblemsOptions {
  repo: ConfigurationRepo | undefined;
  expected: string | undefined;
}

/** Why one installed command line does not work, or differs from the one that install writes now. */
function commandProblems(command: string, options: CommandProblemsOptions): string[] {
  const { repo, expected } = options;
  if (command === expected) return [];
  const { zambilPath, repoRoot } = parseHookCommand(command);
  const problems: string[] = [];
  const isMissingZambil =
    zambilPath !== undefined && isAbsolute(zambilPath) && !existsSync(zambilPath);
  if (isMissingZambil) problems.push(`The hooks run ${zambilPath}, which does not exist.`);
  if (repoRoot === undefined) {
    problems.push("The hooks run zambil hook without --repo, the way an older zambil wrote them.");
  } else if (!existsSync(repoRoot)) {
    problems.push(`The hooks read the notes folder ${repoRoot}, which does not exist.`);
  } else if (repo !== undefined && repoRoot !== repo.root) {
    problems.push(`The hooks read the notes folder ${repoRoot}, but zambil now uses ${repo.root}.`);
  }
  if (problems.length > 0 || expected === undefined) return problems;
  return [
    "The hooks run another command than zambil install writes now, for example for another Node.",
    `Now: ${command}`,
    `Install writes: ${expected}`,
  ];
}

function expectedCommand(options: CheckHooksOptions): Promise<string | undefined> {
  const { repo, zambilPath, config } = options;
  if (repo === undefined || zambilPath === undefined) return Promise.resolve(undefined);
  return installHookCommand(repo.root, { config, zambilPath });
}

/** Whether the zambil hooks in the Claude Code settings point at paths that exist and match what install writes now. */
export async function checkHooks(options: CheckHooksOptions): Promise<CheckResult> {
  const { config, repo, hookList } = options;
  const path = settingsPath(config);
  const install = zambilCommand("install", options);
  const settings = await readSettings(path);
  const hooks = settings.ok ? listZambilHooks(settings.value) : settings;
  if (!hooks.ok) {
    return {
      level: "fail",
      text: `zambil cannot read the Claude Code settings ${path}: ${hooks.error}.`,
    };
  }
  const events = Object.keys(hooks.value);
  if (events.length === 0) {
    const text = `${path} has no zambil hook, so no note reaches Claude Code.`;
    return { level: "fail", text, fixes: [install] };
  }
  const expected = await expectedCommand(options);
  const listed = settings.ok ? listZambilMatchers(settings.value) : settings;
  const matchers = listed.ok ? listed.value : {};
  const problems = new Set(
    repo === undefined ? [] : eventProblems(events, { repo, hookList, matchers }),
  );
  for (const command of new Set(Object.values(hooks.value).flat())) {
    for (const problem of commandProblems(command, { repo, expected })) problems.add(problem);
  }
  const eventText = events.join(", ");
  if (problems.size > 0) {
    return {
      level: "fail",
      text: `The zambil hooks in ${path} do not match what zambil install writes now.`,
      details: [...problems],
      fixes: [install],
    };
  }
  if (repo === undefined || options.zambilPath === undefined) {
    return {
      level: "skip",
      text: `The zambil hooks in ${path} run at ${eventText}. zambil cannot compare them with what install writes until the problems above are fixed.`,
    };
  }
  return { level: "ok", text: `The zambil hooks in ${path} are up to date: ${eventText}.` };
}
