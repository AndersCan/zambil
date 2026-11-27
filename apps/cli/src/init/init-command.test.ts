import { chmod, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import type { CliConfig } from "../config.ts";
import { existsSync } from "node:fs";
import { initCommand } from "./init-command.ts";
import { join } from "node:path";
import { listCommand } from "../list/list-command.ts";
import { starterNoteText } from "./starter-note.ts";
import { tmpdir } from "node:os";

interface Machine {
  config: CliConfig;
  home: string;
  userConfig: string;
  settings: string;
}

/** A home folder with a `zambil` program on the path and no zambil setup yet. */
async function testMachine(): Promise<Machine> {
  const home = await mkdtemp(join(tmpdir(), "zambil-home-"));
  const bin = join(home, "bin");
  await mkdir(bin);
  await writeFile(join(bin, "zambil"), "#!/bin/sh\n");
  await chmod(join(bin, "zambil"), 0o755);
  const claude = join(home, "claude");
  const environment = { home, workingFolder: home, cacheHome: join(home, "cache") };
  const config = { environment, claudeConfigFolder: claude, searchPath: [bin] };
  const userConfig = join(home, ".config", "zambil", "config.json");
  return { config, home, userConfig, settings: join(claude, "settings.json") };
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface RunOptions {
  config: CliConfig;
  args: string[];
}

async function run(options: RunOptions): Promise<RunResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await initCommand.run({
    args: options.args,
    config: options.config,
    input: { readAll: () => Promise.resolve("") },
    output: { write: (text) => stdout.push(text), error: (text) => stderr.push(text) },
    now: new Date(2026, 10, 27, 9, 0),
  });
  return { code, stdout: stdout.join(""), stderr: stderr.join("") };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("zambil init", () => {
  test("sets up a new user in the default folder, and a second run changes nothing", async () => {
    const machine = await testMachine();
    const { config } = machine;
    const notes = join(machine.home, "zambil-notes");
    const first = await run({ config, args: ["--offline"] });
    const settings = await readFile(machine.settings, "utf8");
    const second = await run({ config, args: ["--offline"] });
    const list = await listCommand.run({
      args: [],
      config,
      input: { readAll: () => Promise.resolve("") },
      output: { write: () => undefined, error: () => undefined },
      now: new Date(2026, 10, 27, 9, 0),
    });
    expect({
      first: { ...first, stdout: first.stdout.split("\n") },
      files: await readdir(notes),
      note: await readFile(join(notes, "zambil-welcome.md"), "utf8"),
      userConfig: await readJson(machine.userConfig),
      hooks: Object.keys(JSON.parse(settings).hooks),
      second: { ...second, stdout: second.stdout.split("\n") },
      isSameSettings: (await readFile(machine.settings, "utf8")) === settings,
      list,
    }).toEqual({
      first: {
        code: 0,
        stdout: [
          `Saved the configuration repo ${notes} in ${machine.userConfig}.`,
          `Wrote the starter note zambil-welcome.md in ${notes}.`,
          "Skipped the hook list and the model, because of --offline. Run zambil index when you are online.",
          `Installed the zambil hooks (SessionStart, UserPromptSubmit) in ${machine.settings}.`,
          `The hooks read the configuration repo ${notes}.`,
          expect.stringContaining("Installed the zambil-save skill"),
          "Checked 1 note: no problems.",
          "",
          "Next:",
          "  1. Start a new Claude Code session. Its first reply says that the zambil-welcome note reached it.",
          '  2. Ask the agent for a note, for example: "Write a zambil note that we use pnpm, never npm."',
          `  3. Open ${notes} in Obsidian to read and edit the notes.`,
          "",
          "To keep the notes in another folder, run zambil init <folder>.",
          "",
        ],
        stderr: "",
      },
      files: ["zambil-welcome.md"],
      note: starterNoteText,
      userConfig: { repo: notes },
      hooks: ["SessionStart", "UserPromptSubmit"],
      second: {
        code: 0,
        stdout: expect.arrayContaining([
          `Kept ${notes} as it is. It already has files, so zambil wrote no starter note.`,
          expect.stringContaining("are up to date"),
        ]),
        stderr: "",
      },
      isSameSettings: true,
      list: 0,
    });
  });

  test("uses a folder with files as it is and keeps the other keys of the user config", async () => {
    const machine = await testMachine();
    const vault = join(machine.home, "vault");
    await mkdir(join(vault, ".obsidian"), { recursive: true });
    await writeFile(join(vault, ".obsidian", "app.json"), "{}\n");
    const deploy = "---\ndescription: Deploy.\n---\nShip it.\n";
    await writeFile(join(vault, "deploy.md"), deploy);
    await mkdir(join(machine.home, ".config", "zambil"), { recursive: true });
    await writeFile(machine.userConfig, '{ "repo": "~/old-notes", "theme": "dark" }\n');
    const result = await run({ config: machine.config, args: ["vault", "--offline"] });
    expect({
      code: result.code,
      stdout: result.stdout.split("\n").slice(0, 2),
      hasNextFolderHint: result.stdout.includes("zambil init <folder>"),
      files: await readdir(vault),
      deploy: await readFile(join(vault, "deploy.md"), "utf8"),
      userConfig: await readJson(machine.userConfig),
    }).toEqual({
      code: 0,
      stdout: [
        `Saved the configuration repo ${vault} in ${machine.userConfig}. It named ${machine.home}/old-notes before.`,
        `Kept ${vault} as it is. It already has files, so zambil wrote no starter note.`,
      ],
      hasNextFolderHint: false,
      files: [".obsidian", "deploy.md"],
      deploy,
      userConfig: { repo: vault, theme: "dark" },
    });
  });

  test("changes nothing when the user config is not JSON or the folder is a file", async () => {
    const machine = await testMachine();
    await mkdir(join(machine.home, ".config", "zambil"), { recursive: true });
    await writeFile(machine.userConfig, "{ repo: notes\n");
    const broken = await run({ config: machine.config, args: ["notes", "--offline"] });
    await writeFile(join(machine.home, "file.md"), "text\n");
    const file = await run({ config: machine.config, args: ["file.md", "--offline"] });
    expect({
      broken: { code: broken.code, stderr: broken.stderr },
      file: { code: file.code, stderr: file.stderr },
      hasFolder: existsSync(join(machine.home, "notes")),
      hasSettings: existsSync(machine.settings),
    }).toEqual({
      broken: {
        code: 1,
        stderr: expect.stringMatching(/^zambil cannot save the repo in .*: it is not valid JSON/),
      },
      file: {
        code: 2,
        stderr: `${machine.home}/file.md is a file, not a folder. Run zambil init <folder> with a folder.\n`,
      },
      hasFolder: false,
      hasSettings: false,
    });
  });
});
