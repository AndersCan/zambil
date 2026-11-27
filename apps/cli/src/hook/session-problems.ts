import { checkModel } from "@zambil/embed/check-search-files";
import type { CliConfig } from "../config.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { HookList } from "@zambil/claude-code/hook-list";
import { hooksToInstall } from "@zambil/claude-code/hooks-to-install";
import { listZambilHooks } from "@zambil/claude-code/settings-hooks";
import type { ModelState } from "@zambil/embed/check-search-files";
import { readSettings } from "../install/settings-file.ts";
import { settingsPath } from "../install/claude-paths.ts";

/** The startup config, the hook list in use, and the hook that runs now, which is installed. */
export interface SessionProblemsOptions {
  config: CliConfig;
  hookList: HookList;
  hookEventName: string;
}

function needsModel(repo: ConfigurationRepo, options: SessionProblemsOptions): Promise<ModelState> {
  const hasDescription = repo.notes.some((note) => note.description !== undefined);
  if (!hasDescription) return Promise.resolve("ready");
  return checkModel({ environment: options.config.environment });
}

/**
 * The problems that make notes drop out of a session without a sign: a hook that a note needs and
 * that is not installed, and a missing model. It reads one settings file and two file sizes, so that
 * the hook stays fast. `zambil doctor` checks the rest.
 */
export async function findSessionProblems(
  repo: ConfigurationRepo,
  options: SessionProblemsOptions,
): Promise<string[]> {
  const [settings, model] = await Promise.all([
    readSettings(settingsPath(options.config)),
    needsModel(repo, options),
  ]);
  const problems: string[] = [];
  const hooks = settings.ok ? listZambilHooks(settings.value) : settings;
  if (hooks.ok) {
    const expected = hooksToInstall(repo.notes, { hookList: options.hookList });
    const missing = expected.filter(
      (hook) => hook !== options.hookEventName && hooks.value[hook] === undefined,
    );
    const names = missing.join(", ");
    if (missing.length > 0) problems.push(`No zambil hook runs at ${names}, so notes go missing.`);
  } else {
    problems.push(`zambil cannot read the Claude Code settings: ${hooks.error}.`);
  }
  if (model === "missing") problems.push("Similar notes are off, because the model is missing.");
  return problems;
}
