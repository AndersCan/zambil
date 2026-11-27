import { describe, expect, test } from "vite-plus/test";
import { closestMatch } from "./closest-match.ts";

describe("closestMatch", () => {
  test("finds a typo, ignores case, and gives up on a word that is too far away", () => {
    const candidates = ["list", "check", "save", "save-guide", "search"];
    const typed = ["lst", "CHEK", "save-guid", "sav", "deploy", "x"];
    const matches = typed.map((word) => closestMatch(word, { candidates }));
    expect(matches).toEqual(["list", "check", "save-guide", "save", undefined, undefined]);
  });
});
