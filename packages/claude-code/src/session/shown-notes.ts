import { createHash } from "node:crypto";

/**
 * The notes that one context window already holds: the name key of each note, and the version of the
 * text that it got. A note with the same key and version is not added again.
 */
export type ShownNotes = Record<string, string>;

/** A short hash of a note as rendered, so that a changed note counts as new. */
export function noteVersion(renderedText: string): string {
  return createHash("sha256").update(renderedText).digest("hex").slice(0, 16);
}
