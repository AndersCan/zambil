import { describe, expect, test } from "vite-plus/test";
import { parseExpires } from "./parse-expires.ts";

describe("parseExpires", () => {
  test("reads a date and a date and time as local time", () => {
    expect([
      parseExpires("2026-11-28"),
      parseExpires("2026-11-28T09:30"),
      parseExpires("2026-11-28 09:30:15"),
    ]).toEqual([
      { kind: "at", time: new Date(2026, 10, 28) },
      { kind: "at", time: new Date(2026, 10, 28, 9, 30) },
      { kind: "at", time: new Date(2026, 10, 28, 9, 30, 15) },
    ]);
  });

  test("reads a time with a zone as that moment", () => {
    expect([parseExpires("2026-11-28T09:30:00Z"), parseExpires("2026-11-28T09:30+02:00")]).toEqual([
      { kind: "at", time: new Date(Date.UTC(2026, 10, 28, 9, 30)) },
      { kind: "at", time: new Date(Date.UTC(2026, 10, 28, 7, 30)) },
    ]);
  });

  test("never expires without a value", () => {
    expect(parseExpires(undefined)).toEqual({ kind: "never" });
  });

  test("marks text that is not a real date as unreadable", () => {
    expect(["tomorrow", "2026-02-30", "28.11.2026"].map((text) => parseExpires(text))).toEqual([
      { kind: "unreadable", text: "tomorrow" },
      { kind: "unreadable", text: "2026-02-30" },
      { kind: "unreadable", text: "28.11.2026" },
    ]);
  });
});
