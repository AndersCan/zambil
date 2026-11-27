import { describe, expect, test } from "vite-plus/test";
import { dirname, join } from "node:path";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import type { CliConfig } from "../config.ts";
import { execFileSync } from "node:child_process";
import { installScriptUrl } from "@zambil/claude-code/install-script-command";
import { tmpdir } from "node:os";
import { updateCommand } from "./update-command.ts";

const identity = ["-c", "user.name=test", "-c", "user.email=test@example.com"];
const gitIdentity = identity.join(" ");

const changelog = "# Changelog\n\n## Unreleased\n\n## 0.1.0 - 2026-12-01\n\n- First.\n";

/** An install.sh that makes the release 0.2.0 in the clone that ZAMBIL_HOME names. */
const releaseScript = `set -eu
cd "$ZAMBIL_HOME"
printf '{"version": "0.2.0"}\\n' > apps/cli/package.json
printf '# Changelog\\n\\n## Unreleased\\n\\n## 0.2.0 - 2027-01-01\\n\\n- Second.\\n\\n## 0.1.0 - 2026-12-01\\n\\n- First.\\n' > CHANGELOG.md
git ${gitIdentity} commit --quiet --all -m "Release 0.2.0"
echo "Switched zambil to v0.2.0."
`;

/** An install.sh that adds one commit and keeps the version. */
const commitScript = `set -eu
cd "$ZAMBIL_HOME"
echo more >> CHANGELOG.md
git ${gitIdentity} commit --quiet --all -m "Fix the list hint"
echo "Updated zambil."
`;

/** An install.sh that goes back to the older version 0.0.9. */
const backScript = `set -eu
cd "$ZAMBIL_HOME"
printf '{"version": "0.0.9"}\\n' > apps/cli/package.json
git ${gitIdentity} commit --quiet --all -m "Back to 0.0.9"
`;

/** An install.sh that commits a new install.sh, which zambil update then runs once more. */
const newScriptScript = `set -eu
cd "$ZAMBIL_HOME"
printf 'echo "the new install.sh ran"\\n' > install.sh
git ${gitIdentity} commit --quiet --all -m "Change install.sh"
echo "Updated zambil."
`;

/** An install.sh that prints the link folder that it got. */
const binScript = 'echo "bin=${ZAMBIL_BIN_DIR:-unset}"\n';

const failingScript = 'echo "zambil did not update, because of local changes." >&2\nexit 1\n';

/** A doctor that prints its arguments, in place of apps/cli/src/main.ts. */
const fakeMain = 'console.log(`doctor ran with: ${process.argv.slice(2).join(" ")}`);\n';

/** What the fake clone runs as install.sh, and whether development dependencies are installed. */
interface FakeCloneOptions {
  installScript: string;
  isDevelopment?: boolean;
  doctorExitCode?: number;
}

async function writeFakeClone(options: FakeCloneOptions): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "zambil-update-"));
  const doctorExitCode = options.doctorExitCode ?? 0;
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ name: "zambil", devDependencies: { "vite-plus": "1" } }),
    "apps/cli/package.json": JSON.stringify({ version: "0.1.0" }),
    "apps/cli/src/main.ts": `${fakeMain}process.exitCode = ${doctorExitCode};\n`,
    "CHANGELOG.md": changelog,
    "install.sh": options.installScript,
  };
  await Promise.all(
    Object.entries(files).map(async ([path, text]) => {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), text);
    }),
  );
  if (options.isDevelopment === true) {
    await mkdir(join(root, "node_modules/vite-plus"), { recursive: true });
  }
  execFileSync("git", ["init", "--quiet", root]);
  execFileSync("git", ["-C", root, "add", "--all"]);
  execFileSync("git", ["-C", root, ...identity, "commit", "--quiet", "-m", "first"]);
  return root;
}

/** The arguments after `zambil update`, and the path that started zambil. */
interface RunOptions {
  args?: string[];
  commandPath?: string;
}

async function run(root: string, options: RunOptions = {}) {
  const args = options.args ?? [];
  const config: CliConfig = {
    environment: { home: "/home/ada", workingFolder: "/" },
    zambilFolder: root,
  };
  if (options.commandPath !== undefined) config.commandPath = options.commandPath;
  const printed = { stdout: "", stderr: "" };
  const output = {
    write: (text: string) => {
      printed.stdout += text;
    },
    error: (text: string) => {
      printed.stderr += text;
    },
  };
  const code = await updateCommand.run({
    args,
    config,
    input: { readAll: () => Promise.reject(new Error("read standard input")) },
    output,
    now: new Date(),
  });
  return { code, ...printed };
}

