import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { findOnPath } from "./find-on-path.ts";
import { linkHint } from "./link-hint.ts";
import { loadHookList } from "@zambil/claude-code/load-hook-list";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { rememberRepo } from "../user-config/remember-repo.ts";
import { reportProblems } from "./report-problems.ts";
import { setUpClaudeCode } from "./set-up-claude-code.ts";
import { sharedOptions } from "../parse-command-args.ts";

const installOptions = { ...sharedOptions, offline: { type: "boolean" } } as const;

async function runInstall(options: CommandRunOptions): Promise<ExitCode> {
  const { output, config } = options;
  const parsed = parseCommandArgs({ args: options.args, options: installOptions });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${installCommand.usage}\n`);
    return 2;
  }
  const flag = parsed.value.values.repo;
  const repo = openRepo({ flag, config });
  if (!repo.ok) {
    output.error(`${repo.error}\n`);
    return 2;
  }
  const zambilPath = findOnPath("zambil", { searchPath: config.searchPath ?? [] });
  if (zambilPath === undefined) {
    output.error(`${linkHint(config, { command: "zambil install" })}\n`);
    return 2;
  }
  const network = parsed.value.values.offline === true ? "offline" : "online";
  const setUp = await setUpClaudeCode(repo.value, { zambilPath, network, run: options });
  if (!setUp.ok) {
    output.error(`${setUp.error}\n`);
    return 1;
  }
  const remembered =
    flag === undefined ? "unchanged" : await rememberRepo(repo.value.root, { config, output });
  const { list } = loadHookList(config.environment);
  const level = reportProblems(repo.value, { hookList: list, output });
  output.write(
    "Start a new Claude Code session to load the hooks. Run zambil install again after a note names a new hook, or after you change the version of Node.\n",
  );
  const hasFailed = level === "errors" || remembered === "failed";
  return hasFailed ? 1 : 0;
}

/** `zambil install`: adds the zambil hooks and the zambil-save skill to the Claude Code settings. */
export const installCommand: Command = {
  summary: "Install the zambil hooks and the zambil-save skill in Claude Code.",
  usage: "Usage: zambil install [--repo <path>] [--offline]",
  details: [
    "It adds `zambil hook` at UserPromptSubmit and at each other hook that a note names, and keeps every other setting and hook.",
    "It reads the hook list from the Claude Code docs and indexes the notes, which downloads the model the first time.",
    "--offline skips both. --repo also saves the repo in the user config file. It reports the problems that `zambil check` finds, and exits with 1 for an error.",
    "It never changes a note. Run it again after a note names a new hook. `zambil uninstall` removes it.",
  ].join("\n"),
  run: runInstall,
};
