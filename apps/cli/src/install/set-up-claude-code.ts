import { downloadText, refreshHookList } from "@zambil/claude-code/refresh-hook-list";
import { left, right, wrap } from "@zambil/core/either";
import { readOptionalText, replaceText } from "./text-file.ts";
import { saveSkillPath, settingsPath } from "./claude-paths.ts";
import { changeSettings } from "./settings-file.ts";
import type { CommandRunOptions } from "../command.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import { hooksToInstall } from "@zambil/claude-code/hooks-to-install";
import { installHookCommand } from "./install-hook-command.ts";
import { installHooks } from "@zambil/claude-code/settings-hooks";
import { isNever } from "@zambil/core/is-never";
import { loadHookList } from "@zambil/claude-code/load-hook-list";
import type { Note } from "@zambil/core/note";
import type { SaveResult } from "./settings-file.ts";
import { saveSkillText } from "@zambil/claude-code/save-skill";

/** `offline` skips the hook list from the Claude Code docs and the model download. */
export type NetworkMode = "online" | "offline";

/** The full path of `zambil` on the `PATH`, the network mode, and what the command got. */
export interface SetUpClaudeCodeOptions {
  zambilPath: string;
  network: NetworkMode;
  run: CommandRunOptions;
}

async function refreshList(options: CommandRunOptions): Promise<void> {
  const { output } = options;
  const refreshed = await refreshHookList(options.config.environment, {
    download: downloadText,
    now: options.now,
  });
  if (refreshed.ok) {
    const { hooks, contextHooks, source } = refreshed.value;
    output.write(
      `Read the hook list from ${source}: ${hooks.length} hooks, ${contextHooks.length} of them can add context.\n`,
    );
    return;
  }
  const { list } = loadHookList(options.config.environment);
  output.error(
    `zambil cannot refresh the hook list, so it uses the list of ${list.readOn}: ${refreshed.error}\n`,
  );
}

interface SkillOptions {
  repoRoot: string;
}

async function saveSkill(path: string, options: SkillOptions): Promise<Either<string, SaveResult>> {
  const text = saveSkillText(options);
  const before = await readOptionalText(path);
  if (before.ok && before.value === text) return right("unchanged");
  const written = await replaceText(path, { text });
  if (!written.ok) return written;
  return right("changed");
}

async function indexNotes(repo: ConfigurationRepo, options: CommandRunOptions): Promise<void> {
  const { output } = options;
  const loaded = await wrap(import("@zambil/embed/open-note-search"));
  if (!loaded.ok) {
    output.error(
      `zambil cannot load the embedder for similar notes: ${String(loaded.error)}\nThe hooks work without it.\n`,
    );
    return;
  }
  const noteSearch = await loaded.value.openNoteSearch(options.config.environment, {
    report: (message) => output.write(`${message}\n`),
    download: "allow",
  });
  const summary = noteSearch.ok ? await noteSearch.value.index(repo) : noteSearch;
  if (!summary.ok) {
    output.error(
      `zambil cannot index the notes for similar notes: ${summary.error}\nRun \`zambil index\` when you are online.\n`,
    );
    return;
  }
  const { descriptions, path } = summary.value;
  output.write(`Indexed ${descriptions} descriptions for similar notes in ${path}.\n`);
}

/** The message for a file that changed, and for a file that already held the change. */
interface DescribeSaveOptions {
  changed: string;
  unchanged: string;
}

function describeSave(result: SaveResult, options: DescribeSaveOptions): string {
  return result === "changed" ? options.changed : options.unchanged;
}

interface SkippedHooksOptions {
  hookNames: string[];
}

/** The hook names in the notes that install leaves out, because zambil never answers them. */
function skippedHooks(notes: Note[], options: SkippedHooksOptions): string[] {
  const skipped = new Set<string>();
  for (const note of notes) {
    for (const hook of note.hooks) {
      if (!options.hookNames.includes(hook)) skipped.add(hook);
    }
  }
  return [...skipped];
}

interface InstallHandlersOptions {
  zambilPath: string;
  run: CommandRunOptions;
}

async function installHandlers(
  repo: ConfigurationRepo,
  options: InstallHandlersOptions,
): Promise<Either<string, undefined>> {
  const { config, output } = options.run;
  const { list } = loadHookList(config.environment);
  const hookNames = hooksToInstall(repo.notes, { hookList: list });
  const { zambilPath } = options;
  const command = await installHookCommand(repo.root, { config, zambilPath });
  const path = settingsPath(config);
  const saved = await changeSettings(path, {
    change: (settings) => installHooks(settings, { command, hookNames }),
  });
  if (!saved.ok) return left(`zambil changed nothing in ${path}: ${saved.error}`);
  const hookText = hookNames.join(", ");
  const hooks = `the zambil hooks (${hookText})`;
  const hooksMessage = describeSave(saved.value, {
    changed: `Installed ${hooks} in ${path}.`,
    unchanged: `In ${path}, ${hooks} are up to date.`,
  });
  output.write(`${hooksMessage}\n`);
  output.write(`The hooks read the configuration repo ${repo.root}.\n`);
  const skipped = skippedHooks(repo.notes, { hookNames });
  if (skipped.length > 0) {
    const names = skipped.join(", ");
    output.write(`Skipped ${names}, because zambil never answers there.\n`);
  }
  return right(undefined);
}

/** Online, it refreshes the hook list, because the hooks to install depend on it. */
async function refreshStep(options: SetUpClaudeCodeOptions): Promise<void> {
  switch (options.network) {
    case "online":
      await refreshList(options.run);
      return;
    case "offline":
      options.run.output.write(
        "Skipped the hook list and the model, because of --offline. Run this command again when you are online.\n",
      );
      return;
    default:
      isNever(options.network);
  }
}

/** Online, it indexes the notes last, so that a slow model download never holds back the hooks. */
async function indexStep(repo: ConfigurationRepo, options: SetUpClaudeCodeOptions): Promise<void> {
  switch (options.network) {
    case "online":
      await indexNotes(repo, options.run);
      return;
    case "offline":
      return;
    default:
      isNever(options.network);
  }
}

/**
 * Adds the zambil hooks and the zambil-save skill to Claude Code. Online, it also refreshes the hook
 * list first and indexes the notes last. It never changes a note. A failed refresh or index is
 * reported, not an error.
 */
export async function setUpClaudeCode(
  repo: ConfigurationRepo,
  options: SetUpClaudeCodeOptions,
): Promise<Either<string, undefined>> {
  const { run } = options;
  await refreshStep(options);
  const handlers = await installHandlers(repo, options);
  if (!handlers.ok) return handlers;

  const skillPath = saveSkillPath(run.config);
  const skill = await saveSkill(skillPath, { repoRoot: repo.root });
  if (!skill.ok) return skill;
  const skillMessage = describeSave(skill.value, {
    changed: `Installed the zambil-save skill in ${skillPath}.`,
    unchanged: `The zambil-save skill in ${skillPath} is up to date.`,
  });
  run.output.write(`${skillMessage}\n`);
  await indexStep(repo, options);
  return right(undefined);
}
