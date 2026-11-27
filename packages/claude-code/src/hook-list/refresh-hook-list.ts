import { bundledHookList, hookListPath } from "./load-hook-list.ts";
import { left, right, wrap } from "@zambil/core/either";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Either } from "@zambil/core/either";
import type { HookList } from "./hook-list.ts";
import { hooksReferenceUrl } from "./hook-list.ts";
import { parseHooksReference } from "./parse-hooks-reference.ts";
import { randomUUID } from "node:crypto";
import type { UserEnvironment } from "@zambil/core/locate-repo";

/** Gets the text at a URL. The CLI passes `downloadText`, and a test passes a fake. */
export type Download = (url: string) => Promise<Either<string, string>>;

/** How to get the page, and the clock for `readOn`. */
export interface RefreshHookListOptions {
  download: Download;
  now: Date;
}

const downloadTimeout = 20_000;

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** Gets the text at a URL with `fetch`, or a message that says why it cannot. */
export async function downloadText(url: string): Promise<Either<string, string>> {
  const response = await wrap(fetch(url, { signal: AbortSignal.timeout(downloadTimeout) }));
  if (!response.ok) return left(`cannot download ${url}: ${describe(response.error)}`);
  if (!response.value.ok) return left(`cannot download ${url}: HTTP ${response.value.status}`);
  const text = await wrap(response.value.text());
  if (!text.ok) return left(`cannot download ${url}: ${describe(text.error)}`);
  return right(text.value);
}

/** The hooks that the bundled list says can add context, that are still hooks, but no longer add context. */
function droppedContextHooks(list: HookList): string[] {
  return bundledHookList.contextHooks.filter(
    (hook) => list.hooks.includes(hook) && !list.contextHooks.includes(hook),
  );
}

/**
 * Reads the hook list from the current Claude Code hooks reference and keeps it in the cache, where
 * `loadHookList` finds it. Only an explicit command calls this, never a hook.
 */
export async function refreshHookList(
  environment: UserEnvironment,
  options: RefreshHookListOptions,
): Promise<Either<string, HookList>> {
  const page = await options.download(hooksReferenceUrl);
  if (!page.ok) return page;
  const readOn = options.now.toISOString().slice(0, 10);
  const list = parseHooksReference(page.value, { readOn });
  if (!list.ok) return left(`cannot read the hook list from ${hooksReferenceUrl}: ${list.error}`);
  const dropped = droppedContextHooks(list.value);
  if (dropped.length > 0) {
    const names = dropped.join(", ");
    return left(
      `${hooksReferenceUrl} no longer says that ${names} can add context. zambil keeps the old list, because the page may only have changed its wording`,
    );
  }
  const path = hookListPath(environment);
  const partial = `${path}.${randomUUID()}.partial`;
  const text = `${JSON.stringify(list.value, undefined, 2)}\n`;
  const written = await wrap(
    mkdir(dirname(path), { recursive: true })
      .then(() => writeFile(partial, text))
      .then(() => rename(partial, path)),
  );
  if (!written.ok) return left(`cannot write ${path}: ${describe(written.error)}`);
  return list;
}
