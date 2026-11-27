import { describe, expect, test } from "vite-plus/test";
import { parseFrontmatter } from "./parse-frontmatter.ts";

describe("parseFrontmatter", () => {
  test("keeps dates as text and reads lists", () => {
    const parsed = parseFrontmatter("expires: 2026-11-28\ntags:\n  - ops\nenabled: yes\n");
    expect(parsed).toEqual({
      ok: true,
      value: { expires: "2026-11-28", tags: ["ops"], enabled: "yes" },
    });
  });

  test("reads an empty block as no properties", () => {
    expect([parseFrontmatter(""), parseFrontmatter("# only a comment\n")]).toEqual([
      { ok: true, value: {} },
      { ok: true, value: {} },
    ]);
  });

  test("reports YAML that does not parse or is not a mapping", () => {
    const broken = parseFrontmatter("tags: [a\n");
    const notMapping = parseFrontmatter("- a\n- b\n");
    expect({
      broken: broken.ok === false && broken.error.startsWith("the frontmatter is not valid YAML: "),
      notMapping,
    }).toEqual({
      broken: true,
      notMapping: { ok: false, error: "the frontmatter is not a list of properties" },
    });
  });
});
