import type { Note } from "@zambil/core/note";

/** The tool hooks whose `matcher` Claude Code compares with the name of the tool. */
const matchedHooks = ["PreToolUse", "PostToolUse", "PostToolUseFailure"];

/** Claude Code reads a matcher of only these characters as a list of exact tool names. */
const plainToolName = /^[\w-]+$/;

/** A matcher with another character is a pattern that the user wrote, which zambil does not read. */
const plainMatcher = /^[\w|-]+$/;

/** The hooks that install connects. */
export interface ToolMatchersOptions {
  hookNames: string[];
}

interface MatcherForOptions {
  notes: Note[];
}

function matcherFor(hook: string, options: MatcherForOptions): string | undefined {
  const tools = new Set<string>();
  for (const note of options.notes) {
    if (!note.hooks.includes(hook)) continue;
    if (note.tools.length === 0) return undefined;
    for (const tool of note.tools) tools.add(tool);
  }
  const names = [...tools].toSorted();
  if (names.length === 0 || !names.every((name) => plainToolName.test(name))) return undefined;
  return names.join("|");
}

/**
 * The `matcher` for each tool hook that install connects, such as `Bash|Edit`, so that Claude Code
 * starts `zambil hook` only for the tools that a note names. A hook with a note without `tools`, or
 * with a tool name that Claude Code would read as a pattern, gets no matcher and runs for every tool.
 */
export function toolMatchers(notes: Note[], options: ToolMatchersOptions): Record<string, string> {
  const matchers: Record<string, string> = {};
  for (const hook of matchedHooks) {
    if (!options.hookNames.includes(hook)) continue;
    const matcher = matcherFor(hook, { notes });
    if (matcher !== undefined) matchers[hook] = matcher;
  }
  return matchers;
}

/** The matcher that the notes need. `undefined` stands for every tool. */
export interface MatcherCoversOptions {
  needed: string | undefined;
}

/**
 * Whether a handler with this matcher runs for each tool that the notes need. A pattern that the user
 * wrote by hand counts as covering, so that zambil gives no false warning.
 */
export function matcherCovers(
  installed: string | undefined,
  options: MatcherCoversOptions,
): boolean {
  if (installed === undefined || !plainMatcher.test(installed)) return true;
  if (options.needed === undefined) return false;
  const tools = new Set(installed.split("|"));
  return options.needed.split("|").every((tool) => tools.has(tool));
}
