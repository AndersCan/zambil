import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { deepEqual } from "node:assert/strict";
import { tmpdir } from "node:os";

/** What a run of a program printed, and its exit code. */
interface RunResult {
  status: number | undefined;
  stdout: string;
  stderr: string;
}

/** The scratch folder of the run, and the repo that the script installs from. */
interface Setup {
  work: string;
  upstream: string;
}

/** The repo that gets the commit. */
interface CommitOptions {
  upstream: string;
}

/** The folders of one test machine: a home, a PATH and the repo to install from, and more variables for the script. */
interface Machine {
  home: string;
  path: string;
  upstream: string;
  variables?: Record<string, string>;
}

const repoRoot = resolve(import.meta.dirname, "..");
const script = readFileSync(join(repoRoot, "install.sh"), "utf8");
const gitIdentity = {
  GIT_AUTHOR_NAME: "smoke",
  GIT_AUTHOR_EMAIL: "smoke@example.com",
  GIT_COMMITTER_NAME: "smoke",
  GIT_COMMITTER_EMAIL: "smoke@example.com",
};

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", env: { ...process.env, ...gitIdentity } });
}

function whichProgram(name: string): string {
  return realpathSync(
    execFileSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" }).trim(),
  );
}

/** A folder with only node, npm and git, so that no pnpm on this machine can help the script. */
function makeTools(folder: string): string {
  mkdirSync(folder, { recursive: true });
  symlinkSync(process.execPath, join(folder, "node"));
  symlinkSync(whichProgram("npm"), join(folder, "npm"));
  symlinkSync(whichProgram("git"), join(folder, "git"));
  return `${folder}:/usr/bin:/bin`;
}

/** Runs install.sh the way `curl ... | sh` does: sh reads the script from standard input. */
function runInstall(machine: Machine): RunResult {
  const environment: Record<string, string> = {
    HOME: machine.home,
    PATH: machine.path,
    SHELL: "/bin/bash",
    ZAMBIL_GIT_URL: machine.upstream,
    ...machine.variables,
  };
  const result = spawnSync("sh", [], { input: script, env: environment, encoding: "utf8" });
  return { status: result.status ?? undefined, stdout: result.stdout, stderr: result.stderr };
}

function commitFile(name: string, options: CommitOptions): void {
  const { upstream } = options;
  writeFileSync(join(upstream, name), "new\n");
  git(["-C", upstream, "add", name]);
  git(["-C", upstream, "commit", "--quiet", "-m", `add ${name}`]);
}

function checkOldNode(setup: Setup): void {
  const { work, upstream } = setup;
  const tools = join(work, "old-tools");
  mkdirSync(tools);
  writeFileSync(join(tools, "node"), "#!/bin/sh\necho v22.1.0\n", { mode: 0o755 });
  const home = join(work, "old-node-home");
  const result = runInstall({ home, path: `${tools}:/usr/bin:/bin`, upstream });
  deepEqual(
    { status: result.status, firstLine: result.stderr.split("\n")[0], changed: existsSync(home) },
    {
      status: 1,
      firstLine: "zambil needs Node 24 or later, and this is Node 22.1.0.",
      changed: false,
    },
  );
}

