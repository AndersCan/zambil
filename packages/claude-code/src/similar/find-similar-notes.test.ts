import { chmod, mkdir, mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import { findSimilarNotes, readPrompt, searchableNotes } from "./find-similar-notes.ts";
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
    const [command, noText, text] = await Promise.all([
      findSimilarNotes(repo.value, { prompt: "/clear", now, environment }),
      findSimilarNotes(repo.value, { prompt: "?!", now, environment }),
      findSimilarNotes(repo.value, { prompt: "iterating", now, environment }),
    ]);
    await chmod(locked, 0o755);
    expect({ command, noText, text: text.ok ? "matched" : text.error.kind }).toEqual({
      command: { ok: true, value: { matches: [], skipped: 0 } },
      noText: { ok: true, value: { matches: [], skipped: 0 } },
      text: "failed",
    });
  });
});

describe("searchableNotes", () => {
  test("leaves out a SessionStart note and a note that the context holds, in any version", async () => {
    const root = await writeTestRepo({
      "Deploy.md": "---\ndescription: How to deploy.\n---\nRun make deploy.\n",
      "rebase.md": "---\ndescription: How to rebase.\n---\nRun git rebase.\n",
      "welcome.md": "---\ndescription: Welcome.\nhooks: SessionStart\n---\nHi.\n",
    });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const notes = searchableNotes(repo.value.notes, { inContext: { deploy: "an older version" } });
    expect(notes.map((note) => note.name)).toEqual(["rebase"]);
  });
});
