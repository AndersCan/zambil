import { parseLinkTarget } from "../properties/parse-link-target.ts";

/** The part of a note that a link points to: all of it, a heading path such as `#Steps#Build`, or a block `#^id`. */
export type Subpath =
  | { kind: "whole" }
  | { kind: "heading"; headings: string[]; text: string }
  | { kind: "block"; id: string; text: string };

/**
 * What a link points to. `text` is the target as written, without the display text. An empty `name`
 * points to the note that holds the link, as `[[#Steps]]` does.
 */
export interface WikilinkTarget {
  text: string;
  name: string;
  subpath: Subpath;
}

function parseSubpath(text: string): Subpath {
  if (text === "") return { kind: "whole" };
  if (text.startsWith("#^")) return { kind: "block", id: text.slice(2).trim(), text };
  const headings: string[] = [];
  for (const part of text.split("#")) {
    const heading = part.trim();
    if (heading !== "") headings.push(heading);
  }
  if (headings.length === 0) return { kind: "whole" };
  return { kind: "heading", headings, text };
}

/**
 * Reads a link target the way Obsidian does: `ops/deploy#Steps|deploy it` points to the heading
 * `Steps` of `deploy`. The text can also be a whole link such as `![[deploy#^intro]]`.
 */
export function parseWikilinkTarget(text: string): WikilinkTarget {
  const inner = /^!?\[\[(?<inner>.*)\]\]$/.exec(text.trim())?.groups?.inner ?? text;
  const [beforeDisplay = ""] = inner.split("|");
  const target = beforeDisplay.replace(/\\$/, "").trim();
  const hash = target.indexOf("#");
  const namePart = hash === -1 ? target : target.slice(0, hash);
  const subpathPart = hash === -1 ? "" : target.slice(hash);
  return { text: target, name: parseLinkTarget(namePart), subpath: parseSubpath(subpathPart) };
}
