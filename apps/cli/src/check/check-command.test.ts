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
});
