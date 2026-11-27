import { claudeCodeWording, listNotes } from "./context/claude-code-wording.ts";
import { defaultBudget, fitContext } from "./context/fit-context.ts";
import { formatHookOutput, formatSystemMessage } from "./context/format-hook-output.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { ContextSection } from "./context/fit-context.ts";
import type { FormatHookOutputOptions } from "./context/format-hook-output.ts";
import type { HookInput } from "./hook-input/parse-hook-input.ts";
import { hookSection } from "./hook-notes/hook-section.ts";
import { isNever } from "@zambil/core/is-never";
import type { Note } from "@zambil/core/note";
import { recallSection } from "./recall/recall-section.ts";
import type { RenderWording } from "@zambil/core/render-wording";
import { similarSection } from "./similar/similar-section.ts";

/**
 * The parsed hook input, the clock, the notes whose description is similar to the prompt, best first,
 * and a message for the user, such as a warning about the setup.
 */
export interface AnswerHookOptions {
  input: HookInput;
  now: Date;
  similarNotes?: Note[];
  systemMessage?: string;
}

interface SectionOptions extends AnswerHookOptions {
  wording: RenderWording;
}

interface PromptSectionOptions extends SectionOptions {
  prompt: string;
}

type HookRepo = Pick<ConfigurationRepo, "root" | "names" | "notes">;

/**
 * The prompt sections in order: the notes that the prompt names, the notes of the hook, then the
 * similar notes. `fitContext` leaves out a note that an earlier section already added.
 */
function promptSections(repo: HookRepo, options: PromptSectionOptions): ContextSection[] {
  const notes = options.similarNotes ?? [];
  const similar = similarSection(repo, { ...options, notes });
  return [recallSection(repo, options), hookSection(repo, options), similar];
}

function contextSections(repo: HookRepo, options: SectionOptions): ContextSection[] {
  const { input } = options;
  switch (input.kind) {
    case "prompt":
      return promptSections(repo, { ...options, prompt: input.prompt });
    case "plain":
    case "tool":
      return [hookSection(repo, options)];
    default:
      return isNever(input);
  }
}

/**
 * The standard output for one Claude Code hook: the notes that apply, as the JSON that the hook reads.
 * It is empty when nothing applies and there is no message, so that a hook that matches nothing adds nothing.
 */
export function answerHook(repo: HookRepo, options: AnswerHookOptions): string {
  const wording = claudeCodeWording({ root: repo.root });
  const sections = contextSections(repo, { ...options, wording });
  const findMore = listNotes({ root: repo.root });
  const text = fitContext(sections, { budget: defaultBudget, findMore });
  const { systemMessage } = options;
  if (text === "") return systemMessage === undefined ? "" : formatSystemMessage(systemMessage);
  const outputOptions: FormatHookOutputOptions = { hookEventName: options.input.hookEventName };
  if (systemMessage !== undefined) outputOptions.systemMessage = systemMessage;
  return formatHookOutput(text, outputOptions);
}
