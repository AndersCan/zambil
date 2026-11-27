import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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
    const files = await readdir(notes);
    const note = await readFile(join(notes, "zambil-welcome.md"), "utf8");
    const second = await run({ config, args: ["--offline"] });
    const list = await listCommand.run({
      args: [],
      config,
      input: { readAll: () => Promise.resolve("") },
      output: { write: () => undefined, error: () => undefined },
      now: new Date(2026, 10, 27, 9, 0),
    });
    const isSameSettings = (await readFile(machine.settings, "utf8")) === settings;
    await rm(join(notes, "zambil-welcome.md"));
    const afterDelete = await run({ config, args: ["--offline"] });
    expect({
      first: { ...first, stdout: first.stdout.split("\n") },
      files,
      note,
      userConfig: await readJson(machine.userConfig),
      hooks: Object.keys(JSON.parse(settings).hooks),
      second: { ...second, stdout: second.stdout.split("\n") },
      isSameSettings,
      list,
      afterDelete: { code: afterDelete.code, firstLine: afterDelete.stdout.split("\n")[0] },
      filesAfterDelete: await readdir(notes),
    }).toEqual({
      first: {
        code: 0,
        stdout: [
          `Wrote the starter note zambil-welcome.md in ${notes}.`,
          `Saved the configuration repo ${notes} in ${machine.userConfig}.`,
          "Skipped the hook list and the model, because of --offline. Run this command again when you are online.",
          `Installed the zambil hooks (SessionStart, UserPromptSubmit, SubagentStart) in ${machine.settings}.`,
          `The hooks read the configuration repo ${notes}.`,
          expect.stringContaining("Installed the zambil-save skill"),
          "Checked 1 note: no problems.",
          "",
          "Next:",
          "  1. Start a new Claude Code session. Its first reply says that the zambil-welcome note reached it.",
          '  2. Ask the agent for a note, for example: "Write a zambil note that we use pnpm, never npm."',
          `  3. Open ${notes} in Obsidian to read and edit the notes.`,
          "",
          "Run zambil init again after you change the version of Node.",
          "To keep the notes in another folder, run zambil init <folder>.",
          "",
        ],
        stderr: "",
      },
      files: ["zambil-welcome.md"],
      note: starterNoteText,
      userConfig: { repo: notes },
      hooks: ["SessionStart", "UserPromptSubmit", "SubagentStart"],
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
      afterDelete: {
        code: 0,
        firstLine: `Wrote the starter note zambil-welcome.md in ${notes}.`,
      },
      filesAfterDelete: ["zambil-welcome.md"],
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
    const newVault = join(machine.home, "new-vault");
    await mkdir(join(newVault, ".obsidian"), { recursive: true });
    const fresh = await run({ config: machine.config, args: ["--repo", newVault, "--offline"] });
    expect({
      code: result.code,
      stdout: result.stdout.split("\n").slice(0, 2),
      hasNextFolderHint: result.stdout.includes("zambil init <folder>"),
      files: await readdir(vault),
      deploy: await readFile(join(vault, "deploy.md"), "utf8"),
      userConfig: await readJson(machine.userConfig),
      fresh: { code: fresh.code, files: await readdir(newVault) },
    }).toEqual({
      code: 0,
      stdout: [
        `Kept ${vault} as it is. It already has files, so zambil wrote no starter note.`,
        `Saved the configuration repo ${vault} in ${machine.userConfig}. It named ${machine.home}/old-notes before.`,
      ],
      hasNextFolderHint: false,
      files: [".obsidian", "deploy.md"],
      deploy,
      userConfig: { repo: newVault, theme: "dark" },
      fresh: { code: 0, files: [".obsidian", "zambil-welcome.md"] },
    });
  });

  test("points at the Obsidian vault that holds the notes folder, not at the folder", async () => {
    const machine = await testMachine();
    const vault = join(machine.home, "vault");
    await mkdir(join(vault, ".obsidian"), { recursive: true });
    const inVault = await run({
      config: machine.config,
      args: [join(vault, "zambil"), "--offline"],
    });
    const atVault = await run({ config: machine.config, args: [vault, "--offline"] });
    const plain = await run({ config: machine.config, args: ["notes", "--offline"] });
    const starter = await readFile(join(vault, "zambil", "zambil-welcome.md"), "utf8");
    function obsidianStep(result: RunResult): string | undefined {
      return result.stdout.split("\n").find((line) => line.startsWith("  3. "));
    }
    expect({
      inVault: obsidianStep(inVault),
      atVault: obsidianStep(atVault),
      plain: obsidianStep(plain),
      starterObsidianLine: starter.split("\n").find((line) => line.includes("Obsidian")),
    }).toEqual({
      inVault: `  3. Open the Obsidian vault ${vault} to read and edit the notes. They are in its folder zambil.`,
      atVault: `  3. Open ${vault} in Obsidian to read and edit the notes.`,
      plain: `  3. Open ${join(machine.home, "notes")} in Obsidian to read and edit the notes.`,
      starterObsidianLine:
        "- The notes folder opens in Obsidian, as a vault or as a folder in a vault.",
    });
  });

  test("changes nothing when the user config is not JSON, the folder is a file or cannot be made", async () => {
    const machine = await testMachine();
    await mkdir(join(machine.home, ".config", "zambil"), { recursive: true });
    await writeFile(machine.userConfig, "{ repo: notes\n");
    const broken = await run({ config: machine.config, args: ["notes", "--offline"] });
    await writeFile(join(machine.home, "file.md"), "text\n");
    const file = await run({ config: machine.config, args: ["file.md", "--offline"] });
    await writeFile(machine.userConfig, '{ "repo": "~/locked/notes" }\n');
    await mkdir(join(machine.home, "locked"), { mode: 0o555 });
    const locked = await run({ config: machine.config, args: ["--offline"] });
    expect({
      broken: { code: broken.code, stderr: broken.stderr },
      file: { code: file.code, stderr: file.stderr },
      locked: { code: locked.code, stderr: locked.stderr.split("\n").slice(1) },
      hasFolder: existsSync(join(machine.home, "notes")),
      hasSettings: existsSync(machine.settings),
      userConfig: await readFile(machine.userConfig, "utf8"),
    }).toEqual({
      broken: {
        code: 1,
        stderr: expect.stringMatching(/^zambil cannot save the repo in .*: it is not valid JSON/),
      },
      file: {
        code: 2,
        stderr: `${machine.home}/file.md is a file, not a folder. Run zambil init <folder> with a folder.\n`,
      },
      locked: {
        code: 1,
        stderr: ["To keep the notes in another folder, run zambil init <folder>.", ""],
      },
      hasFolder: false,
      hasSettings: false,
      userConfig: '{ "repo": "~/locked/notes" }\n',
    });
  });
});
