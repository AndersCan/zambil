import { isMatchedHook, matcherCovers, toolMatchers } from "@zambil/claude-code/tool-matchers";
import { listZambilHooks, listZambilMatchers } from "@zambil/claude-code/settings-hooks";
import { checkModel } from "@zambil/embed/check-search-files";
import type { CliConfig } from "../config.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { HookList } from "@zambil/claude-code/hook-list";
import { hooksToInstall } from "@zambil/claude-code/hooks-to-install";
import type { ModelState } from "@zambil/embed/check-search-files";
import type { Note } from "@zambil/core/note";
import { readSettings } from "../install/settings-file.ts";
import { searchTextsOf } from "@zambil/core/search-texts";
import { settingsPath } from "../install/claude-paths.ts";

/** The startup config, the hook list in use, and the hook that runs now, which is installed. */
export interface SessionProblemsOptions {
  config: CliConfig;
  hookList: HookList;
  hookEventName: string;
}

function needsModel(repo: ConfigurationRepo, options: SessionProblemsOptions): Promise<ModelState> {
  const hasSearchText = repo.notes.some((note) => searchTextsOf(note).length > 0);
  if (!hasSearchText) return Promise.resolve("ready");
  return checkModel({ environment: options.config.environment });
}

const subagentStart = "SubagentStart";

interface NarrowHooksOptions {
  notes: Note[];
  installed: Record<string, string | undefined>;
}

/** The installed tool hooks whose matcher leaves out a tool that a note needs. */
function narrowHooks(expected: string[], options: NarrowHooksOptions): string[] {
  const needed = toolMatchers(options.notes, { hookNames: expected });
  const narrow: string[] = [];
  for (const [hook, matcher] of Object.entries(options.installed)) {
    const isNeeded = isMatchedHook(hook) && expected.includes(hook);
    if (isNeeded && !matcherCovers(matcher, { needed: needed[hook] })) narrow.push(hook);
  }
  return narrow;
}

function narrowHookProblems(narrow: string[]): string[] {
  if (narrow.length === 0) return [];
  const names = narrow.join(", ");
  return [
    `Some notes for ${names} do not reach the agent, because the zambil hook there runs only for some tools.`,
  ];
}

interface MissingHookOptions {
  notes: Note[];
}

/**
 * `SubagentStart` also carries the `SessionStart` notes to subagents. Without a note that names it, it
 * matters only when a `SessionStart` note exists.
 */
function missingHookProblems(missing: string[], options: MissingHookOptions): string[] {
  const problems: string[] = [];
  const { notes } = options;
  const namesSubagentStart = notes.some((note) => note.hooks.includes(subagentStart));
  const hasSessionNote = notes.some((note) => note.hooks.includes("SessionStart"));
  const isOwnLine = namesSubagentStart && !hasSessionNote;
  const lost = missing.filter((hook) => hook !== subagentStart || isOwnLine);
  if (lost.length > 0) {
    const names = lost.join(", ");
    problems.push(
      `The notes for ${names} do not reach the agent, because no zambil hook runs there.`,
    );
  }
  if (missing.includes(subagentStart) && hasSessionNote) {
    problems.push(
      "Subagents get no SessionStart notes, because no zambil hook runs at SubagentStart.",
    );
  }
  return problems;
}

/**
 * The problems that make notes drop out of a session without a sign: a hook that a note needs and
 * that is not installed, and a missing model. It reads one settings file and two file sizes, so that
 * the hook stays fast. Settings without a zambil hook mean that it runs from other settings, such as
 * those of a project, so they give no warning. `zambil doctor` checks the rest.
 */
export async function findSessionProblems(
  repo: ConfigurationRepo,
  options: SessionProblemsOptions,
): Promise<string[]> {
  const path = settingsPath(options.config);
  const [settings, model] = await Promise.all([readSettings(path), needsModel(repo, options)]);
  const problems: string[] = [];
  const hooks = settings.ok ? listZambilHooks(settings.value) : settings;
  if (!hooks.ok) problems.push(`The Claude Code settings ${path} cannot be read.`);
  const isInstalledHere = hooks.ok && Object.keys(hooks.value).length > 0;
  if (hooks.ok && isInstalledHere) {
    const expected = hooksToInstall(repo.notes, { hookList: options.hookList });
    const missing = expected.filter(
      (hook) => hook !== options.hookEventName && hooks.value[hook] === undefined,
    );
    problems.push(...missingHookProblems(missing, { notes: repo.notes }));
    const installed = settings.ok ? listZambilMatchers(settings.value) : settings;
    if (installed.ok) {
      const narrow = narrowHooks(expected, { notes: repo.notes, installed: installed.value });
      problems.push(...narrowHookProblems(narrow));
    }
  }
  if (model === "missing") problems.push("Similar notes are off, because the model is missing.");
  return problems;
}
