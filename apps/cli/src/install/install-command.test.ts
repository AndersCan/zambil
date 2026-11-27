import { chmod, mkdir, mkdtemp, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import type { CliConfig } from "../config.ts";
import type { Command } from "../command.ts";
import { existsSync } from "node:fs";
import { hookCommandLine } from "@zambil/claude-code/hook-command-line";
import { installCommand } from "./install-command.ts";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { uninstallCommand } from "./uninstall-command.ts";
import { writeTestRepo } from "@zambil/core/write-test-repo";

const notes = {
  "welcome.md": "---\ndescription: Welcome.\nhooks: [SessionStart]\n---\nHello.\n",
  "shell.md":
    "---\ndescription: Shell.\nhooks: [PreToolUse, Notification]\ntools: Bash\n---\nQuote paths.\n",
};

/** Settings of the user from before the install: other keys and a hook of their own. */
const userSettings = {
  model: "opus",
  hooks: {
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "npm run lint" }] }],
  },
};

interface Machine {
  config: CliConfig;
  repo: string;
  settings: string;
  skill: string;
  zambil: string;
  userConfig: string;
  nodeFolders: string[];
}

/** A `node` in the folder of one version, and a link to it in a folder that a version manager updates. */
async function writeNode(home: string): Promise<string[]> {
  const version = join(home, "versions", "24.1.0", "bin");
  const shims = join(home, "shims");
  await mkdir(version, { recursive: true });
  await mkdir(shims);
  await writeFile(join(version, "node"), "#!/bin/sh\n");
  await chmod(join(version, "node"), 0o755);
  await symlink(join(version, "node"), join(shims, "node"));
  return [shims, version];
}

/** A home folder with a Claude Code folder, a `zambil` program on the path and a configuration repo. */
async function testMachine(): Promise<Machine> {
  const home = await mkdtemp(join(tmpdir(), "zambil-home-"));
  const bin = join(home, "bin");
  const zambil = join(bin, "zambil");
  await mkdir(bin);
  await writeFile(zambil, "#!/bin/sh\n");
  await chmod(zambil, 0o755);
  const claude = join(home, "claude");
  await mkdir(claude);
  const settings = join(claude, "settings.json");
  await writeFile(settings, `${JSON.stringify(userSettings, undefined, 4)}\n`);
  const repo = await writeTestRepo(notes);
  const nodeFolders = await writeNode(home);
  const environment = { home, workingFolder: home, cacheHome: join(home, "cache") };
  const searchPath = ["relative/bin", bin, nodeFolders[0] ?? ""];
  const config = { environment, claudeConfigFolder: claude, searchPath };
  const skill = join(claude, "skills", "zambil-save", "SKILL.md");
  const userConfig = join(home, ".config", "zambil", "config.json");
  return { config, repo, settings, skill, zambil, userConfig, nodeFolders };
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

async function run(command: Command, options: RunOptions): Promise<RunResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await command.run({
    args: options.args,
    config: options.config,
    input: { readAll: () => Promise.resolve("") },
    output: { write: (text) => stdout.push(text), error: (text) => stderr.push(text) },
    now: new Date(2026, 10, 27, 9, 0),
  });
  return { code, stdout: stdout.join(""), stderr: stderr.join("") };
}

async function readNotes(repo: string): Promise<Record<string, string>> {
  const names = await readdir(repo);
  const entries = await Promise.all(
    names.map(async (name) => [name, await readFile(join(repo, name), "utf8")] as const),
  );
  return Object.fromEntries(entries);
}