describe("updateCommand", () => {
  test("runs install.sh, prints the new changelog sections, then runs the new zambil doctor", async () => {
    const released = await writeFakeClone({ installScript: releaseScript });
    const committed = await writeFakeClone({ installScript: commitScript });
    const [release, commit] = await Promise.all([
      run(released, { args: ["--repo", "/notes"] }),
      run(committed),
    ]);
    const newCommit = /^ {2}[0-9a-f]+ Fix the list hint$/m.exec(commit.stdout)?.[0];
    expect({ release, commit: { ...commit, newCommit } }).toEqual({
      release: {
        code: 0,
        stdout: [
          "Switched zambil to v0.2.0.",
          "",
          "What changed since 0.1.0:",
          "",
          "## 0.2.0 - 2027-01-01",
          "",
          "- Second.",
          "",
          "doctor ran with: doctor --repo /notes",
          "",
        ].join("\n"),
        stderr: "",
      },
      commit: {
        code: 0,
        stdout: [
          "Updated zambil.",
          "",
          "The new commits:",
          newCommit,
          "",
          "doctor ran with: doctor",
          "",
        ].join("\n"),
        stderr: "",
        newCommit: expect.stringContaining("Fix the list hint"),
      },
    });
  });

  test("stops before doctor when install.sh fails, and refuses a development clone", async () => {
    const failing = await writeFakeClone({ installScript: failingScript });
    const development = await writeFakeClone({
      installScript: releaseScript,
      isDevelopment: true,
    });
    const [failed, refused] = await Promise.all([run(failing), run(development)]);
    expect({
      failed,
      refused: { code: refused.code, first: refused.stderr.split("\n")[0] },
    }).toEqual({
      failed: {
        code: 1,
        stdout: "",
        stderr: [
          "zambil did not update, because of local changes.",
          "The update did not finish. When you fixed the problem above, run zambil update again.",
          `If zambil update does not start, run the install command: curl -fsSL ${installScriptUrl} | ZAMBIL_HOME=${failing} sh`,
          "",
        ].join("\n"),
      },
      refused: {
        code: 1,
        first: `zambil update did not run, because ${development} is a development clone: its development dependencies are installed.`,
      },
    });
  });

  test("says that zambil went back, and keeps the link that started it", async () => {
    const [back, linked] = await Promise.all([
      writeFakeClone({ installScript: backScript }),
      writeFakeClone({ installScript: binScript }),
    ]);
    const bin = await mkdtemp(join(tmpdir(), "zambil-bin-"));
    const main = join(linked, "apps/cli/src/main.ts");
    await symlink(main, join(bin, "zambil"));
    const [wentBack, throughLink, throughFile] = await Promise.all([
      run(back),
      run(linked, { commandPath: join(bin, "zambil") }),
      run(linked, { commandPath: main }),
    ]);
    expect({
      wentBack: wentBack.stdout.split("\n")[1],
      throughLink: throughLink.stdout.split("\n")[0],
      throughFile: throughFile.stdout.split("\n")[0],
    }).toEqual({
      wentBack: "zambil went back from 0.1.0 to 0.0.9.",
      throughLink: `bin=${bin}`,
      throughFile: "bin=unset",
    });
  });

  test("runs a changed install.sh once more, and exits with 1 when doctor finds a problem", async () => {
    const [changed, failing] = await Promise.all([
      writeFakeClone({ installScript: newScriptScript }),
      writeFakeClone({ installScript: binScript, doctorExitCode: 3 }),
    ]);
    const [rerun, doctorFailed] = await Promise.all([run(changed), run(failing)]);
    expect({
      rerun: { code: rerun.code, lines: rerun.stdout.split("\n").slice(0, 4) },
      doctorFailed: doctorFailed.code,
    }).toEqual({
      rerun: {
        code: 0,
        lines: [
          "Updated zambil.",
          "",
          "The new version has another install.sh. zambil runs it once more to finish the install.",
          "the new install.sh ran",
        ],
      },
      doctorFailed: 1,
    });
  });
});
