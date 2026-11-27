import type { Command, CommandOutput, CommandRunOptions, ExitCode } from "../command.ts";
import { dirname, join } from "node:path";
import { parseCommandArgs, sharedOptions } from "../parse-command-args.ts";
import { readFile, realpath } from "node:fs/promises";
import { changesSince } from "./changes-since.ts";
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

/** The folder of the `zambil` on the `PATH` when it runs this clone, so that install.sh keeps that link. */
async function linkFolder(root: string, config: CliConfig): Promise<string | undefined> {
  const found = findOnPath("zambil", { searchPath: config.searchPath ?? [] });
  if (found === undefined) return undefined;
  const [linked, entry] = await Promise.all([
    wrap(realpath(found)),
    wrap(realpath(join(root, "apps/cli/src/main.ts"))),
  ]);
  const isThisClone = linked.ok && entry.ok && linked.value === entry.value;
  return isThisClone ? dirname(found) : undefined;
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
  if (!listed.ok) return [];
  const lines = listed.value.stdout.trimEnd().split("\n");
  const shown = lines.slice(0, commitLimit);
  const hidden = lines.length - commitLimit;
  if (hidden > 0) shown.push(`  and ${hidden} more commits.`);
  return ["The new commits:", ...shown];
}

/** What to print about the change: the new sections of the changelog, or the new commits on a branch. */
async function describeChanges(before: InstallState, options: ChangeOptions): Promise<string[]> {
  const { root, after } = options;
  if (after.commit === before.commit) return [];
  if (after.version === before.version) return commitLines(before, options);
  const changelog = await wrap(readFile(join(root, "CHANGELOG.md"), "utf8"));
  const sections = changelog.ok ? changesSince(changelog.value, before) : [];
  if (sections.length === 0) return commitLines(before, options);
  return [`What changed since ${before.version}:`, "", ...sections];
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
  const root = config.zambilFolder ?? "";
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
  const input = script.ok ? script.value : "";
  const installed = await runProgram(installCommand(root, { binFolder }), { input, output });
  if (installed !== 0) {
    output.error("zambil did not update. install.sh printed the reason above.\n");
    return 1;
  }
  const after = await readInstall(root);
  if (after.ok) {
    const lines = await describeChanges(before.value, { root, after: after.value });
    const changes = lines.join("\n");
    if (lines.length > 0) output.write(`\n${changes}\n`);
  }
  output.write("\nzambil doctor checks the setup:\n");
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
    "Set ZAMBIL_GIT_REF to install one release, or to follow a branch such as main.",
  ].join("\n"),
  options: [
    { flag: "--repo <path>", text: "The notes folder that zambil doctor checks after the update." },
  ],
  run: runUpdate,
};