describe("zambil install and zambil uninstall", () => {
  test("install adds the hooks and the skill, a second run changes nothing, uninstall removes both", async () => {
    const machine = await testMachine();
    const { config, repo, settings } = machine;
    const args = ["--repo", repo, "--offline"];
    const first = await run(installCommand, { config, args });
    const installedText = await readFile(settings, "utf8");
    const skillText = await readFile(machine.skill, "utf8");
    const second = await run(installCommand, { config, args });
    const secondText = await readFile(settings, "utf8");
    const removed = await run(uninstallCommand, { config, args: [] });
    const removedSettings = JSON.parse(await readFile(settings, "utf8"));
    const again = await run(uninstallCommand, { config, args: [] });

    const cache = join(config.environment.cacheHome ?? "", "zambil", "node-compile-cache");
    const command = hookCommandLine({
      zambilPath: machine.zambil,
      repoRoot: repo,
      compileCache: cache,
      nodeFolders: machine.nodeFolders,
    });
    const handler = { type: "command", command, timeout: 10 };
    expect({
      first: { ...first, stderr: first.stderr.split("\n") },
      installed: JSON.parse(installedText),
      skill: skillText.split("\n").slice(0, 3),
      second,
      isSame: secondText === installedText,
      removed,
      removedSettings,
      hasSkill: existsSync(machine.skill),
      again: again.stdout,
      notes: await readNotes(repo),
      userConfig: JSON.parse(await readFile(machine.userConfig, "utf8")),
    }).toEqual({
      first: {
        code: 0,
        stdout: [
          "Skipped the hook list and the model, because of --offline. Run this command again when you are online.",
          `Installed the zambil hooks (SessionStart, UserPromptSubmit, PreToolUse) in ${settings}.`,
          `The hooks read the configuration repo ${repo}.`,
          "Skipped Notification, because zambil never answers there.",
          `Installed the zambil-save skill in ${machine.skill}.`,
          `Saved the configuration repo ${repo} in ${machine.userConfig}.`,
          "Start a new Claude Code session to load the hooks. Run zambil install again after a note names a new hook, or after you change the version of Node.",
          "",
        ].join("\n"),
        stderr: [
          "Checked 2 notes: 0 errors and 1 warning.",
          expect.stringMatching(/^ {2}shell\.md: warning: `hooks` names "Notification"/),
          "Run zambil check after a fix to see the problems that are left.",
          "",
        ],
      },
      installed: {
        model: "opus",
        hooks: {
          PreToolUse: [userSettings.hooks.PreToolUse[0], { hooks: [handler] }],
          SessionStart: [{ hooks: [handler] }],
          UserPromptSubmit: [{ hooks: [handler] }],
        },
      },
      skill: [
        "---",
        "name: zambil-save",
        expect.stringContaining("description: Write, rewrite or verify"),
      ],
      second: {
        code: 0,
        stdout: expect.stringContaining(
          `In ${settings}, the zambil hooks (SessionStart, UserPromptSubmit, PreToolUse) are up to date.`,
        ),
        stderr: expect.stringContaining("Checked 2 notes: 0 errors and 1 warning."),
      },
      isSame: true,
      removed: {
        code: 0,
        stdout: [
          `Removed the zambil hooks from ${settings}.`,
          `Removed the zambil-save skill from ${machine.skill}.`,
          "zambil changed no note. Start a new Claude Code session to stop the hooks.",
          "",
        ].join("\n"),
        stderr: "",
      },
      removedSettings: userSettings,
      hasSkill: false,
      again: `${settings} has no zambil hooks.\nzambil changed no note.\n`,
      notes,
      userConfig: { repo },
    });
  });

  test("install changes nothing when zambil is not on the path or the settings are not JSON", async () => {
    const machine = await testMachine();
    const { repo, settings } = machine;
    const args = ["--repo", repo, "--offline"];
    const noPath = await run(installCommand, {
      config: { ...machine.config, searchPath: [] },
      args,
    });
    await writeFile(settings, "{ model: opus\n");
    const broken = await run(installCommand, { config: machine.config, args });
    expect({
      noPath: { code: noPath.code, firstLine: noPath.stderr.split("\n")[0] },
      broken: { code: broken.code, stderr: broken.stderr },
      settings: await readFile(settings, "utf8"),
      hasSkill: existsSync(machine.skill),
      hasUserConfig: existsSync(machine.userConfig),
    }).toEqual({
      noPath: {
        code: 2,
        firstLine:
          "zambil is not on your PATH, or its link points to a clone that moved. The agent runs zambil by name. Link it into a folder on your PATH, then run zambil install again:",
      },
      broken: {
        code: 1,
        stderr: expect.stringMatching(
          /^zambil changed nothing in .*settings\.json: it is not valid JSON: /,
        ),
      },
      settings: "{ model: opus\n",
      hasSkill: false,
      hasUserConfig: false,
    });
  });

  test("install reports the errors that zambil check finds, installs the hooks and exits with 1", async () => {
    const machine = await testMachine();
    const note = "---\ndescription: Deploy.\n---\nShip it.\n";
    const repo = await writeTestRepo({ "ops/deploy.md": note, "web/deploy.md": note });
    const result = await run(installCommand, {
      config: machine.config,
      args: ["--repo", repo, "--offline"],
    });
    const installed = JSON.parse(await readFile(machine.settings, "utf8"));
    expect({
      code: result.code,
      stderr: result.stderr.split("\n"),
      hooks: Object.keys(installed.hooks),
    }).toEqual({
      code: 1,
      stderr: [
        "Checked 2 notes: 1 error and 0 warnings.",
        '  ops/deploy.md: error: the name "deploy" is used by 2 notes: ops/deploy.md, web/deploy.md',
        "Run zambil check after a fix to see the problems that are left.",
        "",
      ],
      hooks: ["PreToolUse", "SessionStart", "UserPromptSubmit"],
    });
  });
});
