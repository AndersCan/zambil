import { changesSince, isNewerVersion } from "./changes-since.ts";
import type { Command, CommandOutput, CommandRunOptions, ExitCode } from "../command.ts";
import { dirname, join } from "node:path";
import { parseCommandArgs, sharedOptions } from "../parse-command-args.ts";
import { readFile, realpath } from "node:fs/promises";
import type { CliConfig } from "../config.ts";
import { execFile } from "node:child_process";
import { findOnPath } from "../install/find-on-path.ts";
import { installScriptUrl } from "@zambil/claude-code/install-script-command";
import type { InstallState } from "./read-install.ts";
import { promisify } from "node:util";
import { quoteArgument } from "@zambil/core/quote-argument";
import { readInstall } from "./read-install.ts";
import { runProgram } from "./run-program.ts";
import { wrap } from "@zambil/core/either";

const runFile = promisify(execFile);
const commitLimit = 20;

interface LinkOptions {
  entry: string;
}

/** Whether the path is a link to the `main.ts` of this clone, not that file itself. */
async function isLinkToClone(path: string, options: LinkOptions): Promise<boolean> {
  const linked = await wrap(realpath(path));
  return linked.ok && linked.value === options.entry && linked.value !== path;
}

/**
 * The folder of the link that runs this clone, so that install.sh keeps that link and makes no other
 * one: the link that started zambil, or else the `zambil` on the `PATH`.
 */
async function linkFolder(root: string, config: CliConfig): Promise<string | undefined> {
  const entry = await wrap(realpath(join(root, "apps/cli/src/main.ts")));
  if (!entry.ok) return undefined;
  const found = findOnPath("zambil", { searchPath: config.searchPath ?? [] });
  const candidates: string[] = [];
  if (config.commandPath !== undefined) candidates.push(config.commandPath);
  if (found !== undefined) candidates.push(found);
  const checks = await Promise.all(
    candidates.map((path) => isLinkToClone(path, { entry: entry.value })),
  );
  for (const [position, path] of candidates.entries()) {
    if (checks[position] === true) return dirname(path);
  }
  return undefined;
}

/** The folder of the `zambil` link to keep, if one runs this clone. */
interface InstallCommandOptions {
  binFolder: string | undefined;
}

/** The shell line that runs install.sh from standard input for this clone, and its arguments. */
function installCommand(root: string, options: InstallCommandOptions): string[] {
  if (options.binFolder === undefined) {
    return ["sh", "-c", 'ZAMBIL_HOME="$1" exec sh', "zambil-update", root];
  }
  const line = 'ZAMBIL_HOME="$1" ZAMBIL_BIN_DIR="$2" exec sh';
  return ["sh", "-c", line, "zambil-update", root, options.binFolder];
}

interface ChangeOptions {
  root: string;
  after: InstallState;
}

async function commitLines(before: InstallState, options: ChangeOptions): Promise<string[]> {
  const gitDir = `--git-dir=${join(options.root, ".git")}`;
  const range = `${before.commit}..${options.after.commit}`;
  const listed = await wrap(runFile("git", [gitDir, "log", "--format=  %h %s", range]));
  const text = listed.ok ? listed.value.stdout.trimEnd() : "";
  if (text === "") return [];
  const lines = text.split("\n");
  const shown = lines.slice(0, commitLimit);
  const hidden = lines.length - commitLimit;
  const noun = hidden === 1 ? "commit" : "commits";
  if (hidden > 0) shown.push(`  and ${hidden} more ${noun}.`);
  return ["The new commits:", ...shown];
}

/**
 * What to print about the change: the new sections of the changelog, or the new commits on a branch.
 * A move back to an older version lists nothing as new.
 */
async function describeChanges(before: InstallState, options: ChangeOptions): Promise<string[]> {
  const { root, after } = options;
  if (after.commit === before.commit) return [];
  if (isNewerVersion(before.version, { than: after.version })) {
    return [
      `zambil went back from ${before.version} to ${after.version}.`,
      "The next zambil update without ZAMBIL_GIT_REF installs the newest release again.",
    ];
  }
  if (after.version === before.version) return commitLines(before, options);
  const changelog = await wrap(readFile(join(root, "CHANGELOG.md"), "utf8"));
  const sections = changelog.ok ? changesSince(changelog.value, before) : [];
  if (sections.length === 0) return commitLines(before, options);
  const text = sections.join("\n\n");
  return [`What changed since ${before.version}:`, "", text];
}

interface DoctorOptions {
  repoFlag: string | undefined;
  output: CommandOutput;
}

/** Runs `zambil doctor` from the files on disk, because this process still holds the code from before the update. */
function runDoctor(root: string, options: DoctorOptions): Promise<number> {
  const command = [process.execPath, join(root, "apps/cli/src/main.ts"), "doctor"];
  if (options.repoFlag !== undefined) command.push("--repo", options.repoFlag);
  return runProgram(command, { input: "", output: options.output });
}

