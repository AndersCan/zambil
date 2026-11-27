import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { answerHook } from "@zambil/claude-code/answer-hook";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { findSimilarNotes } from "@zambil/claude-code/find-similar-notes";
import { indexHint } from "../index/index-hint.ts";
import { loadHookList } from "@zambil/claude-code/load-hook-list";
import type { Note } from "@zambil/core/note";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { parseHookInput } from "@zambil/claude-code/parse-hook-input";
import { sharedOptions } from "../parse-command-args.ts";

interface SimilarToOptions extends CommandRunOptions {
  prompt: string;
  repoFlag: string | undefined;
}

/**
 * The notes similar to the prompt. A missing model or index is a message on standard error, and the
 * hook still adds the other notes.
 */
async function similarTo(repo: ConfigurationRepo, options: SimilarToOptions): Promise<Note[]> {
  const { output } = options;
  const similar = await findSimilarNotes(repo, {
    prompt: options.prompt,
    now: options.now,
    environment: options.config.environment,
  });
  const hint = indexHint(options.repoFlag);
  if (!similar.ok) {
    const { kind, message } = similar.error;
    const next = kind === "no-model" ? ` Run \`${hint}\`.` : "";
    output.error(`zambil hook: no similar notes, because ${message}.${next}\n`);
    return [];
  }
  const { matches, skipped } = similar.value;
  if (skipped > 0) {
    const count = skipped === 1 ? "1 description" : `${skipped} descriptions`;
    output.error(
      `zambil hook: the similarity match left out the notes of ${count} that are not in the index. Run \`${hint}\`.\n`,
    );
  }
  return matches.map((match) => match.note);
}

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
  const { input } = request.value;
  const repoFlag = parsed.value.values.repo;
  const similarNotes =
    input.kind === "prompt"
      ? await similarTo(repo.value, { ...options, prompt: input.prompt, repoFlag })
      : [];
  output.write(answerHook(repo.value, { input, now: options.now, similarNotes }));
  return 0;
}

/** `zambil hook`: the command that a Claude Code hook runs. It reads the hook JSON on standard input. */
export const hookCommand: Command = {
  summary: "Add the matching notes to Claude Code's context. A Claude Code hook runs it.",
  usage: "Usage: zambil hook [--repo <path>] < hook-input.json",
  details: [
    "It reads the JSON that Claude Code sends to a hook on standard input, and prints the notes that apply.",
    "At UserPromptSubmit it also adds the notes whose description is similar to the prompt. It never downloads the model, so run zambil index once first.",
    "It prints nothing when no note applies, and it always exits with 0, so that it never blocks a session.",
    "Run `zambil install` to set up the hooks. The file packages/claude-code/README.md in the zambil repo describes them.",
  ].join("\n"),
  run: runHook,
};
