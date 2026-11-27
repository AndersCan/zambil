import { parseWikilinkTarget } from "./parse-wikilink-target.ts";
import type { WikilinkTarget } from "./parse-wikilink-target.ts";

/** `[[name]]` links to a note, and `![[name]]` embeds it. */
export type WikilinkKind = "link" | "embed";

/** One link in a line of text, with its place in the line. */
export interface Wikilink {
  kind: WikilinkKind;
  raw: string;
  start: number;
  end: number;
  target: WikilinkTarget;
}

interface Span {
  start: number;
  end: number;
}

const codeSpanPattern = /(?<!`)(?<ticks>`+)(?!`)[^]*?(?<!`)\k<ticks>(?!`)/g;
const wikilinkPattern = /(?<bang>!?)\[\[(?<inner>[^[\]\n]+?)\]\]/g;

function codeSpans(text: string): Span[] {
  const spans: Span[] = [];
  for (const match of text.matchAll(codeSpanPattern)) {
    spans.push({ start: match.index, end: match.index + match[0].length });
  }
  return spans;
}

/** Finds the links and embeds in one line of text. A link inside an inline code span is plain text. */
export function findWikilinks(text: string): Wikilink[] {
  const spans = codeSpans(text);
  const links: Wikilink[] = [];
  for (const match of text.matchAll(wikilinkPattern)) {
    const start = match.index;
    const isInCode = spans.some((span) => start >= span.start && start < span.end);
    if (isInCode) continue;
    const kind = match.groups?.bang === "!" ? "embed" : "link";
    const target = parseWikilinkTarget(match.groups?.inner ?? "");
    links.push({ kind, raw: match[0], start, end: start + match[0].length, target });
  }
  return links;
}
