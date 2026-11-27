import { chmod, mkdir, mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import { findSimilarNotes, readPrompt } from "./find-similar-notes.ts";
import { join } from "node:path";
import { loadRepo } from "@zambil/core/load-repo";
import { searchModel } from "@zambil/embed/search-model";
import { tmpdir } from "node:os";
import { writeTestRepo } from "@zambil/core/write-test-repo";

describe("readPrompt", () => {
  test("matches text and paths, and skips a slash command and a prompt without a letter", () => {
    const prompts = [
      "iterating",
      "  /compact keep the plan",
      "/review:pr",
      "/work/app/loop.ts: how do I iterate here?",
      "?!",
      "42",
      "",
      "écrire une boucle",
    ];
    expect(prompts.map((prompt) => readPrompt(prompt))).toEqual([
      "text",
      "command",
      "command",
      "text",
      "no-text",
      "no-text",
      "no-text",
      "text",
    ]);
  });
});

describe("findSimilarNotes", () => {
  test("loads nothing for a skipped prompt, and turns a thrown error into an error value", async () => {
    const root = await writeTestRepo({ "for-loops.md": "---\ndescription: For loops.\n---\n" });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const cacheHome = await mkdtemp(join(tmpdir(), "zambil-locked-cache-"));
    const locked = join(cacheHome, "zambil", "models", searchModel.id);
    await mkdir(locked, { recursive: true });
    await chmod(locked, 0o000);
    const environment = { home: "/home/ada", workingFolder: "/", cacheHome };
    const now = new Date(2026, 10, 27);
    const [command, text] = await Promise.all([
      findSimilarNotes(repo.value, { prompt: "/clear", now, environment }),
      findSimilarNotes(repo.value, { prompt: "iterating", now, environment }),
    ]);
    await chmod(locked, 0o755);
    expect({ command, text: text.ok ? "matched" : text.error.split(":")[0] }).toEqual({
      command: { ok: true, value: { matches: [], skipped: 0 } },
      text: "the embedder failed",
    });
  });
});
