import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { createNotesFolder, folderState } from "./notes-folder.ts";
import type { CliConfig } from "../config.ts";
import type { Either } from "@zambil/core/either";
import { findOnPath } from "../install/find-on-path.ts";
import type { FolderState } from "./notes-folder.ts";
import { isNever } from "@zambil/core/is-never";
import { join } from "node:path";
import { left } from "@zambil/core/either";
import { linkHint } from "../install/link-hint.ts";
import { loadHookList } from "@zambil/claude-code/load-hook-list";
import { loadRepo } from "@zambil/core/load-repo";
import { locateRepo } from "@zambil/core/locate-repo";
import { parseCommandArgs } from "../parse-command-args.ts";
import { rememberRepo } from "../install/remember-repo.ts";
import type { RememberResult } from "../install/remember-repo.ts";
import { reportProblems } from "../install/report-problems.ts";
import { right } from "@zambil/core/either";
import { savedRepoPath } from "../install/user-config-file.ts";
import { setUpClaudeCode } from "../install/set-up-claude-code.ts";
import { sharedOptions } from "../parse-command-args.ts";
import { starterNoteName } from "./starter-note.ts";

const initOptions = {
  ...sharedOptions,
  offline: { type: "boolean" },
} as const;

/** The folder name in the home folder when the user names no folder and zambil knows no repo. */
const defaultFolderName = "zambil-notes";

/** `given` when the user named the folder, `known` when zambil already knew it, `default` otherwise. */
type FolderSource = "given" | "known" | "default";

interface NotesFolder {
  root: string;
  source: FolderSource;
}

interface ChooseFolderOptions {
  config: CliConfig;
}

function chooseFolder(
  given: string | undefined,
  options: ChooseFolderOptions,
): Either<string, NotesFolder> {
  const { environment } = options.config;
  if (given !== undefined) {
    const located = locateRepo({ flag: given, environment });
    if (!located.ok) return left("The notes folder needs a path, but it is empty.");
    return right({ root: located.value.root, source: "given" });
  }
  const saved = savedRepoPath(environment);
  if (saved !== undefined) return right({ root: saved, source: "known" });
  const known = locateRepo({ environment });
  if (known.ok) return right({ root: known.value.root, source: "known" });
  return right({ root: join(environment.home, defaultFolderName), source: "default" });
}

/** `saved-before`: the folder is empty, but it was the saved repo before, so the user deleted the note. */
type StarterOutcome = "written" | "has-files" | "saved-before";

interface StarterOutcomeOptions {
  remembered: RememberResult;
}

function starterOutcome(state: FolderState, options: StarterOutcomeOptions): StarterOutcome {
  if (state === "has-files") return "has-files";
  const isSavedBefore = state === "empty" && options.remembered === "unchanged";
  return isSavedBefore ? "saved-before" : "written";
}

interface DescribeFolderOptions {
  root: string;
}

function describeFolder(outcome: StarterOutcome, options: DescribeFolderOptions): string {
  const { root } = options;
  switch (outcome) {
    case "written":
      return `Wrote the starter note ${starterNoteName}.md in ${root}.`;
    case "has-files":
      return `Kept ${root} as it is. It already has files, so zambil wrote no starter note.`;
    case "saved-before":
      return `Kept ${root} as it is. It is already your notes folder, so zambil wrote no starter note.`;
    default:
      return isNever(outcome);
  }
}

interface NextStepsOptions {
  outcome: StarterOutcome;
  folder: NotesFolder;
}

function nextSteps(options: NextStepsOptions): string {
  const { outcome, folder } = options;
  const session =
    outcome === "written"
      ? `Start a new Claude Code session. Its first reply says that the ${starterNoteName} note reached it.`
      : "Start a new Claude Code session. Each note that names a hook reaches the agent at that hook.";
  const lines = [
    "",
    "Next:",
    `  1. ${session}`,
    '  2. Ask the agent for a note, for example: "Write a zambil note that we use pnpm, never npm."',
    `  3. Open ${folder.root} in Obsidian to read and edit the notes.`,
  ];
  lines.push("", "Run zambil init again after you change the version of Node.");
  if (folder.source !== "given") {
    lines.push("To keep the notes in another folder, run zambil init <folder>.");
  }
  lines.push("");
  return lines.join("\n");
}