function reinstallLine(
  root: string,
  options: InstallCommandOptions = { binFolder: undefined },
): string {
  const home = `ZAMBIL_HOME=${quoteArgument(root)}`;
  const bin =
    options.binFolder === undefined ? "" : ` ZAMBIL_BIN_DIR=${quoteArgument(options.binFolder)}`;
  return `If zambil update does not start, run the install command: curl -fsSL ${installScriptUrl} | ${home}${bin} sh`;
}

interface FinishOptions {
  root: string;
  command: string[];
  oldScript: string;
  before: InstallState;
  output: CommandOutput;
}

/**
 * The old install.sh moved the clone, then installed it with its own rules. When the new tree has
 * another install.sh, or the first run failed after the move, the new script runs once more. So a
 * release can change how it is installed, and an older release still updates to it.
 */
async function finishWithNewScript(firstCode: number, options: FinishOptions): Promise<number> {
  const { root, output } = options;
  const [moved, newScript] = await Promise.all([
    readInstall(root),
    wrap(readFile(join(root, "install.sh"), "utf8")),
  ]);
  const hasMoved = moved.ok && moved.value.commit !== options.before.commit;
  if (!hasMoved || !newScript.ok) return firstCode;
  const isSameScript = newScript.value === options.oldScript;
  if (isSameScript && firstCode === 0) return firstCode;
  output.write(
    "\nThe new version has another install.sh. zambil runs it once more to finish the install.\n",
  );
  return runProgram(options.command, { input: newScript.value, output });
}

interface PrintChangesOptions {
  root: string;
  output: CommandOutput;
}

async function printChanges(before: InstallState, options: PrintChangesOptions): Promise<void> {
  const { root, output } = options;
  const after = await readInstall(root);
  if (!after.ok) return;
  const lines = await describeChanges(before, { root, after: after.value });
  const changes = lines.join("\n");
  if (lines.length > 0) output.write(`\n${changes}\n`);
}

function developmentClone(root: string): string {
  return [
    `zambil update did not run, because ${root} is a development clone: its development dependencies are installed.`,
    "zambil update runs install.sh, which removes them. To update this clone, run:",
    "",
    `  git -C ${quoteArgument(root)} pull --ff-only && pnpm --dir ${quoteArgument(root)} install`,
  ].join("\n");
}

async function runUpdate(options: CommandRunOptions): Promise<ExitCode> {
  const { output, config } = options;
  const parsed = parseCommandArgs({ args: options.args, options: sharedOptions });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${updateCommand.usage}\n`);
    return 2;
  }
  const root = config.zambilFolder;
  if (root === undefined) {
    output.error("zambil update did not run, because zambil cannot tell which clone runs.\n");
    return 1;
  }
  const before = await readInstall(root);
  if (!before.ok) {
    output.error(`zambil update did not run, because ${before.error}\n`);
    output.error(`To install zambil again, run: curl -fsSL ${installScriptUrl} | sh\n`);
    return 1;
  }
  if (before.value.kind === "development") {
    output.error(`${developmentClone(root)}\n`);
    return 1;
  }
  const [script, binFolder] = await Promise.all([
    wrap(readFile(join(root, "install.sh"), "utf8")),
    linkFolder(root, config),
  ]);
  if (!script.ok) {
    output.error(`zambil update did not run, because ${root} has no install.sh.\n`);
    output.error(`${reinstallLine(root)}\n`);
    return 1;
  }
  const command = installCommand(root, { binFolder });
  const first = await runProgram(command, { input: script.value, output });
  const installed = await finishWithNewScript(first, {
    root,
    command,
    oldScript: script.value,
    before: before.value,
    output,
  });
  if (installed !== 0) {
    await printChanges(before.value, { root, output });
    output.error(
      `The update did not finish. When you fixed the problem above, run zambil update again.\n`,
    );
    output.error(`${reinstallLine(root, { binFolder })}\n`);
    return 1;
  }
  await printChanges(before.value, { root, output });
  output.write("\n");
  const repoFlag = parsed.value.values.repo;
  const checked = await runDoctor(root, { repoFlag, output });
  return checked === 0 ? 0 : 1;
}

/** `zambil update`: update the clone with its install.sh, print what changed, and check the setup. */
export const updateCommand: Command = {
  summary: "Update zambil to the newest release, print what changed, and run zambil doctor.",
  usage: "Usage: zambil update [--repo <path>]",
  details: [
    "It runs the install.sh of this clone, so it follows the same rules as the install command.",
    "Set ZAMBIL_GIT_REF to install one release, for example `ZAMBIL_GIT_REF=v0.1.0 zambil update`, or to follow a branch such as main.",
    "It exits with 1 when the update fails or zambil doctor finds a problem.",
  ].join("\n"),
  options: [
    { flag: "--repo <path>", text: "The notes folder that zambil doctor checks after the update." },
  ],
  run: runUpdate,
};
