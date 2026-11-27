import { isNever } from "../is-never.ts";
import type { MarkdownLine } from "./scan-lines.ts";
import type { Subpath } from "./parse-wikilink-target.ts";

interface Range {
  start: number;
  end: number;
  level: number;
}

const blockMarker = /(?:^|\s)\^(?<id>[\w-]+)\s*$/;
const listItem = /^(?<indent>\s*)(?:[-*+]|\d+[.)])\s/;

/** Obsidian drops these characters from a heading in a link and compares without regard to case. */
function headingKey(title: string): string {
  return title
    .replaceAll(/[#|^:%[\]\\]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isBlank(line: MarkdownLine | undefined): boolean {
  return line === undefined || line.text.trim() === "";
}

function sectionEnd(lines: MarkdownLine[], range: Range): number {
  for (let index = range.start + 1; index < range.end; index += 1) {
    const line = lines[index];
    if (line?.kind === "heading" && line.level <= range.level) return index;
  }
  return range.end;
}

interface HeadingOptions {
  headings: string[];
}

function headingRange(lines: MarkdownLine[], options: HeadingOptions): Range | undefined {
  let range: Range = { start: -1, end: lines.length, level: 0 };
  for (const wanted of options.headings) {
    const key = headingKey(wanted);
    let found: Range | undefined = undefined;
    for (let index = range.start + 1; index < range.end; index += 1) {
      const line = lines[index];
      const isMatch = line?.kind === "heading" && line.level > range.level;
      if (!isMatch || headingKey(line.title) !== key) continue;
      found = { start: index, end: range.end, level: line.level };
      break;
    }
    if (found === undefined) return undefined;
    range = { ...found, end: sectionEnd(lines, found) };
  }
  return range;
}

function indentOf(text: string): number {
  return (/^\s*/.exec(text)?.[0] ?? "").length;
}

interface BlockOptions {
  marker: number;
}

function itemEnd(lines: MarkdownLine[], options: BlockOptions): number {
  const itemIndent = indentOf(lines[options.marker]?.text ?? "");
  let end = options.marker + 1;
  for (let index = end; index < lines.length; index += 1) {
    const line = lines[index];
    if (isBlank(line)) continue;
    if (indentOf(line?.text ?? "") <= itemIndent) break;
    end = index + 1;
  }
  return end;
}

function paragraphStart(lines: MarkdownLine[], options: BlockOptions): number {
  let start = options.marker;
  while (start > 0 && !isBlank(lines[start - 1]) && lines[start - 1]?.kind !== "heading") {
    start -= 1;
  }
  return start;
}

function blockAbove(lines: MarkdownLine[], options: BlockOptions): Range {
  let end = options.marker;
  while (end > 0 && isBlank(lines[end - 1])) end -= 1;
  return { start: paragraphStart(lines, { marker: end - 1 }), end, level: 0 };
}

function paragraph(lines: MarkdownLine[], options: BlockOptions): Range {
  let end = options.marker + 1;
  while (!isBlank(lines[end]) && lines[end]?.kind === "text") end += 1;
  return { start: paragraphStart(lines, options), end, level: 0 };
}

function blockRange(lines: MarkdownLine[], options: BlockOptions): Range {
  const text = lines[options.marker]?.text ?? "";
  if (text.replace(blockMarker, "").trim() === "") return blockAbove(lines, options);
  if (listItem.test(text)) return { start: options.marker, end: itemEnd(lines, options), level: 0 };
  return paragraph(lines, options);
}

interface BlockSelection {
  id: string;
}

function selectBlock(lines: MarkdownLine[], options: BlockSelection): MarkdownLine[] | undefined {
  const marker = lines.findIndex((line) => {
    const id = line.kind === "text" ? blockMarker.exec(line.text)?.groups?.id : undefined;
    return id?.toLowerCase() === options.id.toLowerCase();
  });
  if (marker === -1) return undefined;
  const range = blockRange(lines, { marker });
  return lines.slice(range.start, range.end);
}

/** A line without its block id, which Obsidian hides in reading view. */
export function removeBlockId(text: string): string {
  return blockMarker.test(text) ? text.replace(blockMarker, "").trimEnd() : text;
}

/**
 * The lines that a subpath points to, as an Obsidian embed shows them. A heading takes its section up
 * to the next heading of the same or a higher level. A block id at the end of a paragraph or a list
 * item takes that block, and a block id alone on a line takes the block above it.
 */
export function selectSection(lines: MarkdownLine[], subpath: Subpath): MarkdownLine[] | undefined {
  switch (subpath.kind) {
    case "whole":
      return lines;
    case "heading": {
      const range = headingRange(lines, { headings: subpath.headings });
      return range === undefined ? undefined : lines.slice(range.start, range.end);
    }
    case "block":
      return selectBlock(lines, { id: subpath.id });
    default:
      return isNever(subpath);
  }
}
