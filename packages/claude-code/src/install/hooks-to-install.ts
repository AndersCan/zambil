import type { HookList } from "../hook-list/hook-list.ts";
import type { Note } from "@zambil/core/note";

/** The hook list that says which hooks can add context. */
export interface HooksToInstallOptions {
  hookList: HookList;
}

/**
 * `UserPromptSubmit`, for `z:<name>` and similar notes, `SessionStart`, for the warning about a broken
 * setup, and each other hook that a note names and that can add context, in the order of the hook
 * list. Each installed hook starts `zambil hook` on every event, so a hook that no note names is left out.
 */
export function hooksToInstall(notes: Note[], options: HooksToInstallOptions): string[] {
  const named = new Set(["UserPromptSubmit", "SessionStart"]);
  for (const note of notes) {
    for (const hook of note.hooks) named.add(hook);
  }
  return options.hookList.contextHooks.filter((hook) => named.has(hook));
}
