import { chmod, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import type { CliConfig } from "../config.ts";
import type { Command } from "../command.ts";
import { existsSync } from "node:fs";
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
  const environment = { home, workingFolder: home, cacheHome: join(home, "cache") };
  const config = { environment, claudeConfigFolder: claude, searchPath: ["relative/bin", bin] };
  const skill = join(claude, "skills", "zambil-save", "SKILL.md");
  return { config, repo, settings, skill, zambil };
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
    const handler = {
      type: "command",
      command: `NODE_COMPILE_CACHE=${cache} ${machine.zambil} hook --repo ${repo}`,
      timeout: 10,
    };
    expect({
      first,
      installed: JSON.parse(installedText),
      skill: skillText.split("\n").slice(0, 3),
      second,
      isSame: secondText === installedText,
      removed,
      removedSettings,
      hasSkill: existsSync(machine.skill),
      again: again.stdout,
      notes: await readNotes(repo),
    }).toEqual({
      first: {
        code: 0,
        stdout: [
          `Installed the zambil hooks (SessionStart, UserPromptSubmit, PreToolUse) in ${settings}.`,
          `The hooks read the configuration repo ${repo}.`,
          "Skipped Notification, because zambil never answers there. Run zambil check.",
          `Installed the zambil-save skill in ${machine.skill}.`,
          "Skipped the hook list and the model, because of --offline.",
          "Start a new Claude Code session to load the hooks. Run zambil install again after a note names a new hook.",
          "",
        ].join("\n"),
        stderr: "",
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
        stderr: "",
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
    });
  });
});
