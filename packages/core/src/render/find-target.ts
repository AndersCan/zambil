import type { ConfigurationRepo } from "../repo/configuration-repo.ts";
import { isNever } from "../is-never.ts";
import type { MarkdownLine } from "./scan-lines.ts";
import type { Note } from "../note/note.ts";
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

/** The repo and the clock to resolve against, and what to do with an expired note. */
export interface FindTargetOptions {
  repo: Pick<ConfigurationRepo, "names">;
  now: Date;
  expired: ExpiredMode;
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

/** Resolves a link target with its expiry, then the heading or block it names. */
export function findTarget(target: WikilinkTarget, options: FindTargetOptions): TargetLookup {
  const resolution = resolveNote(options.repo, { name: target.name, now: options.now });
  switch (resolution.kind) {
    case "missing":
      return { kind: "unresolved", reason: `no note has the name ${JSON.stringify(target.name)}` };
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
      const lines = selectSection(scanLines(note.content), target.subpath);
      if (lines === undefined) return { kind: "unresolved", reason: missingSection(note, target) };
      if (expiry === "expired" && options.expired === "warn") return { kind: "expired", note };
      return { kind: "found", note, lines, expiry };
    }
    default:
      return isNever(resolution);
  }
}
