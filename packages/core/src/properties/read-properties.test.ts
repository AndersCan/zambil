import { describe, expect, test } from "vite-plus/test";
import { parseFrontmatter } from "./parse-frontmatter.ts";
import { readProperties } from "./read-properties.ts";

const empty = {
  name: undefined,
  description: undefined,
  aliases: [],
  tags: [],
  hooks: [],
  tools: [],
  expires: undefined,
  whenExpired: undefined,
  script: undefined,
  runWith: undefined,
};

describe("readProperties", () => {
  test("reads every known property", () => {
    const reading = readProperties({
      name: "release",
      description: "Ship a release.",
      aliases: ["ship", "deploy"],
      tags: ["#ops", "release/notes"],
      hooks: ["SessionStart"],
      tools: ["Bash"],
      expires: "2026-11-28",
      "when-expired": "[[refresh-date]]",
      script: "release.sh",
      "run-with": "bash",
    });
    expect(reading).toEqual({
      known: {
        name: "release",
        description: "Ship a release.",
        aliases: ["ship", "deploy"],
        tags: ["ops", "release/notes"],
        hooks: ["SessionStart"],
        tools: ["Bash"],
        expires: "2026-11-28",
        whenExpired: "refresh-date",
        script: "release.sh",
        runWith: "bash",
      },
      problems: [],
    });
  });

  test("splits a single text the way Obsidian does", () => {
    const reading = readProperties({
      aliases: "ship, deploy",
      tags: "ops, release notes",
      hooks: "Stop",
    });
    expect(reading).toEqual({
      known: {
        ...empty,
        aliases: ["ship", "deploy"],
        tags: ["ops", "release", "notes"],
        hooks: ["Stop"],
      },
      problems: [],
    });
  });

  test("treats empty values as absent and numbers as text", () => {
    const yaml = "description:\naliases:\n  -\n  - 2026\ntags: ''\ntools:\n";
    const properties = parseFrontmatter(yaml);
    const reading = properties.ok ? readProperties(properties.value) : properties.error;
    expect(reading).toEqual({ known: { ...empty, aliases: ["2026"] }, problems: [] });
  });

  test("reads the target of a link with a folder, heading or display text", () => {
    const targets = ["[[cache/refresh.md#Steps|refresh it]]", "refresh", "[[Refresh]]"].map(
      (whenExpired) => readProperties({ "when-expired": whenExpired }).known.whenExpired,
    );
    expect(targets).toEqual(["refresh", "refresh", "Refresh"]);
  });

  test("reports each property that has the wrong shape", () => {
    const reading = readProperties({
      description: ["a"],
      hooks: [{ event: "Stop" }],
      tags: { a: 1 },
    });
    expect(reading).toEqual({
      known: empty,
      problems: [
        "`description` must be text",
        "`tags` must be text or a list of text",
        "`hooks` must be text or a list of text",
      ],
    });
  });
});
