import { describe, expect, test } from "vite-plus/test";
import { findInlineTags } from "./find-inline-tags.ts";

describe("findInlineTags", () => {
  test("finds tags in prose and nested tags", () => {
    expect(findInlineTags("#ops Deploy with care. #release/notes and #täglich\n")).toEqual([
      "ops",
      "release/notes",
      "täglich",
    ]);
  });

  test("skips headings, numbers, links and code", () => {
    const content = [
      "# Heading",
      "Issue #123 and https://example.com/#anchor",
      "`#inline-code`",
      "```sh",
      "echo #fenced",
      "```",
      "after #kept",
    ].join("\n");
    expect(findInlineTags(content)).toEqual(["kept"]);
  });
});
