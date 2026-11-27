import { describe, expect, test } from "vite-plus/test";
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import type { CliConfig } from "../config.ts";
import { doctorCommand } from "./doctor-command.ts";
import { installCommand } from "../install/install-command.ts";
import { join } from "node:path";
import { mainPath } from "../install/link-hint.ts";
import { runChecks } from "./doctor-command.ts";
import { tmpdir } from "node:os";
import { writeTestRepo } from "@zambil/core/write-test-repo";
import { writeTestSearchFiles } from "@zambil/embed/write-test-search-files";

interface Setup {
  config: CliConfig;
  home: string;
  repo: string;
  link: string;
  settings: string;
  skill: string;
}

const silent = { write: () => {}, error: () => {} };
const input = { readAll: () => Promise.resolve("") };
const now = new Date(2026, 10, 27);

/** A home folder where zambil is linked into `~/.local/bin` and `zambil install --offline` ran. */
async function installedSetup(): Promise<Setup> {
  const home = await mkdtemp(join(tmpdir(), "zambil-doctor-"));
  const bin = join(home, ".local", "bin");
  await mkdir(bin, { recursive: true });
  const link = join(bin, "zambil");
  await symlink(mainPath(), link);
  const claude = join(home, ".claude");
  const repo = await writeTestRepo({ "welcome.md": "---\nhooks: SessionStart\n---\nHello.\n" });
  const environment = { home, workingFolder: home, cacheHome: join(home, ".cache") };
  const config = { environment, claudeConfigFolder: claude, searchPath: [bin] };
  const args = ["--repo", repo, "--offline"];
  const code = await installCommand.run({ args, config, input, output: silent, now });
  if (code !== 0) throw new Error(`zambil install exited with ${code}`);
  const settings = join(claude, "settings.json");
  const skill = join(claude, "skills", "zambil-save", "SKILL.md");
  return { config, home, repo, link, settings, skill };
}

async function doctor(config: CliConfig) {
  const printed = { stdout: "", stderr: "" };
  const output = {
    write: (text: string) => {
      printed.stdout += text;
    },
    error: (text: string) => {
      printed.stderr += text;
    },
  };
  const code = await doctorCommand.run({ args: [], config, input, output, now });
  return { code, ...printed };
}

/** The lines about similar notes, and the lines under a failed check. */
function similarLines(stdout: string): string[] {
  return stdout.split("\n").filter((line) => line.includes("index") || line.startsWith("      "));
}