function checkTakenLink(setup: Setup): void {
  const { work, upstream } = setup;
  const home = join(work, "taken-link-home");
  const bin = join(home, ".local/bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "zambil"), "mine\n");
  const result = runInstall({ home, path: makeTools(join(work, "taken-tools")), upstream });
  deepEqual(
    {
      status: result.status,
      kept: readFileSync(join(bin, "zambil"), "utf8"),
      cloned: existsSync(join(home, ".local/share/zambil")),
    },
    { status: 1, kept: "mine\n", cloned: false },
  );
}

function checkFreshInstall(machine: Machine): void {
  const clone = join(machine.home, ".local/share/zambil");
  const link = join(machine.home, ".local/bin/zambil");
  const result = runInstall(machine);
  const sampleRepo = join(clone, "packages/core/fixtures/sample-repo");
  const checked = spawnSync(link, ["check", "--repo", sampleRepo], {
    encoding: "utf8",
    env: { HOME: machine.home, PATH: machine.path },
  });
  const help = spawnSync(link, ["help"], {
    encoding: "utf8",
    env: { HOME: machine.home, PATH: machine.path },
  });
  const hooksPath = spawnSync("git", ["-C", clone, "config", "core.hooksPath"]).status;
  deepEqual(
    {
      status: result.status,
      pathHint: result.stdout.includes('  export PATH="$HOME/.local/bin:$PATH"'),
      nextStep: result.stdout.endsWith("\n  zambil init\n"),
      noRelease: result.stdout.startsWith(
        "zambil has no release yet, so this installs the newest commit of the branch main.\n",
      ),
      help: help.status,
      link: readlinkSync(link),
      check: checked.stdout,
      devDependencies: existsSync(join(clone, "node_modules/vite-plus")),
      gitHooks: hooksPath === 0,
    },
    {
      status: 0,
      pathHint: true,
      nextStep: true,
      noRelease: true,
      help: 0,
      link: join(clone, "apps/cli/src/main.ts"),
      check: "6 notes, no problems.\n",
      devDependencies: false,
      gitHooks: false,
    },
    result.stderr,
  );
}

function checkUpdate(machine: Machine): void {
  const clone = join(machine.home, ".local/share/zambil");
  const otherTool = join(machine.home, ".local/bin/other-tool");
  const ownFile = join(clone, "my-notes.txt");
  writeFileSync(otherTool, "keep\n");
  writeFileSync(ownFile, "keep\n");
  commitFile("smoke-update.txt", machine);
  const result = runInstall(machine);
  deepEqual(
    {
      status: result.status,
      updated: existsSync(join(clone, "smoke-update.txt")),
      otherTool: readFileSync(otherTool, "utf8"),
      ownFile: readFileSync(ownFile, "utf8"),
      ready: result.stdout.endsWith("\nzambil is ready.\n"),
    },
    { status: 0, updated: true, otherTool: "keep\n", ownFile: "keep\n", ready: true },
    result.stderr,
  );
}

/** The commands that the script told the user to run: its lines that start with `  git -C`. */
function printedCommands(text: string): string[] {
  const commands: string[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("  git -C ")) commands.push(line.trim());
  }
  return commands;
}

function runPrinted(text: string): void {
  for (const command of printedCommands(text)) {
    execFileSync("sh", ["-c", command], { env: { ...process.env, ...gitIdentity } });
  }
}

function checkLocalChange(machine: Machine): void {
  const clone = join(machine.home, ".local/share/zambil");
  const readme = join(clone, "README.md");
  writeFileSync(readme, "my own text\n");
  commitFile("smoke-second.txt", machine);
  const refused = runInstall(machine);
  const kept = readFileSync(readme, "utf8");
  runPrinted(refused.stderr);
  const afterAdvice = runInstall(machine);
  deepEqual(
    {
      status: refused.status,
      firstLine: refused.stderr.split("\n")[0],
      kept,
      commands: printedCommands(refused.stderr).length,
      statusAfterAdvice: afterAdvice.status,
      updated: existsSync(join(clone, "smoke-second.txt")),
    },
    {
      status: 1,
      firstLine: `zambil did not update, because the clone in ${clone} has local changes. To put them aside, run:`,
      kept: "my own text\n",
      commands: 1,
      statusAfterAdvice: 0,
      updated: true,
    },
    afterAdvice.stderr,
  );
}

/** Which round of "local commit, new upstream commit, rerun, follow the advice" this is. */
interface LocalCommitOptions {
  round: number;
}

/** The exit codes of the refused run and of the run after the advice, and the branches that keep local commits. */
interface CommitRound {
  refused: number | undefined;
  afterAdvice: number | undefined;
  kept: string;
}

/** One round of a local commit that the advice keeps, and the branch that holds it afterwards. */
function followCommitAdvice(machine: Machine, options: LocalCommitOptions): CommitRound {
  const clone = join(machine.home, ".local/share/zambil");
  const message = `my own commit ${options.round}`;
  writeFileSync(join(clone, "README.md"), `${message}\n`);
  git(["-C", clone, "commit", "--quiet", "--all", "-m", message]);
  commitFile(`smoke-round-${options.round}.txt`, machine);
  const refused = runInstall(machine);
  runPrinted(refused.stderr);
  const afterAdvice = runInstall(machine);
  const branches = git([
    "-C",
    clone,
    "branch",
    "--format=%(refname:short) %(subject)",
    "--list",
    "my-zambil-changes*",
  ]);
  return { refused: refused.status, afterAdvice: afterAdvice.status, kept: branches };
}

