import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { answerHook } from "@zambil/claude-code/answer-hook";
import { loadHookList } from "@zambil/claude-code/load-hook-list";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { parseHookInput } from "@zambil/claude-code/parse-hook-input";
import { sharedOptions } from "../parse-command-args.ts";

/**
 * Claude Code reads exit code 2 as a blocking error, so every path exits with 0. A problem goes to
 * standard error, which Claude Code keeps out of the context.
 */
async function runHook(options: CommandRunOptions): Promise<ExitCode> {
  const { output } = options;
  const parsed = parseCommandArgs({ args: options.args, options: sharedOptions });
  if (!parsed.ok) {
    output.error(`zambil hook: ${parsed.error}\n${hookCommand.usage}\n`);
    return 0;
  }
  const { contextHooks } = loadHookList(options.config.environment).list;
  const request = parseHookInput(await options.input.readAll(), { contextHooks });
  if (!request.ok) {
    output.error(`zambil hook: ${request.error}\n`);
    return 0;
  }
  if (request.value.kind === "ignore") return 0;
  const repo = openRepo({ flag: parsed.value.values.repo, config: options.config });
  if (!repo.ok) {
    output.error(`zambil hook: ${repo.error}\n`);
    return 0;
  }
  output.write(answerHook(repo.value, { input: request.value.input, now: options.now }));
  return 0;
}

/** `zambil hook`: the command that a Claude Code hook runs. It reads the hook JSON on standard input. */
export const hookCommand: Command = {
  summary: "Add the matching notes to Claude Code's context. A Claude Code hook runs it.",
  usage: "Usage: zambil hook [--repo <path>] < hook-input.json",
  details: [
    "It reads the JSON that Claude Code sends to a hook on standard input, and prints the notes that apply.",
    "It prints nothing when no note applies, and it always exits with 0, so that it never blocks a session.",
    "Run `zambil install` to set up the hooks. The file packages/claude-code/README.md in the zambil repo describes them.",
  ].join("\n"),
  run: runHook,
};
