import { changesSince, isNewerVersion } from "./changes-since.ts";
import { describe, expect, test } from "vite-plus/test";

const changelog = [
  "# Changelog",
  "",
  "Intro.",
  "",
  "## Unreleased",
  "",
  "## 0.3.0 - 2027-02-01",
  "",
  "- Third.",
  "",
  "## 0.2.0 - 2027-01-01",
  "",
  "- Second.",
  "",
  "## 0.1.0 - 2026-12-01",
  "",
  "- First.",
  "",
].join("\n");

describe("changesSince", () => {
  test("keeps the sections newer than the old version, and skips empty ones", () => {
    expect({
      fromFirst: changesSince(changelog, { version: "0.1.0" }),
      fromNewest: changesSince(changelog, { version: "0.3.0" }),
      fromUnknown: changesSince(changelog, { version: "0.0.0" }).length,
      fromNewer: changesSince(changelog, { version: "0.10.0" }),
    }).toEqual({
      fromFirst: ["## 0.3.0 - 2027-02-01\n\n- Third.", "## 0.2.0 - 2027-01-01\n\n- Second."],
      fromNewest: [],
      fromUnknown: 3,
      fromNewer: [],
    });
  });

  test("compares versions number by number", () => {
    const pairs = [
      ["0.10.0", "0.9.0"],
      ["0.9.0", "0.10.0"],
      ["1.0.0", "1.0.0"],
      ["Unreleased", "0.1.0"],
    ];
    const newer = pairs.map(([version = "", than = ""]) => isNewerVersion(version, { than }));
    expect(newer).toEqual([true, false, false, false]);
  });
});