function checkLocalCommit(machine: Machine): void {
  const clone = join(machine.home, ".local/share/zambil");
  const rounds = [
    followCommitAdvice(machine, { round: 1 }),
    followCommitAdvice(machine, { round: 2 }),
  ];
  deepEqual(
    { rounds, updated: existsSync(join(clone, "smoke-round-2.txt")) },
    {
      rounds: [
        { refused: 1, afterAdvice: 0, kept: "my-zambil-changes my own commit 1\n" },
        {
          refused: 1,
          afterAdvice: 0,
          kept: "my-zambil-changes my own commit 1\nmy-zambil-changes-2 my own commit 2\n",
        },
      ],
      updated: true,
    },
  );
}

/** The repo to read and the release to tag at its last commit. */
interface TagOptions {
  upstream: string;
  tag: string;
}

function tagRelease(options: TagOptions): string {
  git(["-C", options.upstream, "tag", options.tag]);
  return git(["-C", options.upstream, "rev-parse", "HEAD"]).trim();
}

/** Where a clone is: its commit, and its branch or `detached`. */
function position(clone: string): string {
  const commit = git(["-C", clone, "rev-parse", "HEAD"]).trim();
  const branch = spawnSync("git", ["-C", clone, "symbolic-ref", "--quiet", "--short", "HEAD"], {
    encoding: "utf8",
  });
  const where = branch.status === 0 ? branch.stdout.trim() : "detached";
  return `${commit} ${where}`;
}

/** The runs that move clones between main and releases, and where each clone is after its run. */
function runReleases(machine: Machine) {
  const mainClone = join(machine.home, ".local/share/zambil");
  const releaseClone = join(machine.home, ".local/share/zambil-release");
  const releaseMachine = {
    ...machine,
    variables: { ZAMBIL_HOME: releaseClone, ZAMBIL_BIN_DIR: join(machine.home, "release-bin") },
  };
  const first = tagRelease({ upstream: machine.upstream, tag: "v0.1.0" });
  const onMain = runInstall(machine);
  const onMainAt = position(mainClone);
  const fresh = runInstall(releaseMachine);
  const freshAt = position(releaseClone);
  commitFile("smoke-release-10.txt", machine);
  const tenth = tagRelease({ upstream: machine.upstream, tag: "v0.10.0" });
  commitFile("smoke-release-9.txt", machine);
  const head = tagRelease({ upstream: machine.upstream, tag: "v0.9.0" });
  const newer = runInstall(releaseMachine);
  const newerAt = position(releaseClone);
  const again = runInstall(releaseMachine);
  const pinVariables = { ...releaseMachine.variables, ZAMBIL_GIT_REF: "v0.1.0" };
  const pinned = runInstall({ ...releaseMachine, variables: pinVariables });
  const pinnedAt = position(releaseClone);
  writeFileSync(join(releaseClone, "README.md"), "my release commit\n");
  git(["-C", releaseClone, "commit", "--quiet", "--all", "-m", "my release commit"]);
  const refused = runInstall(releaseMachine);
  runPrinted(refused.stderr);
  const afterAdvice = runInstall(releaseMachine);
  const afterAdviceAt = position(releaseClone);
  const kept = git(["-C", releaseClone, "log", "-1", "--format=%s", "my-zambil-changes"]);
  const releaseMainVariables = { ...releaseMachine.variables, ZAMBIL_GIT_REF: "main" };
  const releaseToMain = runInstall({ ...releaseMachine, variables: releaseMainVariables });
  const releaseToMainAt = position(releaseClone);
  const mainMachine = { ...machine, variables: { ZAMBIL_GIT_REF: "main" } };
  const toMain = runInstall(mainMachine);
  const toMainAt = position(mainClone);
  const followsMain = runInstall(machine);
  const followsMainAt = position(mainClone);
  git(["-C", mainClone, "config", "--unset", "zambil.follow"]);
  const ahead = runInstall(machine);
  const typo = runInstall({ ...machine, variables: { ZAMBIL_GIT_REF: "v9.9.9" } });
  return {
    actual: {
      onMain: { status: onMain.status, at: onMainAt },
      fresh: { status: fresh.status, at: freshAt },
      newer: {
        status: newer.status,
        at: newerAt,
        said: newer.stdout.includes("Switched zambil to v0.10.0."),
      },
      again: again.stdout.includes("zambil is up to date: v0.10.0."),
      pinned: { status: pinned.status, at: pinnedAt },
      refused: { status: refused.status, commands: printedCommands(refused.stderr).length },
      afterAdvice: { status: afterAdvice.status, at: afterAdviceAt, kept },
      releaseToMain: { status: releaseToMain.status, at: releaseToMainAt },
      toMain: {
        status: toMain.status,
        at: toMainAt,
        said: toMain.stdout.includes("Switched zambil to the branch main."),
      },
      followsMain: { status: followsMain.status, at: followsMainAt },
      ahead: {
        status: ahead.status,
        at: position(mainClone),
        said: ahead.stdout.includes("is ahead of the newest release v0.10.0"),
      },
      typo: { status: typo.status, firstLine: typo.stderr.split("\n")[0] },
    },
    expected: {
      onMain: { status: 0, at: `${first} detached` },
      fresh: { status: 0, at: `${first} detached` },
      newer: { status: 0, at: `${tenth} detached`, said: true },
      again: true,
      pinned: { status: 0, at: `${first} detached` },
      refused: { status: 1, commands: 1 },
      afterAdvice: { status: 0, at: `${tenth} detached`, kept: "my release commit\n" },
      releaseToMain: { status: 0, at: `${head} main` },
      toMain: { status: 0, at: `${head} main`, said: true },
      followsMain: { status: 0, at: `${head} main` },
      ahead: { status: 0, at: `${head} main`, said: true },
      typo: {
        status: 1,
        firstLine: `${machine.upstream} has no release or branch named v9.9.9. Releases are named like v0.1.0.`,
      },
    },
    output: `${refused.stderr}${afterAdvice.stderr}${releaseToMain.stderr}${toMain.stderr}${followsMain.stderr}`,
  };
}

