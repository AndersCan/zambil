import { describe, expect, test } from "vite-plus/test";
import { saveGuideCommand } from "./save-guide-command.ts";
import { saveSkillText } from "@zambil/claude-code/save-skill";

function runGuide(args: string[]) {
  const printed: string[] = [];
  const output = {
    write: (text: string) => printed.push(text),
    error: (text: string) => printed.push(text),
  };
  return saveGuideCommand.run({
    args,
    config: { environment: { home: "/home/ada", workingFolder: "/" } },
    input: { readAll: () => Promise.reject(new Error("read standard input")) },
    output,
    now: new Date(),
  });
}

describe("saveGuideCommand", () => {
  test("accepts the command line that the zambil-save skill tells the agent to run", async () => {
    const skill = saveSkillText({ repoRoot: "/home/ada/notes" });
    const line = /`zambil save-guide(?<args>[^`]*)`/.exec(skill)?.groups?.args ?? "";
    const args = line.trim().split(" ");
    expect({ args, code: await runGuide(args) }).toEqual({
      args: ["--repo", "/home/ada/notes"],
      code: 0,
    });
  });

  test("the zambil-save skill tells the agent to look for a note that covers it already", () => {
    const skill = saveSkillText({ repoRoot: "/home/ada/notes" });
    const steps = [
      'zambil search "<what the note is about>" --repo /home/ada/notes',
      "zambil list <word> --repo /home/ada/notes",
    ];
    expect(steps.filter((step) => !skill.includes(step))).toEqual([]);
  });

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
      'zambil search "<what the note is about>"',
      "zambil list <word>",
      "If a note covers it, change that note with --rewrite.",
      "Give the note an expires date",
      "Give it a when-expired note that tells how to update the note or verify its claims",
      "zambil save deploy --verified --expires",
      "--verified records that the claims still hold: give it a new expires date",
    ];
    expect({ code, missing: rules.filter((rule) => !text.includes(rule)) }).toEqual({
      code: 0,
      missing: [],
    });
  });
});
