import { isNever } from "../is-never.ts";
import type { Note } from "../note/note.ts";

/** The moment to compare against, so that a caller and its tests pick the clock. */
export interface IsExpiredOptions {
  now: Date;
}

/** An unreadable `expires` value counts as expired, so that its content is never shown as current. */
export function isExpired(note: Note, options: IsExpiredOptions): boolean {
  const expiry = note.expiry;
  switch (expiry.kind) {
    case "never":
      return false;
    case "at":
      return options.now.getTime() >= expiry.time.getTime();
    case "unreadable":
      return true;
    default:
      return isNever(expiry);
  }
}
