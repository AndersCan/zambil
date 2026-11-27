import { dirname, join } from "node:path";
import { formatSessionFile, parseSessionFile } from "./parse-session-file.ts";
import { left, right, wrap } from "@zambil/core/either";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import type { Either } from "@zambil/core/either";
import type { HookSession } from "../hook-input/parse-hook-input.ts";
import type { ShownNotes } from "./shown-notes.ts";
import type { UserEnvironment } from "@zambil/core/locate-repo";

/** A session file older than this is from a session that ended, so a hook removes it. */
export const sessionFileMaxAge = 7 * 24 * 60 * 60 * 1000;

const safeId = /^[\w-]+$/;

/** The folder of the session files: `$XDG_CACHE_HOME/zambil/sessions`, or `~/.cache/zambil/sessions`. */
export function sessionFolder(environment: UserEnvironment): string {
  const cacheHome = environment.cacheHome ?? join(environment.home, ".cache");
  return join(cacheHome, "zambil", "sessions");
}

/** Where zambil keeps the cache folder. */
export interface SessionFileOptions {
  environment: UserEnvironment;
}

/**
 * The file that lists the notes of one context window: `<session>.json`, or `<session>--<agent>.json`
 * in a subagent. An id with a character that does not belong in a file name gives no file.
 */
export function sessionFilePath(
  session: HookSession,
  options: SessionFileOptions,
): string | undefined {
  const ids =
    session.agentId === undefined ? [session.sessionId] : [session.sessionId, session.agentId];
  if (!ids.every((id) => safeId.test(id))) return undefined;
  const name = ids.join("--");
  return join(sessionFolder(options.environment), `${name}.json`);
}

/** The notes that the context window holds. A missing or broken file means none. */
export async function readShownNotes(path: string): Promise<ShownNotes> {
  const text = await wrap(readFile(path, "utf8"));
  return text.ok ? parseSessionFile(text.value) : {};
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/** Writes the notes to a temporary file and renames it, so that a hook that runs at the same time never reads half a file. */
export async function writeShownNotes(
  path: string,
  shown: ShownNotes,
): Promise<Either<string, undefined>> {
  const created = await wrap(mkdir(dirname(path), { recursive: true }));
  if (!created.ok) return left(describe(created.error));
  const temporary = `${path}.${process.pid}.tmp`;
  const written = await wrap(writeFile(temporary, formatSessionFile(shown)));
  if (!written.ok) return left(describe(written.error));
  const renamed = await wrap(rename(temporary, path));
  if (!renamed.ok) return left(describe(renamed.error));
  return right(undefined);
}

/** Removes the file of a context window that starts again empty. A missing file is fine. */
export async function removeShownNotes(path: string): Promise<Either<string, undefined>> {
  const removed = await wrap(rm(path, { force: true }));
  return removed.ok ? right(undefined) : left(describe(removed.error));
}

/** The clock that decides which files are old. */
export interface RemoveOldSessionFilesOptions {
  now: Date;
}

async function removeIfOld(path: string, options: RemoveOldSessionFilesOptions): Promise<void> {
  const info = await wrap(stat(path));
  const age = info.ok ? options.now.getTime() - info.value.mtimeMs : 0;
  if (age > sessionFileMaxAge) await wrap(rm(path, { force: true }));
}

/** A file that cannot be read or removed stays. */
export async function removeOldSessionFiles(
  folder: string,
  options: RemoveOldSessionFilesOptions,
): Promise<void> {
  const names = await wrap(readdir(folder));
  if (!names.ok) return;
  const paths = names.value.map((name) => join(folder, name));
  await Promise.all(paths.map((path) => removeIfOld(path, options)));
}
