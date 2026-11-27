import { describe, expect, test } from "vite-plus/test";
import { splitFrontmatter } from "./split-frontmatter.ts";

describe("splitFrontmatter", () => {
  test("splits the YAML from the content", () => {
    const split = splitFrontmatter("---\ndescription: Hi\n---\n# Title\n");
    expect(split).toEqual({ frontmatter: "description: Hi\n", content: "# Title\n" });
  });

  test("reads Windows line ends and a byte order mark", () => {
    const split = splitFrontmatter("﻿---\r\ntags: a\r\n---\r\nBody");
    expect(split).toEqual({ frontmatter: "tags: a\r\n", content: "Body" });
  });

  test("reads empty frontmatter and frontmatter at the end of the file", () => {
    expect([splitFrontmatter("---\n---\nBody"), splitFrontmatter("---\na: 1\n---")]).toEqual([
      { frontmatter: "", content: "Body" },
      { frontmatter: "a: 1\n", content: "" },
    ]);
  });

  test("treats a note without a closing line as content only", () => {
    expect(splitFrontmatter("---\na: 1\nBody")).toEqual({ content: "---\na: 1\nBody" });
  });

  test("ignores a rule that is not on the first line", () => {
    expect(splitFrontmatter("\n---\na: 1\n---\n")).toEqual({ content: "\n---\na: 1\n---\n" });
  });
});
