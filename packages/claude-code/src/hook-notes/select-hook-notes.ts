import type { HookInput } from "../hook-input/parse-hook-input.ts";
import { isExpired } from "@zambil/core/is-expired";
import type { Note } from "@zambil/core/note";

/** The hook that runs and the clock that judges expiry. */
export interface SelectHookNotesOptions {
  input: HookInput;
  now: Date;
}

interface ToolFilterOptions {
  input: HookInput;
}

function matchesTools(note: Note, options: ToolFilterOptions): boolean {
  const { input } = options;
  if (input.kind !== "tool" || note.tools.length === 0) return true;
  return input.toolNames.some((name) => note.tools.includes(name));
}

/**
 * The current notes whose `hooks` name the hook that runs. At a tool hook, a note with `tools` matches
 * only when one of the tools runs. An expired note is left out, never shown as current.
 */
export function selectHookNotes(notes: Note[], options: SelectHookNotesOptions): Note[] {
  const { input } = options;
  const selected: Note[] = [];
  for (const note of notes) {
    const isMatch = note.hooks.includes(input.hookEventName) && matchesTools(note, { input });
    if (isMatch && !isExpired(note, { now: options.now })) selected.push(note);
  }
  return selected;
}