function checkReleases(machine: Machine): void {
  const { actual, expected, output } = runReleases(machine);
  deepEqual(actual, expected, output);
}

function checkUpdateCommand(machine: Machine): void {
  const link = join(machine.home, ".local/bin/zambil");
  commitFile("smoke-update-command.txt", machine);
  const updated = spawnSync(link, ["update"], {
    encoding: "utf8",
    env: { HOME: machine.home, PATH: machine.path },
  });
  deepEqual(
    {
      ran: updated.status === 0 || updated.status === 1,
      updated: updated.stdout.includes("Updated zambil to"),
      commits: updated.stdout.includes("The new commits:\n"),
      subject: updated.stdout.includes(" add smoke-update-command.txt\n"),
      doctor: updated.stdout.includes("\nzambil doctor checks the setup:\n"),
    },
    { ran: true, updated: true, commits: true, subject: true, doctor: true },
    `${updated.stdout}${updated.stderr}`,
  );
}

function main(): void {
  const work = realpathSync(mkdtempSync(join(tmpdir(), "zambil-smoke-")));
  const upstream = join(work, "upstream");
  git(["clone", "--quiet", "--no-hardlinks", repoRoot, upstream]);
  git(["-C", upstream, "switch", "--quiet", "--force-create", "main"]);
  for (const tag of git(["-C", upstream, "tag", "--list"]).split("\n")) {
    if (tag !== "") git(["-C", upstream, "tag", "--delete", tag]);
  }
  const machine = { home: join(work, "home"), path: makeTools(join(work, "tools")), upstream };
  const checks = [
    { name: "an old Node stops the script", run: () => checkOldNode({ work, upstream }) },
    {
      name: "a file at the link path stops the script",
      run: () => checkTakenLink({ work, upstream }),
    },
    { name: "a fresh install works", run: () => checkFreshInstall(machine) },
    { name: "a second run updates and keeps other files", run: () => checkUpdate(machine) },
    {
      name: "the advice for a local change leads to an update",
      run: () => checkLocalChange(machine),
    },
    {
      name: "the advice for local commits keeps them in two rounds",
      run: () => checkLocalCommit(machine),
    },
    {
      name: "installs take the newest release, a pin, or the branch that the user names",
      run: () => checkReleases(machine),
    },
    {
      name: "zambil update updates, lists the new commits and runs zambil doctor",
      run: () => checkUpdateCommand(machine),
    },
  ];
  for (const check of checks) {
    check.run();
    process.stdout.write(`ok: ${check.name}\n`);
  }
}

main();
