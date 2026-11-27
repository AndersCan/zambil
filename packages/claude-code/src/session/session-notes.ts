import {
  readShownNotes,
  removeOldSessionFiles,
  removeShownNotes,
  sessionFilePath,
  sessionFolder,
  writeShownNotes,
} from "./session-file.ts";
import type { Either } from "@zambil/core/either";
import type { HookAnswerRequest } from "../hook-input/parse-hook-input.ts";
import { right } from "@zambil/core/either";
import type { ShownNotes } from "./shown-notes.ts";
import type { UserEnvironment } from "@zambil/core/locate-repo";

/** Where the cache folder is, and the clock that decides which session files are old. */
export interface SessionNotesOptions {
  environment: UserEnvironment;
  now: Date;
}

/**
 * `SessionStart` starts a context window, or fills it again after `clear`, `compact` or a resume, and
 * `SubagentStart` starts the context of a subagent. Each starts with no note.
 */
function startsContext(request: HookAnswerRequest): boolean {
  const { hookEventName } = request.input;
  return hookEventName === "SessionStart" || hookEventName === "SubagentStart";
}

function pathOf(request: HookAnswerRequest, options: SessionNotesOptions): string | undefined {
  if (request.session === undefined) return undefined;
  return sessionFilePath(request.session, options);
}

/**
 * The notes that the context window of the hook already holds. A hook without a session has none. At
 * the start of a context, it removes the file of that context first, and `SessionStart` also removes
 * the files of old sessions, so that the reset holds even when the hook stops after this.
 */
export async function readSessionNotes(
  request: HookAnswerRequest,
  options: SessionNotesOptions,
): Promise<Either<string, ShownNotes>> {
  const path = pathOf(request, options);
  if (path === undefined) return right({});
  if (!startsContext(request)) return right(await readShownNotes(path));
  if (request.input.hookEventName === "SessionStart") {
    await removeOldSessionFiles(sessionFolder(options.environment), options);
  }
  const removed = await removeShownNotes(path);
  return removed.ok ? right({}) : removed;
}

/** The notes that the context held before the hook, and the notes that the hook added. */
export interface KeepSessionNotesOptions extends SessionNotesOptions {
  before: ShownNotes;
  added: ShownNotes;
}

/** Writes the notes of the context window after a hook. A hook that adds nothing writes nothing. */
export function keepSessionNotes(
  request: HookAnswerRequest,
  options: KeepSessionNotesOptions,
): Promise<Either<string, undefined>> {
  const path = pathOf(request, options);
  const hasAdded = Object.keys(options.added).length > 0;
  if (path === undefined || !hasAdded) return Promise.resolve(right(undefined));
  return writeShownNotes(path, { ...options.before, ...options.added });
}
