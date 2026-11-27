import type { ConfigurationRepo } from "../repo/configuration-repo.ts";
import { findNote } from "../repo/find-note.ts";
import { isExpired } from "./is-expired.ts";
import type { Note } from "../note/note.ts";
import type { NoteLookup } from "../repo/find-note.ts";

/**
 * A name lookup that knows the clock. An expired note comes back as `expired`, never as `found`, with
 * the lookup of its `when-expired` note when it names one.
 */
export type NoteResolution = NoteLookup | { kind: "expired"; note: Note; whenExpired?: NoteLookup };

/** The name or alias to resolve, and the moment to judge expiry at. */
export interface ResolveNoteOptions {
  name: string;
  now: Date;
}

/**
 * Resolves a name the way a `[[link]]`, an `![[embed]]` or a `z:<name>` must, so that expired content
 * is never shown as current. Use it instead of `findNote` wherever a note's content is shown.
 */
export function resolveNote(
  repo: Pick<ConfigurationRepo, "names">,
  options: ResolveNoteOptions,
): NoteResolution {
  const lookup = findNote(repo, { name: options.name });
  if (lookup.kind !== "found" || !isExpired(lookup.note, options)) return lookup;
  const { note } = lookup;
  if (note.whenExpired === undefined) return { kind: "expired", note };
  return { kind: "expired", note, whenExpired: findNote(repo, { name: note.whenExpired }) };
}
