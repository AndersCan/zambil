import { describe, expect, test } from "vite-plus/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import type { CliConfig } from "../config.ts";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hookCommand } from "./hook-command.ts";
import { installHooks } from "@zambil/claude-code/settings-hooks";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeTestRepo } from "@zambil/core/write-test-repo";

const main = fileURLToPath(new URL("../main.ts", import.meta.url));

interface HookRunOptions {
  stdin: string;
  repo: string | undefined;
  claudeConfigFolder?: string;
  cacheHome?: string;
}

async function runHook(args: string[], options: HookRunOptions) {
  const printed = { stdout: "", stderr: "" };
  const output = {
    write: (text: string) => {
      printed.stdout += text;
    },
    error: (text: string) => {
      printed.stderr += text;
    },
  };
  const cacheHome = options.cacheHome ?? (await mkdtemp(join(tmpdir(), "zambil-cache-")));
  const environment = { home: "/home/ada", workingFolder: "/", configHome: "/nowhere", cacheHome };
  const withRepo =
    options.repo === undefined ? environment : { ...environment, repo: options.repo };
  const config: CliConfig = { environment: withRepo };
  if (options.claudeConfigFolder !== undefined) {
    config.claudeConfigFolder = options.claudeConfigFolder;
  }
  const code = await hookCommand.run({
    args,
    config,
    input: { readAll: () => Promise.resolve(options.stdin) },
    output,
    now: new Date(2026, 10, 27),
  });
  return { code, ...printed };
}

/** A Claude Code folder whose settings run `zambil hook` at these hooks. */
async function writeClaudeFolder(hookNames: string[]): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "zambil-claude-"));
  const settings = installHooks({}, { command: "zambil hook", hookNames });
  if (!settings.ok) throw new Error(settings.error);
  await writeFile(join(folder, "settings.json"), JSON.stringify(settings.value));
  return folder;
}

const ids = { session_id: "s1", cwd: "/home/ada/shop" };

function prompt(text: string): string {
  return JSON.stringify({ ...ids, hook_event_name: "UserPromptSubmit", prompt: text });
}

function inFolder(cwd: string): string {
  return JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "Hi", cwd });
}

function noteNames(stdout: string): string[] {
  const matches = stdout.matchAll(/<note name=\\"(?<name>\w+)\\"/g);
  return [...matches].map((match) => match.groups?.name ?? "");
}

const userPrompt = JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "Hi" });

const sessionStart = JSON.stringify({
  session_id: "s1",
  transcript_path: "/home/ada/.claude/projects/s1.jsonl",
  cwd: "/home/ada/shop",
  hook_event_name: "SessionStart",
  source: "startup",
});

