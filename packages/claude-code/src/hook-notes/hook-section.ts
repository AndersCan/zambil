import type { ContextBlock, ContextSection } from "../context/fit-context.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { HookInput } from "../hook-input/parse-hook-input.ts";
import { nameKey } from "@zambil/core/index-names";
import { renderNote } from "@zambil/core/render-note";
import type { RenderWording } from "@zambil/core/render-wording";
import { selectHookNotes } from "./select-hook-notes.ts";

/** The hook that runs, the clock, the wording, and the notes that a `z:<name>` already added. */
export interface HookSectionOptions {
  input: HookInput;
  now: Date;
  wording: RenderWording;
  skip: Set<string>;
}

function describeHook(input: HookInput): string {
  if (input.kind !== "tool") return `the ${input.hookEventName} hook`;
  const tools = [...new Set(input.toolNames)].join(", ");
  const label = input.toolNames.length === 1 ? "tool" : "tools";
  return `the ${input.hookEventName} hook (${label}: ${tools})`;
}

/** Every current note that names the hook that runs, as blocks for the context. */
export function hookSection(
  repo: Pick<ConfigurationRepo, "root" | "names" | "notes">,
  options: HookSectionOptions,
): ContextSection {
  const { input, now, wording } = options;
  const blocks: ContextBlock[] = [];
  for (const note of selectHookNotes(repo.notes, { input, now })) {
    if (options.skip.has(nameKey(note.name))) continue;
    const rendered = renderNote(repo, { target: note.name, now, wording });
    const description = note.description?.replaceAll(/\s*\n\s*/g, " ") ?? "It has no description.";
    const open = wording.openNote(note.name);
    blocks.push({ text: rendered.text, pointer: `[[${note.name}]]: ${description} ${open}` });
  }
  const hook = describeHook(input);
  const heading = `zambil reads notes from the user's configuration repo. These notes name ${hook}:`;
  return { heading, blocks };
}
