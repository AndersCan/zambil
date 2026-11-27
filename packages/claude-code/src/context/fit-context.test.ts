import { defaultBudget, fitContext } from "./fit-context.ts";
import { describe, expect, test } from "vite-plus/test";

interface BlockOptions {
  size: number;
}

function block(name: string, options: BlockOptions) {
  const filler = "x".repeat(options.size);
  return { key: name, text: `${name}:${filler}`, pointer: `Read ${name}.` };
}

const findMore = "Run zambil list.";

describe("fitContext", () => {
  test("adds each note once, in order, and puts a pointer in place of each note that does not fit", () => {
    const sections = [
      { heading: "Named:", blocks: [block("a", { size: 10 }), block("b", { size: 500 })] },
      {
        heading: "Hook:",
        blocks: [block("a", { size: 10 }), block("c", { size: 10 }), block("d", { size: 10 })],
      },
    ];
    const text = fitContext(sections, { budget: { full: 50, total: 435 }, findMore });
    expect(text.split("\n")).toEqual([
      "Named:",
      "",
      "a:xxxxxxxxxx",
      "",
      "Hook:",
      "",
      "c:xxxxxxxxxx",
      "",
      "These notes match too, but zambil left them out to keep the context short:",
      "- Read b.",
      "- 1 more notes are not listed. Run zambil list.",
    ]);
  });

  test("stays under the 10,000 characters that Claude Code shows in full, and is empty for no notes", () => {
    const blocks = [];
    for (let index = 0; index < 200; index += 1) {
      blocks.push(block(`note-${index}`, { size: 1500 }));
    }
    const text = fitContext([{ heading: "Hook:", blocks }], { budget: defaultBudget, findMore });
    const empty = fitContext([{ heading: "Hook:", blocks: [] }], {
      budget: defaultBudget,
      findMore,
    });
    expect({ fits: text.length < 10_000, empty }).toEqual({ fits: true, empty: "" });
  });
});