describe("hookCommand", () => {
  test("exits with 0 and reports on standard error for bad input, no repo and a wrong option", async () => {
    const repo = await writeTestRepo({ "a.md": "---\nhooks: SessionStart\n---\nA.\n" });
    const results = await Promise.all([
      runHook([], { stdin: "not json", repo }),
      runHook([], { stdin: userPrompt, repo: undefined }),
      runHook([], { stdin: userPrompt, repo: "/no/such/repo" }),
      runHook(["--bogus"], { stdin: sessionStart, repo }),
      runHook([], { stdin: JSON.stringify({ hook_event_name: "Notification" }), repo: undefined }),
    ]);
    const summary = results.map((result) => [
      result.code,
      result.stdout,
      result.stderr.split("\n")[0],
    ]);
    expect(summary).toEqual([
      [
        0,
        "",
        `zambil hook: the input is not JSON: Unexpected token 'o', "not json" is not valid JSON`,
      ],
      [0, "", "zambil hook: zambil does not know where your configuration repo is."],
      [0, "", "zambil hook: The configuration repo /no/such/repo does not exist."],
      [0, "", 'zambil hook: This command has no option "--bogus". It takes --repo and --help.'],
      [0, "", ""],
    ]);
  });

  test("runs as a program: reads the payload on standard input and prints the hook JSON", async () => {
    const repo = await writeTestRepo({ "a.md": "---\nhooks: SessionStart\n---\nA.\n" });
    const claude = await writeClaudeFolder(["SessionStart", "UserPromptSubmit", "SubagentStart"]);
    const stdout = execFileSync(main, ["hook", "--repo", repo], {
      input: sessionStart,
      encoding: "utf8",
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: claude,
        XDG_CACHE_HOME: await mkdtemp(join(tmpdir(), "zambil-cache-")),
      },
    });
    expect(JSON.parse(stdout)).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: [
          "zambil reads notes from the user's configuration repo. These notes name the SessionStart hook:",
          "",
          '<note name="a" path="a.md">',
          "A.",
          "</note>",
        ].join("\n"),
      },
    });
  });

  test("answers the hooks of the hook list in the cache, not of the bundled list", async () => {
    const repo = await writeTestRepo({
      "a.md": "---\nhooks: [SessionStart, Notification]\n---\nA.\n",
    });
    const cacheHome = await mkdtemp(join(tmpdir(), "zambil-cache-"));
    const list = {
      source: "https://code.claude.com/docs/en/hooks.md",
      readOn: "2027-01-01",
      hooks: ["SessionStart", "UserPromptSubmit", "Notification"],
      contextHooks: ["UserPromptSubmit", "Notification"],
    };
    await mkdir(join(cacheHome, "zambil"));
    await writeFile(join(cacheHome, "zambil", "claude-code-hooks.json"), JSON.stringify(list));
    const environment = { home: "/home/ada", workingFolder: "/", cacheHome, repo };
    const outputs = await Promise.all(
      ["SessionStart", "Notification"].map(async (hookEventName) => {
        const printed: string[] = [];
        await hookCommand.run({
          args: [],
          config: { environment },
          input: {
            readAll: () => Promise.resolve(JSON.stringify({ hook_event_name: hookEventName })),
          },
          output: { write: (text) => printed.push(text), error: (text) => printed.push(text) },
          now: new Date(2026, 10, 27),
        });
        return printed.join("");
      }),
    );
    const [sessionStartOutput = "", notificationOutput = ""] = outputs;
    expect({
      sessionStartOutput,
      notification: JSON.parse(notificationOutput).hookSpecificOutput.hookEventName,
    }).toEqual({
      sessionStartOutput: "",
      notification: "Notification",
    });
  });

  test("warns the user once at session start about a broken setup, and still exits with 0", async () => {
    const repo = await writeTestRepo({
      "a.md": "---\ndescription: Shell.\nhooks: [SessionStart, PreToolUse]\n---\nA.\n",
    });
    const claudeConfigFolder = await writeClaudeFolder([
      "SessionStart",
      "UserPromptSubmit",
      "SubagentStart",
    ]);
    const compact = JSON.stringify({ hook_event_name: "SessionStart", source: "compact" });
    const missing = { repo: "/no/such/repo", claudeConfigFolder };
    const toolNote = await writeTestRepo({ "a.md": "---\nhooks: PreToolUse\n---\nA.\n" });
    const elsewhere = await writeClaudeFolder([]);
    const beforeSubagents = await writeClaudeFolder(["SessionStart", "UserPromptSubmit"]);
    const sessionNote = await writeTestRepo({ "a.md": "---\nhooks: SessionStart\n---\nA.\n" });
    const subagentNote = await writeTestRepo({ "a.md": "---\nhooks: SubagentStart\n---\nA.\n" });
    const results = await Promise.all([
      runHook([], { stdin: sessionStart, ...missing }),
      runHook([], { stdin: compact, ...missing }),
      runHook([], { stdin: sessionStart, repo, claudeConfigFolder }),
      runHook([], { stdin: sessionStart, repo: toolNote, claudeConfigFolder }),
      runHook([], { stdin: sessionStart, repo: toolNote, claudeConfigFolder: elsewhere }),
      runHook([], { stdin: sessionStart, repo: sessionNote, claudeConfigFolder: beforeSubagents }),
      runHook([], { stdin: sessionStart, repo: toolNote, claudeConfigFolder: beforeSubagents }),
      runHook([], { stdin: sessionStart, repo: subagentNote, claudeConfigFolder: beforeSubagents }),
    ]);
    const [
      moved,
      compacted,
      unhooked,
      onlyWarning,
      projectHooks,
      noSubagents,
      noSessionNote,
      subagentOnly,
    ] = results.map((result) => ({
      code: result.code,
      stdout: result.stdout === "" ? "" : JSON.parse(result.stdout),
    }));
    expect({
      moved,
      compacted,
      unhooked,
      onlyWarning,
      projectHooks,
      noSubagents: noSubagents?.stdout.systemMessage,
      noSessionNote: noSessionNote?.stdout.systemMessage,
      subagentOnly: subagentOnly?.stdout.systemMessage,
    }).toEqual({
      moved: {
        code: 0,
        stdout: {
          systemMessage:
            "zambil: The configuration repo /no/such/repo does not exist. No note reaches this session. Run zambil doctor to see the fix.",
        },
      },
      compacted: { code: 0, stdout: "" },
      unhooked: {
        code: 0,
        stdout: {
          systemMessage:
            "zambil: The notes for PreToolUse do not reach the agent, because no zambil hook runs there. Similar notes are off, because the model is missing. Run zambil doctor to see the fix.",
          hookSpecificOutput: expect.objectContaining({ hookEventName: "SessionStart" }),
        },
      },
      onlyWarning: {
        code: 0,
        stdout: {
          systemMessage:
            "zambil: The notes for PreToolUse do not reach the agent, because no zambil hook runs there. Run zambil doctor to see the fix.",
        },
      },
      projectHooks: { code: 0, stdout: "" },
      noSubagents:
        "zambil: Subagents get no SessionStart notes, because no zambil hook runs at SubagentStart. Run zambil doctor to see the fix.",
      noSessionNote:
        "zambil: The notes for PreToolUse do not reach the agent, because no zambil hook runs there. Run zambil doctor to see the fix.",
      subagentOnly:
        "zambil: The notes for SubagentStart do not reach the agent, because no zambil hook runs there. Run zambil doctor to see the fix.",
    });
  });

  test("adds a note once in each context window, a z:<name> and a Stop note each time, and all notes again after a compact", async () => {
    const repo = await writeTestRepo({
      "a.md": "---\nhooks: [UserPromptSubmit, PreToolUse]\n---\nA.\n",
      "b.md": "B.\n",
      "s.md": "---\nhooks: [SessionStart, PreToolUse]\n---\nS.\n",
      "f.md": "---\nhooks: Stop\n---\nF.\n",
    });
    const cacheHome = await mkdtemp(join(tmpdir(), "zambil-cache-"));
    const claudeConfigFolder = await writeClaudeFolder([
      "SessionStart",
      "UserPromptSubmit",
      "SubagentStart",
    ]);
    const subagentTool = JSON.stringify({
      ...ids,
      agent_id: "agent1",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
    });
    const compact = JSON.stringify({ ...ids, hook_event_name: "SessionStart", source: "compact" });
    const stop = JSON.stringify({ ...ids, hook_event_name: "Stop", stop_hook_active: false });
    const subagentStart = JSON.stringify({
      ...ids,
      agent_id: "agent2",
      hook_event_name: "SubagentStart",
    });
    const subagentTwoTool = JSON.stringify({
      ...ids,
      agent_id: "agent2",
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
    });
    const payloads = [
      prompt("Hi"),
      prompt("Hi"),
      prompt("Use z:b"),
      prompt("Use z:b"),
      subagentTool,
      subagentTool,
      stop,
      stop,
      compact,
      prompt("Hi"),
      subagentStart,
      subagentTwoTool,
      subagentStart,
    ];
    const names: string[][] = [];
    // Each hook reads the file that the hook before it wrote, so they run in order.
    for (const stdin of payloads) {
      const result = await runHook([], { stdin, repo, claudeConfigFolder, cacheHome });
      names.push(noteNames(result.stdout));
    }
    const withoutSession = JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "Hi" });
    // Both hooks share one cache folder, and the second must not read what the first wrote.
    for (const stdin of [withoutSession, withoutSession]) {
      const result = await runHook([], { stdin, repo, claudeConfigFolder, cacheHome });
      names.push(noteNames(result.stdout));
    }
    expect(names).toEqual([
      ["a"],
      [],
      ["b"],
      ["b"],
      ["a", "s"],
      [],
      ["f"],
      ["f"],
      ["s"],
      ["a"],
      ["s"],
      ["a"],
      ["s"],
      ["a"],
      ["a"],
    ]);
  });

  test("adds a note with projects only in a folder of that git repo", async () => {
    const repo = await writeTestRepo({
      "shop.md": "---\nhooks: UserPromptSubmit\nprojects: webshop\n---\nShop.\n",
      "all.md": "---\nhooks: UserPromptSubmit\n---\nAll.\n",
    });
    const projects = await mkdtemp(join(tmpdir(), "zambil-projects-"));
    await mkdir(join(projects, "webshop", ".git"), { recursive: true });
    await mkdir(join(projects, "webshop", "src"));
    const results = await Promise.all([
      runHook([], { stdin: inFolder(join(projects, "webshop", "src")), repo }),
      runHook([], { stdin: inFolder(join(projects, "blog")), repo }),
      runHook([], { stdin: userPrompt, repo }),
    ]);
    expect(results.map((result) => noteNames(result.stdout))).toEqual([
      ["all", "shop"],
      ["all"],
      ["all"],
    ]);
  });
});
