import { describe, expect, test } from "vite-plus/test";
import { changesSince } from "./changes-since.ts";

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
    }).toEqual({
      fromFirst: ["## 0.3.0 - 2027-02-01\n\n- Third.", "## 0.2.0 - 2027-01-01\n\n- Second."],
      fromNewest: [],
      fromUnknown: 3,
    });
  });
});
