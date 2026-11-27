import { describe, expect, test } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { searchCommand } from "./search-command.ts";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const main = fileURLToPath(new URL("../main.ts", import.meta.url));
const proseRepo = fileURLToPath(
  new URL("../../../../packages/embed/fixtures/prose-repo", import.meta.url),
);

/** The text that the command reads on standard input. */
interface StandardInput {
  input: string;
}

describe("zambil search", () => {
  test(
    "from a fresh cache, the hook finds no model, then index, search and the hook find notes",
    { timeout: 120_000 },
    async () => {
      const freshCache = await mkdtemp(join(tmpdir(), "zambil-fresh-cache-"));
      const env = { ...process.env, XDG_CACHE_HOME: freshCache };
      function zambil(args: string[], options: StandardInput = { input: "" }) {
        const run = spawnSync(main, [...args, "--repo", proseRepo], {
          encoding: "utf8",
          env,
          input: options.input,
        });
        const stdout = run.stdout.replaceAll(/^\d\.\d\d /gm, "0.?? ");
        return { code: run.status, stdout, stderr: run.stderr };
      }
      const iterating = JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        prompt: "iterating",
      });
      const withRecall = JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        prompt: "iterating z:rebase",
      });
      const hookBeforeIndex = zambil(["hook"], { input: withRecall });
      const indexed = zambil(["index"]);
      const found = zambil(["search", "help", "me", "with", "my", "branch"]);
      const expired = zambil(["search", "what day is it"]);
      const searchIterating = zambil(["search", "iterating"]);
      const hookAfterIndex = zambil(["hook"], { input: iterating });
      await rm(freshCache, { recursive: true, force: true });
      const context = JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: [
            "zambil reads notes from the user's configuration repo. The description of each of these notes is similar to the prompt. The user did not name them, so use one only if it fits the task:",
            "",
            '<note name="for-loops" path="coding/for-loops.md">',
            "Description: How to write for loops in TypeScript.",
            "",
            "Use for...of over arrays. Use entries() when you need the position.",
            "</note>",
          ].join("\n"),
        },
      });
      expect({
        hookBeforeIndex: {
          code: hookBeforeIndex.code,
          addsRecall: hookBeforeIndex.stdout.includes('<note name=\\"rebase\\"'),
          stderr: hookBeforeIndex.stderr.replace(freshCache, "<cache>"),
        },
        indexed: indexed.stdout.startsWith("Indexed 20 descriptions, 20 of them new"),
        found,
        expired,
        searchIterating,
        hookAfterIndex,
      }).toEqual({
        hookBeforeIndex: {
          code: 0,
          addsRecall: true,
          stderr: `zambil hook: no similar notes, because the model Xenova/multi-qa-MiniLM-L6-cos-v1 is missing or incomplete in <cache>/zambil/models/multi-qa-minilm-l6-cos-v1/3c96c1df3fec9a98a5de76e80877c8bec18498f6. Run \`zambil index --repo ${proseRepo}\`.\n`,
        },
        indexed: true,
        found: {
          code: 0,
          stderr: "",
          stdout: [
            "SCORE  NAME    PATH           DESCRIPTION",
            "0.??   rebase  git/rebase.md  How to rebase a branch onto main and resolve conflicts.",
            "",
          ].join("\n"),
        },
        expired: { code: 0, stdout: "No current note scores 0.38 or more.\n", stderr: "" },
        searchIterating: {
          code: 0,
          stderr: "",
          stdout: [
            "SCORE  NAME       PATH                 DESCRIPTION",
            "0.??   for-loops  coding/for-loops.md  How to write for loops in TypeScript.",
            "",
          ].join("\n"),
        },
        hookAfterIndex: { code: 0, stdout: `${context}\n`, stderr: "" },
      });
    },
  );

  test("needs a text", async () => {
    const printed: string[] = [];
    const output = {
      write: (text: string) => printed.push(text),
      error: (text: string) => printed.push(text),
    };
    const code = await searchCommand.run({
      args: ["--repo", proseRepo],
      config: { environment: { home: "/home/ada", workingFolder: "/" } },
      input: { readAll: () => Promise.resolve("") },
      output,
      now: new Date(),
    });
    expect({ code, printed }).toEqual({
      code: 2,
      printed: [
        "zambil search needs a text to match.\nUsage: zambil search <text> [--repo <path>]\n",
      ],
    });
  });
});
