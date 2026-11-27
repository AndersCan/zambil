import { describe, expect, test } from "vite-plus/test";
import { saveGuideCommand } from "./save-guide-command.ts";

describe("saveGuideCommand", () => {
  test("prints the rules for writing a note", async () => {
    const printed: string[] = [];
    const output = {
      write: (text: string) => printed.push(text),
      error: (text: string) => printed.push(text),
    };
    const code = await saveGuideCommand.run({
      args: [],
      config: { environment: { home: "/home/ada", workingFolder: "/" } },
      input: { readAll: () => Promise.reject(new Error("read standard input")) },
      output,
      now: new Date(),
    });
    const text = printed.join("");
    const rules = [
      "Write a note only when the user asks for it.",
      "Give the note an expires date",
      "Give it a when-expired note that tells how to update the note or verify its claims",
      "zambil save deploy --verified --expires",
      "--verified records that the claims still hold: give it a later expires date",
    ];
    expect({ code, missing: rules.filter((rule) => !text.includes(rule)) }).toEqual({
      code: 0,
      missing: [],
    });
  });
});
