import bundledHookList from "./bundled-hook-list.json" with { type: "json" };
import type { HookList } from "./hook-list.ts";
import { join } from "node:path";
import { parseHookList } from "./parse-hook-list.ts";
import { readFileSync } from "node:fs";
import type { UserEnvironment } from "@zambil/core/locate-repo";

/** `cache`: the list that the last refresh read from the docs. `bundled`: the list that ships with zambil. */
export type HookListOrigin = "cache" | "bundled";

/** The hook list in use, and where it came from. */
export interface LoadedHookList {
  list: HookList;
  origin: HookListOrigin;
}

/** Where a refresh keeps the hook list: `$XDG_CACHE_HOME/zambil/claude-code-hooks.json`. */
export function hookListPath(environment: UserEnvironment): string {
  const cacheHome = environment.cacheHome ?? join(environment.home, ".cache");
  return join(cacheHome, "zambil", "claude-code-hooks.json");
}

function unsafeReadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readCachedList(path: string): HookList | undefined {
  try {
    return parseHookList(unsafeReadJson(path));
  } catch {
    return undefined;
  }
}

/**
 * The hook list from the cache of the last refresh, or the bundled list when there is no usable cache.
 * It reads one small file and never uses the network, so a hook can call it on every event.
 */
export function loadHookList(environment: UserEnvironment): LoadedHookList {
  const cached = readCachedList(hookListPath(environment));
  if (cached !== undefined) return { list: cached, origin: "cache" };
  return { list: bundledHookList, origin: "bundled" };
}