describe("zambil doctor", () => {
  test("finds nothing to fix right after zambil install, and exits with 0", async () => {
    const setup = await installedSetup();
    const results = await runChecks(setup.config, { repoFlag: undefined, nodeVersion: "24.1.0" });
    const { code, stdout } = await doctor(setup.config);
    expect({
      levels: results.map((result) => result.level),
      code,
      last: stdout.trimEnd().split("\n").at(-1),
    }).toEqual({
      levels: ["ok", "ok", "ok", "ok", "ok", "ok", "ok", "ok"],
      code: 0,
      last: "Nothing to fix.",
    });
  });

  test("reports a moved notes folder and a moved clone, each with the command that fixes it", async () => {
    const setup = await installedSetup();
    await rename(setup.repo, `${setup.repo}-moved`);
    await rm(setup.link);
    await symlink("/gone/zambil/apps/cli/src/main.ts", setup.link);
    const results = await runChecks(setup.config, { repoFlag: undefined, nodeVersion: "22.1.0" });
    const configPath = join(setup.home, ".config", "zambil", "config.json");
    expect(results.filter((result) => result.level !== "ok")).toEqual([
      {
        level: "fail",
        text: "Node 22.1.0 is too old. zambil needs Node 24 or later.",
        fixes: ["Install Node 24 or later from https://nodejs.org, then run: zambil install"],
      },
      {
        level: "fail",
        text: "zambil is not on your PATH. Claude Code and the agent run zambil by name.",
        details: [
          `${setup.link} links to /gone/zambil/apps/cli/src/main.ts, which does not exist. The clone moved or is gone.`,
        ],
        fixes: [`mkdir -p ~/.local/bin && ln -sf ${mainPath()} ~/.local/bin/zambil`],
      },
      {
        level: "fail",
        text: `The configuration repo ${setup.repo} does not exist.`,
        details: [
          `The path comes from "repo": ${JSON.stringify(setup.repo)} in ${configPath}.`,
          "Fix the path in that file, or run `zambil init` to set up zambil.",
        ],
        fixes: [
          "zambil init <new folder>   # if you moved the folder",
          "zambil init   # to create the folder again",
        ],
      },
      { level: "skip", text: "zambil check: needs the notes folder." },
      {
        level: "fail",
        text: `The zambil hooks in ${setup.settings} do not match what zambil install writes now.`,
        details: [
          `The hooks run ${setup.link}, which does not exist.`,
          `The hooks read the notes folder ${setup.repo}, which does not exist.`,
        ],
        fixes: ["zambil install"],
      },
      {
        level: "skip",
        text: `The zambil-save skill is in ${setup.skill}. zambil cannot compare it without the notes folder.`,
      },
      { level: "skip", text: "Similar notes: needs the notes folder." },
    ]);
  });

  test("reports a note that names a new hook, a missing skill and a missing model, and exits with 1", async () => {
    const setup = await installedSetup();
    const note =
      "---\ndescription: Quote the paths in a shell command.\nhooks: PreToolUse\n---\nQuote.\n";
    await writeFile(join(setup.repo, "shell.md"), note);
    await rm(setup.skill);
    const { code, stdout } = await doctor(setup.config);
    const lines = stdout.split("\n").filter((line) => !line.startsWith("ok "));
    const modelFolder = join(setup.home, ".cache", "zambil", "models", "multi-qa-minilm-l6-cos-v1");
    expect({ code, lines }).toEqual({
      code: 1,
      lines: [
        "zambil doctor checks your setup. It changes nothing.",
        "",
        `fail  The zambil hooks in ${setup.settings} do not match what zambil install writes now.`,
        "      PreToolUse has no zambil hook, but the note shell.md names it.",
        "      Fix: zambil install",
        `fail  The zambil-save skill is not installed: ${setup.skill} does not exist. The agent cannot save a note.`,
        "      Fix: zambil install",
        expect.stringMatching(
          `^fail  The model for similar notes is not in ${modelFolder}/\\w+, so the hook adds no similar notes\\.$`,
        ),
        "      Fix: zambil index   # downloads about 23 MB",
        "",
        "3 problems to fix. Fix them from the top down, because a later problem can come from an earlier one. Then run zambil doctor again.",
        "",
      ],
    });
  });

  test("reports the descriptions that the index lacks, and says ok once they are all in it", async () => {
    const setup = await installedSetup();
    await writeFile(
      join(setup.repo, "card.md"),
      "---\ndescription: Pay with a card.\n---\nCard.\n",
    );
    const written = await writeTestSearchFiles(setup.config.environment, {
      root: setup.repo,
      descriptions: ["Pay with a card."],
    });
    if (!written.ok) throw new Error(written.error);
    const indexed = await doctor(setup.config);
    await writeFile(join(setup.repo, "ship.md"), "---\ndescription: Ship an order.\n---\nShip.\n");
    const stale = await doctor(setup.config);
    expect({
      indexed: { code: indexed.code, lines: similarLines(indexed.stdout) },
      stale: { code: stale.code, lines: similarLines(stale.stdout) },
    }).toEqual({
      indexed: {
        code: 0,
        lines: ["ok    The model and the index for similar notes are ready: 1 description."],
      },
      stale: {
        code: 1,
        lines: [
          `fail  1 of 2 descriptions are not in the index ${written.value}.`,
          "      The hook embeds them on each prompt, which makes it slower.",
          "      Fix: zambil index",
        ],
      },
    });
  });
});
