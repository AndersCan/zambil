import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import type { HookAnswerRequest, HookInput } from "@zambil/claude-code/parse-hook-input";
import { keepSessionNotes, readSessionNotes } from "@zambil/claude-code/session-notes";
import { answerHook } from "@zambil/claude-code/answer-hook";
import type { AnswerHookOptions } from "@zambil/claude-code/answer-hook";
import type { CliConfig } from "../config.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { countSearchTexts } from "../index/count-search-texts.ts";
import { findProjectPlace } from "@zambil/core/project-place";
import { findSimilarNotes } from "@zambil/claude-code/find-similar-notes";
import type { FindSimilarNotesOptions } from "@zambil/claude-code/find-similar-notes";
import { formatSystemMessage } from "@zambil/claude-code/format-hook-output";
import type { HookList } from "@zambil/claude-code/hook-list";
import { indexHint } from "../index/index-hint.ts";
import { isScoped } from "@zambil/core/applies-in-place";
import { loadHookList } from "@zambil/claude-code/load-hook-list";
import type { Note } from "@zambil/core/note";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { parseHookInput } from "@zambil/claude-code/parse-hook-input";
import type { ProjectPlace } from "@zambil/core/project-place";
import { repoOptionHelp } from "../parse-command-args.ts";
import type { SessionNotesOptions } from "@zambil/claude-code/session-notes";
import { sharedOptions } from "../parse-command-args.ts";
import type { ShownNotes } from "@zambil/claude-code/shown-notes";
import { wrap } from "@zambil/core/either";

interface SimilarToOptions extends CommandRunOptions {
  prompt: string;
  repoFlag: string | undefined;
  inContext: ShownNotes;
  place: ProjectPlace | undefined;
}

/**
 * The notes similar to the prompt. A missing model or index is a message on standard error, and the
 * hook still adds the other notes.
 */
async function similarTo(repo: ConfigurationRepo, options: SimilarToOptions): Promise<Note[]> {
  const { output } = options;
  const findOptions: FindSimilarNotesOptions = {
    prompt: options.prompt,
    now: options.now,
    environment: options.config.environment,
    inContext: options.inContext,
  };
  if (options.place !== undefined) findOptions.place = options.place;
  const similar = await findSimilarNotes(repo, findOptions);
  const hint = indexHint(options.repoFlag);
  if (!similar.ok) {
    const { kind, message } = similar.error;
    const next = kind === "no-model" ? ` Run \`${hint}\`.` : "";
    output.error(`zambil hook: no similar notes, because ${message}.${next}\n`);
    return [];
  }
  const { matches, skipped } = similar.value;
  if (skipped > 0) {
    const count = countSearchTexts(skipped);
    const verb = skipped === 1 ? "is" : "are";
    output.error(
      `zambil hook: ${count} ${verb} not in the index, so the similarity match did not score them. Run \`${hint}\`.\n`,
    );
  }
  return matches.map((match) => match.note);
}

const sessionProblem =
  "zambil hook: cannot keep the notes of this session, so the next hook can add them again:";

interface SessionNotesRunOptions extends SessionNotesOptions {
  output: CommandRunOptions["output"];
}

/** The notes that the context already holds. A file that cannot be removed is a message, and the hook goes on. */
async function sessionNotes(
  request: HookAnswerRequest,
  options: SessionNotesRunOptions,
): Promise<ShownNotes> {
  const read = await readSessionNotes(request, options);
  if (read.ok) return read.value;
  options.output.error(`${sessionProblem} ${read.error}\n`);
  return {};
}

/** A `SessionStart` that starts or resumes a session. After `compact`, the session goes on, so it gets no second warning. */
function isSessionStart(input: HookInput): boolean {
  const isStart = input.kind === "plain" && input.hookEventName === "SessionStart";
  return isStart && input.source !== "compact";
}

/** The short warning that Claude Code shows to the user at the start of a session. */
function sessionWarning(problems: string[]): string {
  const text = problems.join(" ");
  return `zambil: ${text} Run zambil doctor to see the fix.`;
}

interface SetupWarningOptions {
  config: CliConfig;
  hookList: HookList;
  hookEventName: string;
}

/**
 * The warning about the setup, if a check finds a problem. The checks load only at the start of a
 * session, so that the other hooks stay as fast as before. A check that fails gives no warning.
 */
