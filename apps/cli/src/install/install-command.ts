import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { downloadText, refreshHookList } from "@zambil/claude-code/refresh-hook-list";
import { readOptionalText, replaceText } from "./text-file.ts";
import { saveSkillPath, settingsPath } from "./claude-paths.ts";
import { changeSettings } from "./settings-file.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import { fileURLToPath } from "node:url";
import { findOnPath } from "./find-on-path.ts";
import { hookCommandLine } from "@zambil/claude-code/hook-command-line";
import { hooksToInstall } from "@zambil/claude-code/hooks-to-install";
import { installHooks } from "@zambil/claude-code/settings-hooks";
import { join } from "node:path";
import { loadHookList } from "@zambil/claude-code/load-hook-list";
import type { Note } from "@zambil/core/note";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { quoteArgument } from "@zambil/core/quote-argument";
import { right } from "@zambil/core/either";
import type { SaveResult } from "./settings-file.ts";
import { saveSkillText } from "@zambil/claude-code/save-skill";
import { sharedOptions } from "../parse-command-args.ts";

const installOptions = { ...sharedOptions, offline: { type: "boolean" } } as const;

function linkHint(): string {
  const main = quoteArgument(fileURLToPath(new URL("../main.ts", import.meta.url)));
  return [
    "zambil is not on your PATH, or its link points to a clone that moved. The agent runs zambil by name. Link it into a folder on your PATH, then run zambil install again:",
    "",
    `  mkdir -p ~/.local/bin && ln -sf ${main} ~/.local/bin/zambil`,
    "",
    "If ~/.local/bin is not on your PATH, add it in the profile of your shell.",
  ].join("\n");
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
  const { openNoteSearch } = await import("@zambil/embed/open-note-search");
  const noteSearch = await openNoteSearch(options.config.environment, {
    report: (message) => output.write(`${message}\n`),
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

async function runInstall(options: CommandRunOptions): Promise<ExitCode> {
  const { output, config } = options;
  const parsed = parseCommandArgs({ args: options.args, options: installOptions });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${installCommand.usage}\n`);
    return 2;
  }
  const repo = openRepo({ flag: parsed.value.values.repo, config });
  if (!repo.ok) {
    output.error(`${repo.error}\n`);
    return 2;
  }
  const zambilPath = findOnPath("zambil", { searchPath: config.searchPath ?? [] });
  if (zambilPath === undefined) {
    output.error(`${linkHint()}\n`);
    return 2;
  }
  const isOffline = parsed.value.values.offline === true;
  if (!isOffline) await refreshList(options);

  const { list } = loadHookList(config.environment);
  const hookNames = hooksToInstall(repo.value.notes, { hookList: list });
  const cacheHome = config.environment.cacheHome ?? join(config.environment.home, ".cache");
  const compileCache = join(cacheHome, "zambil", "node-compile-cache");
  const repoRoot = repo.value.root;
  const command = hookCommandLine({ zambilPath, repoRoot, compileCache });

  const path = settingsPath(config);
  const saved = await changeSettings(path, {
    change: (settings) => installHooks(settings, { command, hookNames }),
  });
  if (!saved.ok) {
    output.error(`zambil changed nothing in ${path}: ${saved.error}\n`);
    return 1;
  }
  const hookText = hookNames.join(", ");
  const hooks = `the zambil hooks (${hookText})`;
  const hooksMessage = describeSave(saved.value, {
    changed: `Installed ${hooks} in ${path}.`,
    unchanged: `In ${path}, ${hooks} are up to date.`,
  });
  output.write(`${hooksMessage}\n`);
  output.write(`The hooks read the configuration repo ${repoRoot}.\n`);
  const skipped = skippedHooks(repo.value.notes, { hookNames });
  if (skipped.length > 0) {
    const names = skipped.join(", ");
    output.write(`Skipped ${names}, because zambil never answers there. Run zambil check.\n`);
  }

  const skillPath = saveSkillPath(config);
  const skill = await saveSkill(skillPath, { repoRoot });
  if (!skill.ok) {
    output.error(`${skill.error}\n`);
    return 1;
  }
  const skillMessage = describeSave(skill.value, {
    changed: `Installed the zambil-save skill in ${skillPath}.`,
    unchanged: `The zambil-save skill in ${skillPath} is up to date.`,
  });
  output.write(`${skillMessage}\n`);

  if (isOffline) output.write("Skipped the hook list and the model, because of --offline.\n");
  else await indexNotes(repo.value, options);
  output.write(
    "Start a new Claude Code session to load the hooks. Run zambil install again after a note names a new hook.\n",
  );
  return 0;
}

/** `zambil install`: adds the zambil hooks and the zambil-save skill to the Claude Code settings. */
export const installCommand: Command = {
  summary: "Install the zambil hooks and the zambil-save skill in Claude Code.",
  usage: "Usage: zambil install [--repo <path>] [--offline]",
  details: [
    "It adds `zambil hook` at UserPromptSubmit and at each other hook that a note names, and keeps every other setting and hook.",
    "It reads the hook list from the Claude Code docs and indexes the notes, which downloads the model the first time.",
    "--offline skips both. It never changes a note. Run it again after a note names a new hook. `zambil uninstall` removes it.",
  ].join("\n"),
  run: runInstall,
};
