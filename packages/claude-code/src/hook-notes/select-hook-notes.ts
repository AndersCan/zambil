import { appliesInPlace } from "@zambil/core/applies-in-place";
import type { HookInput } from "../hook-input/parse-hook-input.ts";
import { isExpired } from "@zambil/core/is-expired";
import type { Note } from "@zambil/core/note";
import type { ProjectPlace } from "@zambil/core/project-place";

/** The hook that runs, the clock that judges expiry, and where the agent works. */
export interface SelectHookNotesOptions {
  input: HookInput;
  now: Date;
  place?: ProjectPlace;
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
 * A subagent starts with a context of its own and gets no `SessionStart`, so a standing note of the
 * session reaches it at `SubagentStart`.
 */
function namesHook(note: Note, options: ToolFilterOptions): boolean {
  const { hookEventName } = options.input;
  if (note.hooks.includes(hookEventName)) return true;
  return hookEventName === "SubagentStart" && note.hooks.includes("SessionStart");
}

/**
 * The current notes whose `hooks` name the hook that runs, and the `SessionStart` notes at
 * `SubagentStart`. At a tool hook, a note with `tools` matches only when one of the tools runs. A note
 * with `projects` or `paths` matches only in that place. An expired note is left out, never shown as current.
 */
export function selectHookNotes(notes: Note[], options: SelectHookNotesOptions): Note[] {
  const { input } = options;
  const selected: Note[] = [];
  for (const note of notes) {
    const isMatch = namesHook(note, { input }) && matchesTools(note, { input });
    const applies = isMatch && appliesInPlace(note, { place: options.place });
    if (applies && !isExpired(note, { now: options.now })) selected.push(note);
  }
  return selected;
}
