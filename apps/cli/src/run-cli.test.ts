import { describe, expect, test } from "vite-plus/test";
import type { CliConfig } from "./config.ts";
import { commands } from "./commands.ts";
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
  "It prints one line for each problem, with the path of the note. An error, such as two notes with the same name, sets the exit code to 1. A warning does not.",
  "",
  "Options:",
  "  --repo <path>  The folder of your configuration repo. Without it, zambil reads ZAMBIL_REPO, then its configuration file.",
  "  -h, --help     Print this help.",
  "",
].join("\n");

/** The commands whose help this file checks against the options that they accept: every command. */
const documentedCommands = Object.keys(commands);

interface SectionOptions {
  heading: string;
}

/** The command names in the block of the help under the heading. */
function namesUnder(text: string, options: SectionOptions): string[] {
  const lines = text.split("\n");
  const start = lines.indexOf(options.heading) + 1;
  const end = lines.indexOf("", start);
  const names: string[] = [];
  for (const line of lines.slice(start, end)) names.push(line.trim().split(" ")[0] ?? "");
  return names;
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

  test("tells the user to run zambil init when no repo is set", async () => {
    expect(await run(["list"])).toEqual({
      code: 2,
      stdout: "",
      stderr: [
        "zambil does not know where your configuration repo is.",
        "Run `zambil init` to set up zambil.",
        'Or write {"repo": "<path>"} to /nowhere/zambil/config.json, set ZAMBIL_REPO=<path>, or add --repo <path> to the command.',
        "",
      ].join("\n"),
    });
  });

  test("says in plain words that the repo is missing or a file, and where the path came from", async () => {
    const root = await writeTestRepo({ "notes.md": "" });
    const missing = await run(["list", "--repo", `${root}/gone`]);
    const file = await run(["check", "--repo", `${root}/notes.md`]);
    const environment = { home: "/home/ada", workingFolder: "/", repo: `${root}/gone` };
    const fromVariable = await run(["list"], { config: { environment } });
    expect([missing, file, fromVariable]).toEqual([
      {
        code: 2,
        stdout: "",
        stderr: `The configuration repo ${root}/gone does not exist.\nThe path comes from --repo "${root}/gone". Fix the path, or create the folder.\n`,
      },
      {
        code: 2,
        stdout: "",
        stderr: `The configuration repo ${root}/notes.md is not a folder.\nThe path comes from --repo "${root}/notes.md". Fix the path.\n`,
      },
      {
        code: 2,
        stdout: "",
        stderr: `The configuration repo ${root}/gone does not exist.\nThe path comes from ZAMBIL_REPO="${root}/gone". Fix ZAMBIL_REPO, or unset it and run \`zambil init\`.\n`,
      },
    ]);
  });

  test("explains how the configuration file reads a relative path and a $HOME path", async () => {
    const written = ["notes", "$HOME/notes"];
    const results = await Promise.all(
      written.map(async (path) => {
        const configHome = await writeTestRepo({
          "zambil/config.json": JSON.stringify({ repo: path }),
        });
        const environment = { home: "/home/ada", workingFolder: "/", configHome };
        const result = await run(["list"], { config: { environment } });
        return result.stderr.replaceAll(configHome, "<config>");
      }),
    );
    expect(results).toEqual([
      [
        "The configuration repo <config>/zambil/notes does not exist.",
        'The path comes from "repo": "notes" in <config>/zambil/config.json.',
        "zambil reads a relative path from the folder of that file. Write a path that starts with ~/ or /.",
        "Fix the path in that file, or run `zambil init` to set up zambil.",
        "",
      ].join("\n"),
      [
        "The configuration repo <config>/zambil/$HOME/notes does not exist.",
        'The path comes from "repo": "$HOME/notes" in <config>/zambil/config.json.',
        "zambil does not expand $HOME or other variables in that file. Write a path that starts with ~/ or /.",
        "Fix the path in that file, or run `zambil init` to set up zambil.",
        "",
      ].join("\n"),
    ]);
  });

  test("says how to create the first note when the repo is empty", async () => {
    const root = await writeTestRepo({});
    const results = await Promise.all(
      [["list"], ["check"], ["search", "deploy"]].map((args) => run([...args, "--repo", root])),
    );
    const hint = [
      `The repo ${root} has no notes yet. A note is a Markdown file in that folder.`,
      "To create the first one, write the file in your editor, or run:",
      `  printf '%s\\n' '---' 'description: How I like my code reviewed.' '---' 'Point out bugs first.' | zambil save code-review --no-expires --repo ${root}`,
      "Then type z:code-review in a Claude Code prompt to add the note to it.",
      "",
    ].join("\n");
    expect(results).toEqual([
      { code: 0, stdout: hint, stderr: "" },
      { code: 0, stdout: `0 notes, no problems.\n${hint}`, stderr: "" },
      { code: 0, stdout: hint, stderr: "" },
    ]);
  });

  test("starts the help with how to get started, and lists the agent commands apart", async () => {
    const agentHeading = "Commands that the agent and its hooks run. You do not need to run them:";
    const bare = await run([]);
    const help = await run(["help"]);
    const helpHelp = await run(["help", "help"]);
    expect({
      same: bare.stdout === help.stdout && helpHelp.stdout === help.stdout,
      code: help.code,
      top: help.stdout.split("\n").slice(0, 8),
      user: namesUnder(help.stdout, { heading: "Commands:" }),
      agent: namesUnder(help.stdout, { heading: agentHeading }),
    }).toEqual({
      same: true,
      code: 0,
      top: [
        "zambil adds the notes of your configuration repo, a folder of Markdown notes, to your Claude Code sessions.",
        "",
        "Usage: zambil <command> [options]",
        "",
        "Get started:",
        "  1. Run `zambil init` to create your configuration repo and connect it to Claude Code.",
        "  2. Run `zambil list` to see your notes.",
        "  3. In Claude Code, type z:<name> in a prompt to add the note <name> to it.",
      ],
      user: Object.keys(commands).filter((name) => name !== "hook" && name !== "save-guide"),
      agent: ["hook", "save-guide"],
    });
  });

  test("prints the usage and options of one command in every form", async () => {
    const usages = [
      ["check", "--help"],
      ["help", "check"],
      ["--repo", "x", "check", "-h"],
      ["--repo", "help", "help", "check"],
    ];
    const printed = await Promise.all(usages.map((args) => run(args)));
    expect(printed).toEqual(usages.map(() => ({ code: 0, stdout: checkUsage, stderr: "" })));
  });

  test("names the same options in the usage line, the help and the parser of each command", async () => {
    const results = await Promise.all(
      documentedCommands.map(async (name) => {
        const help = await run([name, "--help"]);
        const refused = await run([name, "--qqqqqqqq"]);
        const [usage = ""] = help.stdout.split("\n\n");
        const [, options = ""] = help.stdout.split("\nOptions:\n");
        const accepted = refused.stderr.split("\n")[0]?.split(" It takes ")[1] ?? "";
        return { name, usage, options, accepted };
      }),
    );
    const mismatched: string[] = [];
    for (const { name, usage, options, accepted } of results) {
      const usageFlags = new Set([...(usage.match(/--[a-z-]+/g) ?? []), "--help"]);
      const helpFlags = new Set(options.match(/--[a-z-]+/g));
      const parserFlags = new Set(accepted.match(/--[a-z-]+/g));
      const isSame = usageFlags.symmetricDifference(helpFlags).size === 0;
      const isAccepted = helpFlags.symmetricDifference(parserFlags).size === 0;
      if (!isSame || !isAccepted) mismatched.push(name);
    }
    expect(mismatched).toEqual([]);
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
      firstLines: [
        "zambil adds the notes of your configuration repo, a folder of Markdown notes, to your Claude Code sessions.",
        "",
        "",
      ],
      errors: [
        "zambil does not know where your configuration repo is.",
        "zambil does not know where your configuration repo is.",
      ],
    });
  });

  test("shows the configuration file that zambil really reads in the help", async () => {
    const help = await run(["--help"]);
    expect(help.stdout.split("\n").at(-3)).toBe(
      "zambil finds your configuration repo from --repo, then ZAMBIL_REPO, then /nowhere/zambil/config.json.",
    );
  });

  test("prints the version, also before a command", async () => {
    const results = await Promise.all(
      [["--version"], ["--version", "list"], ["--repo", "x", "--version"]].map((args) => run(args)),
    );
    const shown = results.map((result) => ({
      ...result,
      stdout: result.stdout.replace(/\d+\.\d+\.\d+/, "<version>"),
    }));
    const version = { code: 0, stdout: "zambil <version>\n", stderr: "" };
    expect(shown).toEqual([version, version, version]);
  });

  test("answers a mistyped or unknown command in two lines, also for help", async () => {
    const typed = [
      ["lsit"],
      ["hepl"],
      ["deploy"],
      ["help", "lst"],
      ["deploy", "--help"],
      ["--repo", "x", "lst"],
    ];
    const results = await Promise.all(typed.map((args) => run(args)));
    const seeHelp = "Run `zambil help` to see every command.\n";
    function refused(stderr: string) {
      return { code: 2, stdout: "", stderr: `${stderr}\n${seeHelp}` };
    }
    expect(results).toEqual([
      refused('zambil has no command "lsit". Did you mean `zambil list`?'),
      refused('zambil has no command "hepl". Did you mean `zambil help`?'),
      refused('zambil has no command "deploy".'),
      refused('zambil has no command "lst". Did you mean `zambil help list`?'),
      refused('zambil has no command "deploy".'),
      refused('zambil has no command "lst". Did you mean `zambil list`?'),
    ]);
  });

  test("rejects a flag before the command and an unknown option", async () => {
    const flagFirst = await run(["--repo", "/my notes", "list"]);
    const repoNamedList = await run(["--repo", "list", "check"]);
    const unknownFlag = await run(["--bogus"]);
    const option = await run(["list", "--bogus"]);
    const typo = await run(["uninstall", "--hlep"]);
    expect([flagFirst, repoNamedList, unknownFlag, option, typo]).toEqual([
      { code: 2, stdout: "", stderr: "Put the command first: zambil list --repo '/my notes'\n" },
      { code: 2, stdout: "", stderr: "Put the command first: zambil check --repo list\n" },
      {
        code: 2,
        stdout: "",
        stderr: 'zambil has no option "--bogus".\nRun `zambil help` to see every command.\n',
      },
      {
        code: 2,
        stdout: "",
        stderr: [
          'This command has no option "--bogus". It takes --repo and --help.',
          "Usage: zambil list [--repo <path>]",
          "",
        ].join("\n"),
      },
      {
        code: 2,
        stdout: "",
        stderr:
          'This command has no option "--hlep". Did you mean `--help`?\nUsage: zambil uninstall [--repo <path>]\n',
      },
    ]);
  });
});
