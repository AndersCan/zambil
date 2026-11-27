import { left, right } from "@zambil/core/either";
import type { Either } from "@zambil/core/either";
import type { HookList } from "./hook-list.ts";
import { hooksReferenceUrl } from "./hook-list.ts";

/** The day the page was read, as `YYYY-MM-DD`. */
export interface ParseHooksReferenceOptions {
  readOn: string;
}

const eventRow = /^\|\s*`(?<name>[A-Za-z]+)`\s*\|/;

const negation = /\b(?:not|doesn't|don't|can't|cannot|never|discard(?:s|ed)?|ignore[sd]?)\b/i;

/** The events in the first table whose header starts with `Event`, in the order of the page. */
function eventTable(lines: string[]): string[] {
  const names: string[] = [];
  const start = lines.findIndex((line) => /^\|\s*Event\s*\|/.test(line));
  if (start === -1) return names;
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    const name = eventRow.exec(line)?.groups?.name;
    if (name !== undefined) names.push(name);
  }
  return names;
}

function hookEventsSection(lines: string[]): string[] {
  const start = lines.findIndex((line) => line.trim() === "## Hook events");
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return end === -1 ? rest : rest.slice(0, end);
}

/** A sentence that names `additionalContext` without saying that the hook drops it. */
function addsContext(line: string): boolean {
  const sentences = line.split(/(?<=[.:])\s+/);
  return sentences.some(
    (sentence) => sentence.includes("additionalContext") && !negation.test(sentence),
  );
}

/** Each `### <event>` heading of the section, with the events whose text says they can add context. */
function contextEvents(section: string[], events: Set<string>): string[] {
  const found: string[] = [];
  let current: string | undefined;
  for (const line of section) {
    if (line.startsWith("### ")) {
      const heading = line.slice(4).trim();
      current = events.has(heading) ? heading : undefined;
      continue;
    }
    if (current === undefined || found.includes(current)) continue;
    if (addsContext(line)) found.push(current);
  }
  return found;
}

/**
 * Reads the hook list from the Markdown of the Claude Code hooks reference. Every hook is a row of the
 * event table. A hook can add context when its own section names `additionalContext` in a sentence that
 * does not say that the hook ignores it.
 */
export function parseHooksReference(
  markdown: string,
  options: ParseHooksReferenceOptions,
): Either<string, HookList> {
  const lines = markdown.split(/\r?\n/);
  const hooks = eventTable(lines);
  if (hooks.length === 0) return left("the page has no table of hook events");
  const contextHooks = contextEvents(hookEventsSection(lines), new Set(hooks));
  if (!contextHooks.includes("UserPromptSubmit")) {
    return left("the page does not say that UserPromptSubmit can add context");
  }
  return right({ source: hooksReferenceUrl, readOn: options.readOn, hooks, contextHooks });
}
