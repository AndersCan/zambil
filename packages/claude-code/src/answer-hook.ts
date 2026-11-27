import { claudeCodeWording, listNotes } from "./context/claude-code-wording.ts";
import { defaultBudget, fitContext } from "./context/fit-context.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { ContextSection } from "./context/fit-context.ts";
import { formatHookOutput } from "./context/format-hook-output.ts";
import type { HookInput } from "./hook-input/parse-hook-input.ts";
import { hookSection } from "./hook-notes/hook-section.ts";
import { isNever } from "@zambil/core/is-never";
import { recallSection } from "./recall/recall-section.ts";
import type { RenderWording } from "@zambil/core/render-wording";

/** The parsed hook input and the clock. */
export interface AnswerHookOptions {
  input: HookInput;
  now: Date;
}

interface SectionOptions extends AnswerHookOptions {
  wording: RenderWording;
}

interface PromptSectionOptions extends SectionOptions {
  prompt: string;
}

type HookRepo = Pick<ConfigurationRepo, "root" | "names" | "notes">;

/**
 * The prompt sections in order. Similarity matches will be one more section after the hook notes, and
 * `fitContext` leaves out a note that an earlier section already added.
 */
function promptSections(repo: HookRepo, options: PromptSectionOptions): ContextSection[] {
  return [recallSection(repo, options), hookSection(repo, options)];
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
 * It is empty when nothing applies, so that a hook that matches nothing adds nothing.
 */
export function answerHook(repo: HookRepo, options: AnswerHookOptions): string {
  const wording = claudeCodeWording({ root: repo.root });
  const sections = contextSections(repo, { ...options, wording });
  const findMore = listNotes({ root: repo.root });
  const text = fitContext(sections, { budget: defaultBudget, findMore });
  if (text === "") return "";
  return formatHookOutput(text, { hookEventName: options.input.hookEventName });
}
