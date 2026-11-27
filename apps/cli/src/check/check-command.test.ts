import { describe, expect, test } from "vite-plus/test";
import { checkCommand } from "./check-command.ts";
import { writeTestRepo } from "@zambil/core/write-test-repo";

describe("checkCommand", () => {
  test("prints each problem with its path and exits with 1 when one is an error", async () => {
    const root = await writeTestRepo({
      "ops/deploy.md": "---\ndescription: Deploy.\n---\n",
      "skills/deploy/SKILL.md": "---\nname: deploy\n---\n",
    });
    const printed: string[] = [];
    const output = {
      write: (text: string) => printed.push(text),
      error: (text: string) => printed.push(text),
    };
    const environment = { home: "/home/ada", workingFolder: "/" };
    const code = await checkCommand.run({
      args: ["--repo", root],
      config: { environment },
      input: { readAll: () => Promise.resolve("") },
      output,
      now: new Date(),
    });
    expect({ code, printed: printed.join("") }).toEqual({
      code: 1,
      printed: [
        'ops/deploy.md: error: the name "deploy" is used by 2 notes: ops/deploy.md, skills/deploy/SKILL.md',
        "skills/deploy/SKILL.md: warning: a skill needs a `description`, so that the agent knows when to load it",
        "1 error and 1 warning in 2 notes.",
        "",
      ].join("\n"),
    });
  });

  test("warns about a hook name that Claude Code cannot answer, with the bundled hook list", async () => {
    const root = await writeTestRepo({
      "alerts.md": "---\nhooks: [Notification, SessionStart]\n---\n",
      "typo.md": "---\nhooks: userpromptsubmit\n---\n",
    });
    const printed: string[] = [];
    const output = {
      write: (text: string) => printed.push(text),
      error: (text: string) => printed.push(text),
    };
    const environment = { home: "/home/ada", workingFolder: "/" };
    const code = await checkCommand.run({
      args: ["--repo", root],
      config: { environment },
      input: { readAll: () => Promise.resolve("") },
      output,
      now: new Date(),
    });
    expect({ code, printed: printed.join("") }).toEqual({
      code: 0,
      printed: [
        'alerts.md: warning: `hooks` names "Notification", but that Claude Code hook cannot add context, so the note never shows there',
        'typo.md: warning: `hooks` names "userpromptsubmit", but the Claude Code hooks reference of 2026-11-27 has no such hook. Names compare exactly: write "UserPromptSubmit"',
        "0 errors and 2 warnings in 2 notes.",
        "",
      ].join("\n"),
    });
  });
});
