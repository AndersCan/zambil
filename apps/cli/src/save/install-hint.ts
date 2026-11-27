import type { CliConfig } from "../config.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { hooksToInstall } from "@zambil/claude-code/hooks-to-install";
import { listZambilHooks } from "@zambil/claude-code/settings-hooks";
import { loadHookList } from "@zambil/claude-code/load-hook-list";
import type { Note } from "@zambil/core/note";
import { readSettings } from "../install/settings-file.ts";
import { settingsPath } from "../install/claude-paths.ts";
import { zambilCommand } from "../doctor/zambil-command.ts";

/** The repo after the save, the startup config, and the `--repo` flag for the command. */
export interface InstallHintOptions {
  repo: ConfigurationRepo;
  config: CliConfig;
  repoFlag: string | undefined;
}

/**
 * What to print when the note names a hook that install adds but that has no zambil hook in the Claude
 * Code settings yet. A hook that is already there, such as `SessionStart`, needs no install. Without
 * any zambil hook in the user settings, the hooks can come from project settings, so it says nothing.
 */
export async function installHint(
  note: Note,
  options: InstallHintOptions,
): Promise<string | undefined> {
  const { repo, config } = options;
  const { list } = loadHookList(config.environment);
  const expected = hooksToInstall(repo.notes, { hookList: list });
  const path = settingsPath(config);
  const settings = await readSettings(path);
  const installed = settings.ok ? listZambilHooks(settings.value) : settings;
  const isInstalledHere = installed.ok && Object.keys(installed.value).length > 0;
  if (!installed.ok || !isInstalledHere) return undefined;
  const missing: string[] = [];
  for (const hook of note.hooks) {
    const isMissing = expected.includes(hook) && !Object.hasOwn(installed.value, hook);
    if (isMissing) missing.push(hook);
  }
  if (missing.length === 0) return undefined;
  const names = missing.join(", ");
  const install = zambilCommand("install", { repoFlag: options.repoFlag });
  return [
    `The note names ${names}, but the zambil hooks in ${path} do not run there yet.`,
    `To connect it, the user runs: ${install}`,
    "Then the note reaches the agent from the next Claude Code session on.",
  ].join("\n");
}
