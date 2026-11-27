import { describe, expect, test } from "vite-plus/test";
import { parseWikilinkTarget } from "./parse-wikilink-target.ts";
import { scanLines } from "./scan-lines.ts";
import { selectSection } from "./select-section.ts";

const guide = [
  "# Guide",
  "Intro text.",
  "## Setup: first steps",
  "Install it.",
  "### Linux",
  "Use apt.",
  "```sh",
  "# not a heading ^fake",
  "```",
  "## Use",
  "A first line",
  "and a second line. ^tip",
  "",
  "- step one ^steps",
  "  - sub step",
  "- step two",
  "",
  "| a | b |",
  "| - | - |",
  "",
  "^table",
].join("\n");

function select(target: string): string | undefined {
  const lines = selectSection(scanLines(guide), parseWikilinkTarget(target).subpath);
  if (lines === undefined) return undefined;
  const texts = lines.map((line) => line.text);
  return texts.join("\n");
}

interface BlockOptions {
  id: string;
}

function selectBlock(content: string, options: BlockOptions): string[] | undefined {
  const subpath = { kind: "block", id: options.id, text: `#^${options.id}` } as const;
  const lines = selectSection(scanLines(content), subpath);
  if (lines === undefined) return undefined;
  return lines.map((line) => line.text);
}

describe("selectSection", () => {
  test("takes a heading up to the next heading of the same or a higher level, as Obsidian does", () => {
    expect([
      select("guide#Setup first steps"),
      select("guide#guide#SETUP FIRST STEPS#linux"),
    ]).toEqual([
      "## Setup: first steps\nInstall it.\n### Linux\nUse apt.\n```sh\n# not a heading ^fake\n```",
      "### Linux\nUse apt.\n```sh\n# not a heading ^fake\n```",
    ]);
  });

  test("takes the paragraph, the list item or the block above a block id", () => {
    expect([select("guide#^tip"), select("guide#^steps"), select("guide#^table")]).toEqual([
      "A first line\nand a second line. ^tip",
      "- step one ^steps\n  - sub step",
      "| a | b |\n| - | - |",
    ]);
  });

  test("takes a whole code block above a block id, and stops a paragraph at a code block", () => {
    const content = "^top\n```js\nx\n\ny\n```\n\n^code\n```\nz\n```\nPara ^p\n";
    const blocks = [selectBlock(content, { id: "code" }), selectBlock(content, { id: "p" })];
    expect([...blocks, selectBlock(content, { id: "top" })]).toEqual([
      ["```js", "x", "", "y", "```"],
      ["Para ^p"],
      undefined,
    ]);
  });

  test("finds nothing for a missing heading, a heading in code or a block id in code", () => {
    expect([
      select("guide#Linux#Setup"),
      select("guide#not a heading"),
      select("guide#^fake"),
    ]).toEqual([undefined, undefined, undefined]);
  });
});
