import { describe, expect, test } from "vite-plus/test";
import { dirname, join } from "node:path";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
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

const failingScript = 'echo "zambil did not update, because of local changes." >&2\nexit 1\n';

/** A doctor that prints its arguments, in place of apps/cli/src/main.ts. */
const fakeMain = 'console.log(`doctor ran with: ${process.argv.slice(2).join(" ")}`);\n';

/** What the fake clone runs as install.sh, and whether development dependencies are installed. */
interface FakeCloneOptions {
  installScript: string;
  isDevelopment?: boolean;
}

async function writeFakeClone(options: FakeCloneOptions): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "zambil-update-"));
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ name: "zambil", devDependencies: { "vite-plus": "1" } }),
    "apps/cli/package.json": JSON.stringify({ version: "0.1.0" }),
    "apps/cli/src/main.ts": fakeMain,
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

/** The arguments after `zambil update`. */
interface RunOptions {
  args?: string[];
}

async function run(root: string, options: RunOptions = {}) {
  const args = options.args ?? [];
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
    config: { environment: { home: "/home/ada", workingFolder: "/" }, zambilFolder: root },
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
          "zambil doctor checks the setup:",
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
          "zambil doctor checks the setup:",
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
          "zambil did not update. install.sh printed the reason above.",
          "",
        ].join("\n"),
      },
      refused: {
        code: 1,
        first: `zambil update did not run, because ${development} is a development clone: its development dependencies are installed.`,
      },
    });
  });
});
