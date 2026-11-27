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

describe("zambil search", () => {
  test("indexes and searches the prose repo from a fresh cache", { timeout: 120_000 }, async () => {
    const freshCache = await mkdtemp(join(tmpdir(), "zambil-fresh-cache-"));
    const env = { ...process.env, XDG_CACHE_HOME: freshCache };
    function zambil(args: string[]) {
      const run = spawnSync(main, [...args, "--repo", proseRepo], { encoding: "utf8", env });
      return { code: run.status, stdout: run.stdout };
    }
    const indexed = zambil(["index"]);
    const found = zambil(["search", "help", "me", "with", "my", "branch"]);
    const expired = zambil(["search", "what day is it"]);
    await rm(freshCache, { recursive: true, force: true });
    expect({
      indexed: indexed.stdout.startsWith("Indexed 20 descriptions, 20 of them new"),
      found,
      expired,
    }).toEqual({
      indexed: true,
      found: {
        code: 0,
        stdout: [
          "SCORE  NAME    PATH           DESCRIPTION",
          "0.58   rebase  git/rebase.md  How to rebase a branch onto main and resolve conflicts.",
          "",
        ].join("\n"),
      },
      expired: { code: 0, stdout: "No note matches.\n" },
    });
  });

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