async function setupWarning(
  repo: ConfigurationRepo,
  options: SetupWarningOptions,
): Promise<string | undefined> {
  const loaded = await wrap(import("./session-problems.ts"));
  if (!loaded.ok) return undefined;
  const problems = await wrap(loaded.value.findSessionProblems(repo, options));
  if (!problems.ok || problems.value.length === 0) return undefined;
  return sessionWarning(problems.value);
}

/**
 * Claude Code reads exit code 2 as a blocking error, so every path exits with 0. A problem goes to
 * standard error, which Claude Code keeps out of the context. At the start of a session, a broken
 * setup also gets a short warning that Claude Code shows to the user.
 */
async function runHook(options: CommandRunOptions): Promise<ExitCode> {
  const { output } = options;
  const parsed = parseCommandArgs({ args: options.args, options: sharedOptions });
  if (!parsed.ok) {
    output.error(`zambil hook: ${parsed.error}\n${hookCommand.usage}\n`);
    return 0;
  }
  const { list } = loadHookList(options.config.environment);
  const request = parseHookInput(await options.input.readAll(), {
    contextHooks: list.contextHooks,
  });
  if (!request.ok) {
    output.error(`zambil hook: ${request.error}\n`);
    return 0;
  }
  if (request.value.kind === "ignore") return 0;
  const { input } = request.value;
  const sessionOptions = { environment: options.config.environment, now: options.now };
  const before = await sessionNotes(request.value, { ...sessionOptions, output });
  const isStart = isSessionStart(input);
  const repo = openRepo({ flag: parsed.value.values.repo, config: options.config });
  if (!repo.ok) {
    output.error(`zambil hook: ${repo.error}\n`);
    const [problem = repo.error] = repo.error.split("\n");
    const warning = sessionWarning([`${problem} No note reaches this session.`]);
    if (isStart) output.write(formatSystemMessage(warning));
    return 0;
  }
  const repoFlag = parsed.value.values.repo;
  const { folder } = request.value;
  const { home } = options.config.environment;
  const hasScope = repo.value.notes.some((note) => isScoped(note));
  const place = folder === undefined || !hasScope ? undefined : findProjectPlace(folder, { home });
  const similarNotes =
    input.kind === "prompt"
      ? await similarTo(repo.value, {
          ...options,
          prompt: input.prompt,
          repoFlag,
          inContext: before,
          place,
        })
      : [];
  const { config } = options;
  const { hookEventName } = input;
  const systemMessage = isStart
    ? await setupWarning(repo.value, { config, hookList: list, hookEventName })
    : undefined;
  const answerOptions: AnswerHookOptions = { input, now: options.now, similarNotes, shown: before };
  if (systemMessage !== undefined) answerOptions.systemMessage = systemMessage;
  if (place !== undefined) answerOptions.place = place;
  const answer = answerHook(repo.value, answerOptions);
  output.write(answer.output);
  const kept = await keepSessionNotes(request.value, {
    ...sessionOptions,
    before,
    added: answer.shown,
  });
  if (!kept.ok) output.error(`${sessionProblem} ${kept.error}\n`);
  return 0;
}

/** `zambil hook`: the command that a Claude Code hook runs. It reads the hook JSON on standard input. */
export const hookCommand: Command = {
  summary: "Add the matching notes to Claude Code's context. A Claude Code hook runs it.",
  usage: "Usage: zambil hook [--repo <path>] < hook-input.json",
  audience: "agent",
  options: [repoOptionHelp],
  details: [
    "It reads the JSON that Claude Code sends to a hook on standard input, and prints the notes that apply.",
    "At UserPromptSubmit it also adds the notes whose description or a trigger is similar to the prompt. It never downloads the model, so run zambil index once first.",
    "It adds each note once in a session or subagent, and keeps the list in $XDG_CACHE_HOME/zambil/sessions/ or ~/.cache/zambil/sessions/. A note that the prompt names with z:<name> comes each time, and so does a note at Stop or SubagentStop.",
    "After a rewind, a note that a prompt after the rewind point added stays out until a clear, a compact or a new session. Name it with z:<name> to get it back.",
    "It prints nothing when no note applies, or the context already holds each one, and the setup works, and it always exits with 0, so that it never blocks a session.",
    "At SubagentStart, it also adds the SessionStart notes, because a subagent gets no SessionStart.",
    "A note with projects or paths applies only in that project or under that path, from the cwd of the hook input. Without a cwd, such a note does not apply.",
    "At SessionStart, it warns the user in one line when the setup is broken, for example a moved notes folder, and points to zambil doctor.",
    "Run `zambil install` to set up the hooks. The file packages/claude-code/README.md in the zambil repo describes them.",
  ].join("\n"),
  run: runHook,
};
