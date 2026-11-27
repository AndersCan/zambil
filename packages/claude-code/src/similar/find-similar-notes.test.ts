import { describe, expect, test } from "vite-plus/test";
import { findSimilarNotes, readPrompt } from "./find-similar-notes.ts";
import { mkdtemp, readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadRepo } from "@zambil/core/load-repo";
import { searchModel } from "@zambil/embed/search-model";
import { tmpdir } from "node:os";
import { writeTestRepo } from "@zambil/core/write-test-repo";

describe("readPrompt", () => {
  test("matches text, and skips a slash command and a prompt without a letter", () => {
    const prompts = ["iterating", "  /compact keep the plan", "?!", "42", "", "écrire une boucle"];
    expect(prompts.map((prompt) => readPrompt(prompt))).toEqual([
      "text",
      "command",
      "no-text",
      "no-text",
      "no-text",
      "text",
    ]);
  });
});

describe("findSimilarNotes", () => {
  test("never downloads the model: a missing model is an error, and a skipped prompt loads nothing", async () => {
    const root = await writeTestRepo({ "for-loops.md": "---\ndescription: For loops.\n---\n" });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const cacheHome = await mkdtemp(join(tmpdir(), "zambil-empty-cache-"));
    const environment = { home: "/home/ada", workingFolder: "/", cacheHome };
    const now = new Date(2026, 10, 27);
    const [command, text] = await Promise.all([
      findSimilarNotes(repo.value, { prompt: "/clear", now, environment }),
      findSimilarNotes(repo.value, { prompt: "iterating", now, environment }),
    ]);
    const { id, repository, revision } = searchModel;
    const folder = join(cacheHome, "zambil", "models", id, revision);
    expect({ command, text, files: await readdir(cacheHome) }).toEqual({
      command: { ok: true, value: { matches: [], skipped: 0 } },
      text: {
        ok: false,
        error: `the model ${repository} is not in ${folder}. Run \`zambil index\` to download it.`,
      },
      files: [],
    });
  });
});
