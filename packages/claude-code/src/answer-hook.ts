import type { ContextBudget, ContextSection } from "./context/fit-context.ts";
import { defaultBudget, fitContext } from "./context/fit-context.ts";
import { claudeCodeWording } from "./context/claude-code-wording.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { formatHookOutput } from "./context/format-hook-output.ts";
import type { HookInput } from "./hook-input/parse-hook-input.ts";
import { hookSection } from "./hook-notes/hook-section.ts";
import { isNever } from "@zambil/core/is-never";
import { recallSection } from "./recall/recall-section.ts";
import type { RenderWording } from "@zambil/core/render-wording";

/** The parsed hook input and the clock. `budget` is for tests; the default stays under Claude Code's cap. */
export interface AnswerHookOptions {
  input: HookInput;
  now: Date;
  budget?: ContextBudget;
}

interface SectionOptions extends AnswerHookOptions {
  wording: RenderWording;
}

interface PromptSectionOptions extends SectionOptions {
  prompt: string;
}

type HookRepo = Pick<ConfigurationRepo, "root" | "names" | "notes">;

/** The prompt sections in order. Similarity matches will be one more section after the hook notes. */
function promptSections(repo: HookRepo, options: PromptSectionOptions): ContextSection[] {
  const recalls = recallSection(repo, options);
  const hookNotes = hookSection(repo, { ...options, skip: recalls.recalled });
  return [recalls.section, hookNotes];
}

function contextSections(repo: HookRepo, options: SectionOptions): ContextSection[] {
  const { input } = options;
  switch (input.kind) {
    case "prompt":
      return promptSections(repo, { ...options, prompt: input.prompt });
    case "plain":
    case "tool":
      return [hookSection(repo, { ...options, skip: new Set() })];
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
  const text = fitContext(sections, { budget: options.budget ?? defaultBudget });
  if (text === "") return "";
  return formatHookOutput(text, { hookEventName: options.input.hookEventName });
}
