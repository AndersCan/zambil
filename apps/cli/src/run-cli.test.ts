import { describe, expect, test } from "vite-plus/test";
import type { CliConfig } from "./config.ts";
import { fileURLToPath } from "node:url";
import { runCli } from "./run-cli.ts";

const sampleRepo = fileURLToPath(
  new URL("../../../packages/core/fixtures/sample-repo", import.meta.url),
);

interface RunOptions {
  config?: CliConfig;
  now?: Date;
}

async function run(args: string[], options: RunOptions = {}) {
  const printed = { stdout: "", stderr: "" };
  const output = {
    write: (text: string) => {
      printed.stdout += text;
    },
    error: (text: string) => {
      printed.stderr += text;
    },
  };
  const config = options.config ?? {
    environment: { home: "/home/ada", workingFolder: "/", configHome: "/nowhere" },
  };
  const input = { readAll: () => Promise.resolve("") };
  const now = options.now ?? new Date(2026, 10, 27);
  const code = await runCli(args, { config, input, output, now });
  return { code, ...printed };
}

describe("runCli", () => {
  test("lists the notes of the sample repo and marks an expired note", async () => {
    const after = await run(["list", "--repo", sampleRepo], { now: new Date(2026, 10, 28) });
    expect(after).toEqual({
      code: 0,
      stdout: [
        "NAME              KIND    PATH                        DESCRIPTION",
        "refresh-today     note    cache/refresh-today.md      How to refresh the today note.",
        "today             note    cache/today.md              (expired) The date of today.",
        "typescript-style  note    coding/typescript-style.md  How to write TypeScript in my projects.",
        "backup            script  scripts/backup.md           Back up the notes to a tar file.",
        "welcome           note    session/welcome.md          What to know at the start of every session.",
        "release           skill   skills/release/SKILL.md     Release a package to npm. Use when the user asks for a release.",
        "",
      ].join("\n"),
      stderr: "",
    });
  });

  test("checks the sample repo and finds no problems", async () => {
    expect(await run(["check", "--repo", sampleRepo])).toEqual({
      code: 0,
      stdout: "6 notes, no problems.\n",
      stderr: "",
    });
  });

  test("finds the repo from ZAMBIL_REPO", async () => {
    const config = { environment: { home: "/home/ada", workingFolder: "/", repo: sampleRepo } };
    const checked = await run(["check"], { config });
    expect(checked.code).toBe(0);
  });

  test("tells the user how to name a repo when none is set", async () => {
    expect(await run(["list"])).toEqual({
      code: 2,
      stdout: "",
      stderr: [
        "zambil does not know where your configuration repo is. Do one of these:",
        "  - pass --repo <path>",
        "  - set ZAMBIL_REPO=<path>",
        '  - write {"repo": "<path>"} to /nowhere/zambil/config.json',
        "",
      ].join("\n"),
    });
  });

  test("prints the help, and the usage of one command in both forms", async () => {
    const help = await run([]);
    const usage = await run(["check", "--help"]);
    const helpCheck = await run(["help", "check"]);
    expect({
      help: help.stdout.split("\n").slice(0, 5),
      usage,
      same: helpCheck.stdout === usage.stdout,
    }).toEqual({
      help: [
        "Usage: zambil <command> [--repo <path>]",
        "",
        "Commands:",
        "  check  Report duplicate names and other invalid notes.",
        "  list   List every note with its kind, path and description.",
      ],
      usage: {
        code: 0,
        stdout:
          "Usage: zambil check [--repo <path>]\n\nReport duplicate names and other invalid notes.\n",
        stderr: "",
      },
      same: true,
    });
  });

  test("shows the configuration file that zambil really reads in the help", async () => {
    const help = await run(["--help"]);
    expect(help.stdout.split("\n").at(-3)).toBe(
      "zambil finds your configuration repo from --repo, then ZAMBIL_REPO, then /nowhere/zambil/config.json.",
    );
  });

  test("rejects an unknown command, a flag before the command and an unknown option", async () => {
    const command = await run(["lst"]);
    const flagFirst = await run(["--repo", sampleRepo, "list"]);
    const option = await run(["list", "--bogus"]);
    expect([
      command.code,
      command.stderr.split("\n")[0],
      flagFirst.stderr.split("\n")[0],
      option,
    ]).toEqual([
      2,
      'zambil has no command "lst".',
      "Put the command first, for example: zambil list --repo",
      {
        code: 2,
        stdout: "",
        stderr: "Unknown option '--bogus'\nUsage: zambil list [--repo <path>]\n",
      },
    ]);
  });
});
