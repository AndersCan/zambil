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
    const names = missing.join(", ");
    if (missing.length > 0) {
      problems.push(
        `The notes for ${names} do not reach the agent, because no zambil hook runs there.`,
      );
    }
  }
  if (model === "missing") problems.push("Similar notes are off, because the model is missing.");
  return problems;
}