/** The value of `--repo`, the other way to name the folder. */
interface GivenFolderOptions {
  repo: string | undefined;
}

function givenFolder(
  positionals: string[],
  options: GivenFolderOptions,
): Either<string, string | undefined> {
  const [folder, ...extra] = positionals;
  if (extra.length > 0) return left("zambil init takes one folder.");
  if (folder !== undefined && options.repo !== undefined) {
    return left("Give the notes folder once: as the argument or with --repo.");
  }
  return right(folder ?? options.repo);
}

async function runInit(options: CommandRunOptions): Promise<ExitCode> {
  const { output, config } = options;
  const parsed = parseCommandArgs({
    args: options.args,
    options: initOptions,
    allowPositionals: true,
  });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${initCommand.usage}\n`);
    return 2;
  }
  const { values, positionals } = parsed.value;
  const given = givenFolder(positionals, { repo: values.repo });
  if (!given.ok) {
    output.error(`${given.error}\n${initCommand.usage}\n`);
    return 2;
  }
  const folder = chooseFolder(given.value, { config });
  if (!folder.ok) {
    output.error(`${folder.error}\n${initCommand.usage}\n`);
    return 2;
  }
  const { root } = folder.value;
  const state = await folderState(root);
  if (!state.ok) {
    output.error(`${state.error}\n`);
    return 1;
  }
  if (state.value === "not-a-folder") {
    output.error(`${root} is a file, not a folder. Run zambil init <folder> with a folder.\n`);
    return 2;
  }
  const zambilPath = findOnPath("zambil", { searchPath: config.searchPath ?? [] });
  if (zambilPath === undefined) {
    output.error(`${linkHint(config, { command: "zambil init" })}\n`);
    return 2;
  }

  const remembered = await rememberRepo(root, { config, output });
  if (remembered === "failed") return 1;
  const outcome = starterOutcome(state.value, { remembered });
  const starter = outcome === "written" ? "write" : "skip";
  const created = await createNotesFolder(root, { starter });
  if (!created.ok) {
    output.error(`${created.error}\n`);
    return 1;
  }
  output.write(`${describeFolder(outcome, { root })}\n`);
  const repo = loadRepo(root);
  if (!repo.ok) {
    output.error(`zambil cannot read ${root}: ${repo.error.message}\n`);
    return 1;
  }

  const network = values.offline === true ? "offline" : "online";
  const setUp = await setUpClaudeCode(repo.value, { zambilPath, network, run: options });
  if (!setUp.ok) {
    output.error(`${setUp.error}\n`);
    return 1;
  }
  const { list } = loadHookList(config.environment);
  const level = reportProblems(repo.value, { hookList: list, output });
  output.write(nextSteps({ outcome, folder: folder.value }));
  return level === "errors" ? 1 : 0;
}

/** `zambil init`: sets up zambil for a new user in one run. */
export const initCommand: Command = {
  summary: "Set up zambil: a notes folder, the user config file and the Claude Code hooks.",
  usage: "Usage: zambil init [<folder>] [--offline]",
  details: [
    "It uses <folder> (or --repo <folder>), or the repo that zambil already knows, or ~/zambil-notes. It creates the folder if it is missing.",
    "In a new folder, it writes one starter note that shows up in the next Claude Code session. A folder with files, such as an Obsidian vault, stays as it is.",
    "It saves the folder in the user config file and keeps the other keys, then does what `zambil install` does and checks the notes.",
    "--offline skips the hook list and the model download. Run `zambil index` later for similar notes.",
    "It exits with 1 if a note has an error. The hooks are installed then too.",
    "It never changes a note, and it never asks a question, so it runs the same without a terminal. Run it again at any time.",
  ].join("\n"),
  run: runInit,
};
