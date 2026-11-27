import { describe, expect, test } from "vite-plus/test";
import { parseVocabulary, tokenize } from "./word-piece.ts";

const vocabularyText = [
  "[PAD]",
  "[UNK]",
  "[CLS]",
  "[SEP]",
  "for",
  "loop",
  "##s",
  ",",
  "naive",
  "##ly",
  "x",
].join("\n");

function vocabulary() {
  const parsed = parseVocabulary(vocabularyText);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

describe("tokenize", () => {
  test("lowercases, strips accents, splits punctuation and words into pieces", () => {
    const ids = tokenize("For\tLOOPS, naïvely!  loopz", {
      vocabulary: vocabulary(),
      maxTokens: 512,
    });
    expect(ids).toEqual([2, 4, 5, 6, 7, 8, 9, 1, 1, 3]);
  });

  test("reads only 100 characters per token, so a huge text gives the same ids as its start", () => {
    const start = "loops ".repeat(100);
    const tail = "for ".repeat(250_000);
    const huge = `${start}${tail}`;
    const options = { vocabulary: vocabulary(), maxTokens: 5 };
    expect(tokenize(huge, options)).toEqual(tokenize(start, options));
  });

  test("cuts a long text so that the start and end tokens still fit", () => {
    const ids = tokenize("x x x x x x", { vocabulary: vocabulary(), maxTokens: 5 });
    expect(ids).toEqual([2, 10, 10, 10, 3]);
  });
});

describe("parseVocabulary", () => {
  test("needs the special tokens", () => {
    expect(parseVocabulary("for\nloop\n")).toEqual({
      ok: false,
      error: "the vocabulary has no [CLS], [SEP] or [UNK] token",
    });
  });
});
