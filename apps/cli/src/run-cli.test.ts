import { describe, expect, test } from "vite-plus/test";
import type { CliConfig } from "./config.ts";
import { fileURLToPath } from "node:url";
import { runCli } from "./run-cli.ts";
import { writeTestRepo } from "@zambil/core/write-test-repo";

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

const checkUsage = [
  "Usage: zambil check [--repo <path>]",
  "",
  "Report invalid notes and hook names that zambil never answers.",
  "It also warns about a hook name that zambil never answers. An error sets the exit code to 1. A warning does not.",
].join("\n");

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

  test("points to check, with the same --repo, when the repo has problems", async () => {
    const root = await writeTestRepo({ "my notes/a/same.md": "", "my notes/b/same.md": "" });
    const listed = await run(["list", "--repo", `${root}/my notes`]);
    expect(listed.stderr).toBe(
      `The repo has problems. Run \`zambil check --repo '${root}/my notes'\` to see them.\n`,
    );
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

  test("prints the help, and the usage of one command in every form", async () => {
    const help = await run([]);
    const rows = [];
    for (const line of help.stdout.split("\n")) {
      const [name, summary] = line.trim().split(/\s{2,}/);
      if (name === "check" || name === "list") rows.push([name, summary]);
    }
    const usages = [
      ["check", "--help"],
      ["help", "check"],
      ["--repo", "x", "check", "-h"],
    ];
    const printed = await Promise.all(usages.map(async (args) => (await run(args)).stdout));
    expect({ header: help.stdout.split("\n").slice(0, 3), rows, printed }).toEqual({
      header: ["Usage: zambil <command> [--repo <path>]", "", "Commands:"],
      rows: [
        ["check", "Report invalid notes and hook names that zambil never answers."],
        ["list", "List every note with its kind, path and description."],
      ],
      printed: usages.map(() => `${checkUsage}\n`),
    });
  });

  test("reads help as the first word or a flag, and as search text after the command", async () => {
    const afterRepo = await run(["--repo", "x", "help"]);
    const inText = await run(["search", "help", "me", "rebase"]);
    const afterDashes = await run(["search", "--", "--help"]);
    const firstLines = [afterRepo, inText, afterDashes].map(
      (result) => result.stdout.split("\n")[0],
    );
    const errors = [inText, afterDashes].map((result) => result.stderr.split("\n")[0]);
    expect({ firstLines, errors }).toEqual({
      firstLines: ["Usage: zambil <command> [--repo <path>]", "", ""],
      errors: [
        "zambil does not know where your configuration repo is. Do one of these:",
        "zambil does not know where your configuration repo is. Do one of these:",
      ],
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
    const flagFirst = await run(["--repo", "/my notes", "list"]);
    const repoNamedList = await run(["--repo", "list", "check"]);
    const unknownFlag = await run(["--version"]);
    const option = await run(["list", "--bogus"]);
    const results = [command, flagFirst, repoNamedList, unknownFlag];
    const firstLines = results.map((result) => result.stderr.split("\n")[0]);
    expect([command.code, ...firstLines, option]).toEqual([
      2,
      'zambil has no command "lst".',
      "Put the command first: zambil list --repo '/my notes'",
      "Put the command first: zambil check --repo list",
      'zambil has no option "--version".',
      {
        code: 2,
        stdout: "",
        stderr: "Unknown option '--bogus'\nUsage: zambil list [--repo <path>]\n",
      },
    ]);
  });
});
