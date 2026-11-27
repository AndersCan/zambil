import { closestMatch } from "../suggest/closest-match.ts";
import type { ConfigurationRepo } from "../repo/configuration-repo.ts";
import { isNever } from "../is-never.ts";
import type { MarkdownLine } from "./scan-lines.ts";
import type { Note } from "../note/note.ts";
import { readNoteContent } from "./read-note-content.ts";
import { resolveNote } from "../expiry/resolve-note.ts";
import { scanLines } from "./scan-lines.ts";
import { selectSection } from "./select-section.ts";
import type { WikilinkTarget } from "./parse-wikilink-target.ts";

/** `warn` puts a warning in place of an expired note. `show` reads it anyway, for a deliberate request. */
export type ExpiredMode = "warn" | "show";

/** Whether a note that is shown is current, or expired and read anyway. */
export type ShownExpiry = "current" | "expired";

/** A target that resolved to lines to show, to an expired note to warn about, or to nothing. */
export type TargetLookup =
  | { kind: "found"; note: Note; lines: MarkdownLine[]; expiry: ShownExpiry }
  | { kind: "expired"; note: Note }
  | { kind: "unresolved"; reason: string };

/**
 * `closest` names the closest note for a missing name, for a name that the user typed. `none` skips that
 * search, for the links inside a note, which can point to many notes that do not exist yet.
 */
export type SuggestMode = "closest" | "none";

/** The repo and the clock to resolve against, what to do with an expired note, and whether to suggest a name. */
export interface FindTargetOptions {
  repo: Pick<ConfigurationRepo, "names" | "root">;
  now: Date;
  expired: ExpiredMode;
  suggest: SuggestMode;
}

function missingSection(note: Note, target: WikilinkTarget): string {
  const { subpath } = target;
  switch (subpath.kind) {
    case "heading": {
      const heading = subpath.headings.join("#");
      return `[[${note.name}]] has no heading ${JSON.stringify(heading)}`;
    }
    case "block":
      return `[[${note.name}]] has no block "^${subpath.id}"`;
    case "whole":
      return `[[${note.name}]] has no such part`;
    default:
      return isNever(subpath);
  }
}

function missingName(name: string, options: FindTargetOptions): string {
  const quoted = JSON.stringify(name);
  if (options.suggest === "none") return `no note has the name ${quoted}`;
  const candidates = new Set<string>();
  for (const entries of options.repo.names.values()) {
    for (const { note } of entries) {
      candidates.add(note.name);
      for (const alias of note.aliases) candidates.add(alias);
    }
  }
  const suggestion = closestMatch(name, { candidates });
  if (suggestion === undefined) return `no note has the name ${quoted}`;
  const quotedSuggestion = JSON.stringify(suggestion);
  return `no note has the name ${quoted} (did you mean ${quotedSuggestion}?)`;
}

/** Resolves a link target with its expiry, then the heading or block it names. */
export function findTarget(target: WikilinkTarget, options: FindTargetOptions): TargetLookup {
  const resolution = resolveNote(options.repo, { name: target.name, now: options.now });
  switch (resolution.kind) {
    case "missing":
      return { kind: "unresolved", reason: missingName(target.name, options) };
    case "ambiguous": {
      const paths = resolution.notes.map((note) => note.path);
      const count = resolution.notes.length;
      const name = JSON.stringify(target.name);
      const list = paths.join(", ");
      return { kind: "unresolved", reason: `${count} notes use the name ${name}: ${list}` };
    }
    case "expired":
    case "found": {
      const { note } = resolution;
      const expiry = resolution.kind === "expired" ? "expired" : "current";
      const content = readNoteContent(note, { root: options.repo.root });
      if (!content.ok) return { kind: "unresolved", reason: content.error };
      const lines = selectSection(scanLines(content.value), target.subpath);
      if (lines === undefined) return { kind: "unresolved", reason: missingSection(note, target) };
      if (expiry === "expired" && options.expired === "warn") return { kind: "expired", note };
      return { kind: "found", note, lines, expiry };
    }
    default:
      return isNever(resolution);
  }
}
