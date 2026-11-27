import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { text } from "node:stream/consumers";
import { tmpdir } from "node:os";

const main = fileURLToPath(new URL("main.ts", import.meta.url));
const cliSource = fileURLToPath(new URL(".", import.meta.url));
const coreSource = fileURLToPath(new URL("../../../packages/core", import.meta.url));
const sampleRepo = fileURLToPath(
  new URL("../../../packages/core/fixtures/sample-repo", import.meta.url),
);

/** Which dependencies the copied clone gets: none, or only the `@zambil/core` link without its packages. */
interface CloneOptions {
  dependencies: "none" | "core-only";
}

/** The exit code of `zambil help`, and the first line of its standard error with the clone folder as `<clone>`. */
interface HelpRun {
  status: number | undefined;
  firstLine: string;
}

/** Copies the CLI into a clone in a temporary folder, runs `zambil help` there, and removes the folder. */
function helpInClone(options: CloneOptions): HelpRun {
  const clone = realpathSync(mkdtempSync(join(tmpdir(), "zambil-clone-")));
  cpSync(cliSource, join(clone, "apps/cli/src"), { recursive: true });
  if (options.dependencies === "core-only") {
    cpSync(join(coreSource, "src"), join(clone, "packages/core/src"), { recursive: true });
    cpSync(join(coreSource, "package.json"), join(clone, "packages/core/package.json"));
    mkdirSync(join(clone, "apps/cli/node_modules/@zambil"), { recursive: true });
    symlinkSync(join(clone, "packages/core"), join(clone, "apps/cli/node_modules/@zambil/core"));
  }
  const result = spawnSync(join(clone, "apps/cli/src/main.ts"), ["help"], { encoding: "utf8" });
  rmSync(clone, { recursive: true });
  const firstLine = (result.stderr.split("\n")[0] ?? "").replace(clone, "<clone>");
  return { status: result.status ?? undefined, firstLine };
}

describe("zambil", () => {
  test("runs as a program and checks the sample repo", () => {
    const stdout = execFileSync(main, ["check", "--repo", sampleRepo], { encoding: "utf8" });
    expect(stdout).toBe("6 notes, no problems.\n");
  });

  test("explains missing dependencies without a stack trace, also when only some are missing", () => {
    const runs = [
      helpInClone({ dependencies: "none" }),
      helpInClone({ dependencies: "core-only" }),
    ];
    const firstLine = "zambil cannot start, because its dependencies are not installed in <clone>.";
    expect(runs).toEqual([
      { status: 1, firstLine },
      { status: 1, firstLine },
    ]);
  });

  test("runs init to the end without a stack trace when the reader of its output exits", async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), "zambil-home-")));
    mkdirSync(join(home, "bin"));
    symlinkSync(main, join(home, "bin", "zambil"));
    const claude = join(home, ".claude");
    const bin = join(home, "bin");
    const nodeFolder = dirname(process.execPath);
    const env = { HOME: home, PATH: `${bin}${delimiter}${nodeFolder}`, CLAUDE_CONFIG_DIR: claude };
    const child = spawn(main, ["init", join(home, "notes"), "--offline"], { env });
    child.stdout.destroy();
    const [stderr, code] = await Promise.all([
      text(child.stderr),
      new Promise((resolve) => child.on("close", resolve)),
    ]);
    const files = {
      settings: existsSync(join(claude, "settings.json")),
      skill: existsSync(join(claude, "skills", "zambil-save", "SKILL.md")),
      userConfig: existsSync(join(home, ".config", "zambil", "config.json")),
    };
    rmSync(home, { recursive: true });
    expect({ code, stderr, files }).toEqual({
      code: 0,
      stderr: "",
      files: { settings: true, skill: true, userConfig: true },
    });
  });
});
