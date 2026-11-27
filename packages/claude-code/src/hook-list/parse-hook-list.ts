import { asRecord } from "@zambil/core/as-record";
import type { HookList } from "./hook-list.ts";

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/** Reads a cached hook list. Anything that is not a complete list is `undefined`, so the caller falls back. */
export function parseHookList(value: unknown): HookList | undefined {
  const record = asRecord(value);
  if (record === undefined) return undefined;
  const { source, readOn, hooks, contextHooks } = record;
  const hasText = typeof source === "string" && typeof readOn === "string";
  const hasLists = isTextList(hooks) && isTextList(contextHooks);
  const isComplete = hasText && hasLists && contextHooks.length > 0;
  if (!isComplete) return undefined;
  return { source, readOn, hooks, contextHooks };
}
