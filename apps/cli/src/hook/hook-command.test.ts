import { describe, expect, test } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hookCommand } from "./hook-command.ts";
import { writeTestRepo } from "@zambil/core/write-test-repo";

const main = fileURLToPath(new URL("../main.ts", import.meta.url));

interface HookRunOptions {
  stdin: string;
  repo: string | undefined;
}

async function runHook(args: string[], options: HookRunOptions) {
  const printed = { stdout: "", stderr: "" };
  const output = {
    write: (text: string) => {
      printed.stdout += text;
    },
    error: (text: string) => {
      printed.stderr += text;
    },
  };
  const environment = { home: "/home/ada", workingFolder: "/", configHome: "/nowhere" };
  const withRepo =
    options.repo === undefined ? environment : { ...environment, repo: options.repo };
  const code = await hookCommand.run({
    args,
    config: { environment: withRepo },
    input: { readAll: () => Promise.resolve(options.stdin) },
    output,
    now: new Date(2026, 10, 27),
  });
  return { code, ...printed };
}

const sessionStart = JSON.stringify({
  session_id: "s1",
  transcript_path: "/home/ada/.claude/projects/s1.jsonl",
  cwd: "/home/ada/shop",
  hook_event_name: "SessionStart",
  source: "startup",
});

describe("hookCommand", () => {
  test("exits with 0 and reports on standard error for bad input, no repo and a wrong option", async () => {
    const repo = await writeTestRepo({ "a.md": "---\nhooks: SessionStart\n---\nA.\n" });
    const results = await Promise.all([
      runHook([], { stdin: "not json", repo }),
      runHook([], { stdin: sessionStart, repo: undefined }),
      runHook([], { stdin: sessionStart, repo: "/no/such/repo" }),
      runHook(["--bogus"], { stdin: sessionStart, repo }),
      runHook([], { stdin: JSON.stringify({ hook_event_name: "Notification" }), repo: undefined }),
    ]);
    const summary = results.map((result) => [
      result.code,
      result.stdout,
      result.stderr.split("\n")[0],
    ]);
    expect(summary).toEqual([
      [
        0,
        "",
        `zambil hook: the input is not JSON: Unexpected token 'o', "not json" is not valid JSON`,
      ],
      [
        0,
        "",
        "zambil hook: zambil does not know where your configuration repo is. Do one of these:",
      ],
      [
        0,
        "",
        "zambil hook: zambil cannot read the configuration repo /no/such/repo (from ZAMBIL_REPO): ENOENT: no such file or directory, scandir '/no/such/repo'",
      ],
      [0, "", "zambil hook: Unknown option '--bogus'"],
      [0, "", ""],
    ]);
  });

  test("runs as a program: reads the payload on standard input and prints the hook JSON", async () => {
    const repo = await writeTestRepo({ "a.md": "---\nhooks: SessionStart\n---\nA.\n" });
    const stdout = execFileSync(main, ["hook", "--repo", repo], {
      input: sessionStart,
      encoding: "utf8",
    });
    expect(JSON.parse(stdout)).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: [
          "zambil reads notes from the user's configuration repo. These notes name the SessionStart hook:",
          "",
          '<note name="a" path="a.md">',
          "A.",
          "</note>",
        ].join("\n"),
      },
    });
  });
});
