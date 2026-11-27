import { describe, expect, test } from "vite-plus/test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import type { Embedder } from "../embed/open-embedder.ts";
import { indexNotes } from "./index-notes.ts";
import { join } from "node:path";
import { loadRepo } from "@zambil/core/load-repo";
import { readNoteIndex } from "./note-index-file.ts";
import { right } from "@zambil/core/either";
import { tmpdir } from "node:os";
import { writeTestRepo } from "@zambil/core/write-test-repo";

/** Gives each text a vector of its length, so a test can tell the vectors apart. */
const lengthEmbedder: Embedder = {
  modelKey: "length@1",
  embed: (texts) => Promise.resolve(right(texts.map((text) => Float32Array.of(text.length, 1)))),
};

/** Like `lengthEmbedder`, but it takes a moment, so that runs at the same time overlap. */
const slowEmbedder: Embedder = {
  modelKey: "length@1",
  embed: (texts) =>
    new Promise((resolve) => {
      setTimeout(() => resolve(right(texts.map((text) => Float32Array.of(text.length, 1)))), 20);
    }),
};

describe("indexNotes", () => {
  test("embeds only new descriptions and writes to the cache, never to the repo", async () => {
    const deploy = "---\ndescription: How to deploy.\n---\n";
    const root = await writeTestRepo({
      "deploy.md": deploy,
      "git.md": "---\ndescription: Git.\n---\n",
    });
    const cacheFolder = await mkdtemp(join(tmpdir(), "zambil-cache-"));
    async function index() {
      const repo = loadRepo(root);
      if (!repo.ok) throw new Error(repo.error.message);
      const summary = await indexNotes(repo.value, { embedder: lengthEmbedder, cacheFolder });
      return summary.ok ? [summary.value.texts, summary.value.embedded] : summary.error;
    }
    const first = await index();
    await writeFile(join(root, "git.md"), "---\ndescription: How to use git.\n---\n");
    const second = await index();
    const vectors = readNoteIndex(root, { cacheFolder, modelKey: "length@1" }).vectors;
    const indexed = [...vectors].map(([description, vector]) => [description, [...vector]]);
    const other = readNoteIndex(root, { cacheFolder, modelKey: "other@1" }).vectors.size;
    expect({
      first,
      second,
      indexed,
      other,
      deploy: await readFile(join(root, "deploy.md"), "utf8"),
    }).toEqual({
      first: [2, 2],
      second: [2, 1],
      indexed: [
        ["How to deploy.", [14, 1]],
        ["How to use git.", [15, 1]],
      ],
      other: 0,
      deploy,
    });
  });

  test("keeps the texts of each run when runs that each saw one new note write at the same time", async () => {
    const files: Record<string, string> = { "base.md": "---\ndescription: Base.\n---\n" };
    for (let position = 0; position < 8; position += 1) {
      files[`note-${position}.md`] = `---\ndescription: Note ${position}.\n---\n`;
    }
    const root = await writeTestRepo(files);
    const cacheFolder = await mkdtemp(join(tmpdir(), "zambil-cache-"));
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const views = Array.from({ length: 8 }, (_, position) => ({
      ...repo.value,
      notes: repo.value.notes.filter((note) => ["base", `note-${position}`].includes(note.name)),
    }));
    await Promise.all(
      views.map((view) => indexNotes(view, { embedder: slowEmbedder, cacheFolder })),
    );
    const vectors = readNoteIndex(root, { cacheFolder, modelKey: "length@1" }).vectors;
    expect([...vectors.keys()].toSorted()).toEqual([
      "Base.",
      "Note 0.",
      "Note 1.",
      "Note 2.",
      "Note 3.",
      "Note 4.",
      "Note 5.",
      "Note 6.",
      "Note 7.",
    ]);
  });
});
