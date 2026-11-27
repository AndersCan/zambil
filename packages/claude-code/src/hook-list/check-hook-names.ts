import type { HookList } from "./hook-list.ts";
import type { Note } from "@zambil/core/note";
import type { NoteProblem } from "@zambil/core/note-problem";

/** The hook list to check the names against. */
export interface CheckHookNamesOptions {
  hookList: HookList;
}

interface HookProblemOptions extends CheckHookNamesOptions {
  hook: string;
}

function hookMessage(options: HookProblemOptions): string | undefined {
  const { hook, hookList } = options;
  if (hookList.contextHooks.includes(hook)) return undefined;
  if (hookList.hooks.includes(hook)) {
    return `\`hooks\` names "${hook}", but that Claude Code hook cannot add context, so the note never shows there`;
  }
  const lowerCase = hook.toLowerCase();
  const sameLetters = hookList.hooks.find((known) => known.toLowerCase() === lowerCase);
  const unknown = `\`hooks\` names "${hook}", but the Claude Code hooks reference of ${hookList.readOn} has no such hook`;
  if (sameLetters === undefined) return unknown;
  return `${unknown}. Names compare exactly: write "${sameLetters}"`;
}

/**
 * A warning for each hook name that zambil never answers: a hook that cannot add context, or a name
 * that is not a Claude Code hook. The core does not know the hook names, so the adapter checks them.
 */
export function checkHookNames(notes: Note[], options: CheckHookNamesOptions): NoteProblem[] {
  const problems: NoteProblem[] = [];
  for (const note of notes) {
    for (const hook of note.hooks) {
      const message = hookMessage({ ...options, hook });
      if (message !== undefined) problems.push({ severity: "warning", path: note.path, message });
    }
  }
  return problems;
}
