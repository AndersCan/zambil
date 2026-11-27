import { describe, expect, test } from "vite-plus/test";
import { formatNoteIndex, parseNoteIndex } from "./parse-note-index.ts";

const index = {
  modelKey: "model@1",
  root: "/notes",
  vectors: new Map([
    ["How to deploy.", Float32Array.of(0.5, -1)],
    ["Git.", Float32Array.of(2, 0.25)],
  ]),
};

function withEntries(entries: unknown[]): string {
  return JSON.stringify({ format: 2, modelKey: "model@1", root: "/notes", entries });
}

describe("parseNoteIndex", () => {
  test("reads what formatNoteIndex writes, and no index from a broken vector or another format", () => {
    const twoFloats = Buffer.from(Float32Array.of(1, 2).buffer).toString("base64");
    const oneFloat = Buffer.from(Float32Array.of(1).buffer).toString("base64");
    expect({
      roundTrip: parseNoteIndex(formatNoteIndex(index)),
      partialFloat: parseNoteIndex(withEntries([{ description: "Git.", vector: "abc" }])),
      mixedLengths: parseNoteIndex(
        withEntries([
          { description: "Git.", vector: twoFloats },
          { description: "Deploy.", vector: oneFloat },
        ]),
      ),
      otherFormat: parseNoteIndex(
        JSON.stringify({ format: 1, modelKey: "model@1", root: "/notes", entries: [] }),
      ),
      notJson: parseNoteIndex("{"),
    }).toEqual({
      roundTrip: index,
      partialFloat: undefined,
      mixedLengths: undefined,
      otherFormat: undefined,
      notJson: undefined,
    });
  });
});
