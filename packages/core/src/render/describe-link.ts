import type { ConfigurationRepo } from "../repo/configuration-repo.ts";
import { expiredPhrase } from "./describe-expiry.ts";
import { findTarget } from "./find-target.ts";
import { isNever } from "../is-never.ts";
import { join } from "node:path";
import type { Note } from "../note/note.ts";
import { parseWikilinkTarget } from "./parse-wikilink-target.ts";
import type { RenderWording } from "./render-wording.ts";
import type { WikilinkTarget } from "./parse-wikilink-target.ts";

/** What every part of a rendering needs: the repo, the clock and the wording of the agent tool. */
export interface RenderContext {
  repo: Pick<ConfigurationRepo, "root" | "names">;
  now: Date;
  wording: RenderWording;
}

/** `follow` also describes the when-expired note of an expired note. `stop` only names it, so a chain ends. */
export type WhenExpiredDepth = "follow" | "stop";

/** The context to describe a link in, and how far to follow when-expired notes. */
export interface DescribeLinkOptions {
  context: RenderContext;
  depth?: WhenExpiredDepth;
}

export function oneLineDescription(note: Note): string {
  const description = note.description?.replaceAll(/\s*\n\s*/g, " ");
  return description ?? "It has no description.";
}

function kindLabel(note: Note): string {
  switch (note.kind) {
    case "note":
      return "";
    case "skill":
      return " (skill)";
    case "script":
      return " (script)";
    default:
      return isNever(note);
  }
}

/**
 * What a `[[link]]` brings in: the name and description of the note and how to open it, never its
 * content. An expired note gets a warning, the name of its when-expired note and how to read it anyway.
 */
export function describeLink(target: WikilinkTarget, options: DescribeLinkOptions): string {
  const { repo, now, wording } = options.context;
  const lookup = findTarget(target, { repo, now, expired: "warn", suggest: "none" });
  const link = `[[${target.text}]]`;
  switch (lookup.kind) {
    case "unresolved":
      return `${link}: Warning: ${lookup.reason}.`;
    case "found": {
      const { note } = lookup;
      const label = kindLabel(note);
      const description = oneLineDescription(note);
      const path = join(options.context.repo.root, note.path);
      const open =
        note.kind === "skill"
          ? wording.loadSkill({ name: note.name, path })
          : wording.openNote(target.text);
      return `${link}${label}: ${description} ${open}`;
    }
    case "expired": {
      const { note } = lookup;
      const sentences = [`${link}${kindLabel(note)}: ${oneLineDescription(note)}`];
      sentences.push(`Warning: it ${expiredPhrase(note)}, so it can be out of date.`);
      if (note.whenExpired !== undefined && options.depth !== "stop") {
        const whenExpired = parseWikilinkTarget(note.whenExpired);
        const described = describeLink(whenExpired, { context: options.context, depth: "stop" });
        sentences.push(`To update or verify it, read ${described}`);
      }
      sentences.push(wording.openExpired(target.text));
      return sentences.join(" ");
    }
    default:
      return isNever(lookup);
  }
}
