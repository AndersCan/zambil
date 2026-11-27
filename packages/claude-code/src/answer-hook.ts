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
import type { ShownNotes } from "./session/shown-notes.ts";
import { similarSection } from "./similar/similar-section.ts";

/**
 * The parsed hook input, the clock, the notes whose description is similar to the prompt, best first,
 * a message for the user, such as a warning about the setup, and the notes that the context already holds.
 */
export interface AnswerHookOptions {
  input: HookInput;
  now: Date;
  similarNotes?: Note[];
  systemMessage?: string;
  shown?: ShownNotes;
}

/** The standard output for the hook, and the notes that it adds in full, to keep for the next hook. */
export interface HookAnswer {
  output: string;
  shown: ShownNotes;
}

interface SectionOptions extends AnswerHookOptions {
  wording: RenderWording;
}

/** A note that the context holds in this version is left out. A changed note comes again. */
function withoutShown(section: ContextSection, options: SectionOptions): ContextSection {
  const shown = options.shown ?? {};
  const blocks = section.blocks.filter((block) => shown[block.key] !== block.version);
  return { ...section, blocks };
}

interface PromptSectionOptions extends SectionOptions {
  prompt: string;
}

type HookRepo = Pick<ConfigurationRepo, "root" | "names" | "notes">;

/**
 * The prompt sections in order: the notes that the prompt names, the notes of the hook, then the
 * similar notes. `fitContext` leaves out a note that an earlier section already added. A note that the
 * user names always comes, because the user asked for it.
 */
function promptSections(repo: HookRepo, options: PromptSectionOptions): ContextSection[] {
  const notes = options.similarNotes ?? [];
  const similar = withoutShown(similarSection(repo, { ...options, notes }), options);
  const hook = withoutShown(hookSection(repo, options), options);
  return [recallSection(repo, options), hook, similar];
}

/**
 * A note at `Stop` or `SubagentStop` makes the agent continue so that it acts on the note, at each stop.
 * At every other hook, a note that the context holds is left out.
 */
const everyTimeHooks = new Set(["Stop", "SubagentStop"]);

function hookNotes(repo: HookRepo, options: SectionOptions): ContextSection {
  const section = hookSection(repo, options);
  if (everyTimeHooks.has(options.input.hookEventName)) return section;
  return withoutShown(section, options);
}

function contextSections(repo: HookRepo, options: SectionOptions): ContextSection[] {
  const { input } = options;
  switch (input.kind) {
    case "prompt":
      return promptSections(repo, { ...options, prompt: input.prompt });
    case "plain":
    case "tool":
      return [hookNotes(repo, options)];
    default:
      return isNever(input);
  }
}

function formatOutput(text: string, options: AnswerHookOptions): string {
  const { systemMessage } = options;
  if (text === "") return systemMessage === undefined ? "" : formatSystemMessage(systemMessage);
  const outputOptions: FormatHookOutputOptions = { hookEventName: options.input.hookEventName };
  if (systemMessage !== undefined) outputOptions.systemMessage = systemMessage;
  return formatHookOutput(text, outputOptions);
}

/**
 * The standard output for one Claude Code hook: the notes that apply, as the JSON that the hook reads.
 * It is empty when nothing applies and there is no message, so that a hook that matches nothing adds nothing.
 * A note in `shown` with the same version is in the context already, so only a `z:<name>` adds it again.
 */
export function answerHook(repo: HookRepo, options: AnswerHookOptions): HookAnswer {
  const wording = claudeCodeWording({ root: repo.root });
  const sections = contextSections(repo, { ...options, wording });
  const findMore = listNotes({ root: repo.root });
  const fitted = fitContext(sections, { budget: defaultBudget, findMore });
  const shown: ShownNotes = {};
  for (const block of fitted.shown) shown[block.key] = block.version;
  return { output: formatOutput(fitted.text, options), shown };
}
