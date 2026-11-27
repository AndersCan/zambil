import { describe, expect, test } from "vite-plus/test";
import type { Embedder } from "../embed/open-embedder.ts";
import { indexNotes } from "../index/index-notes.ts";
import { join } from "node:path";
import { loadRepo } from "@zambil/core/load-repo";
import { mkdtemp } from "node:fs/promises";
import { right } from "@zambil/core/either";
import { scoreNotes } from "./score-notes.ts";
import { tmpdir } from "node:os";
import { writeTestRepo } from "@zambil/core/write-test-repo";

const topics = ["loop", "git", "deploy"];

/** Puts each text on the axes of the topic words that it holds. */
const topicEmbedder: Embedder = {
  modelKey: "topics@1",
  embed: (texts) => {
    const vectors = texts.map((text) => {
      const axes = topics.map((topic) => (text.includes(topic) ? 1 : 0));
      const length = Math.hypot(...axes) || 1;
      return Float32Array.from(axes, (axis) => axis / length);
    });
    return Promise.resolve(right(vectors));
  },
};

describe("scoreNotes", () => {
  test("checks expiry at query time, so a note that expires after indexing is left out", async () => {
    const root = await writeTestRepo({
      "for-loops.md": "---\ndescription: How to write a loop.\nexpires: 2026-12-01\n---\n",
      "loop-style.md": "---\ndescription: Which loop and git style to use.\n---\n",
      "no-description.md": "A loop without a description.\n",
    });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const cacheFolder = await mkdtemp(join(tmpdir(), "zambil-cache-"));
    await indexNotes(repo.value, { embedder: topicEmbedder, cacheFolder });
    const options = { text: "a loop", embedder: topicEmbedder, cacheFolder };
    const before = await scoreNotes(repo.value, { ...options, now: new Date(2026, 10, 30) });
    const after = await scoreNotes(repo.value, { ...options, now: new Date(2026, 11, 1) });
    function names(result: typeof before) {
      return result.ok
        ? result.value.scores.map((score) => [score.note.name, score.score.toFixed(2)])
        : [];
    }
    expect({ before: names(before), after: names(after) }).toEqual({
      before: [
        ["for-loops", "1.00"],
        ["loop-style", "0.71"],
      ],
      after: [["loop-style", "0.71"]],
    });
  });

  test("scores a note by the best of its description and triggers", async () => {
    const root = await writeTestRepo({
      "loops.md": "---\ndescription: How to write a loop.\n---\n",
      "release.md": "---\ndescription: How to cut a release.\ntriggers: [deploy it]\n---\n",
    });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const cacheFolder = await mkdtemp(join(tmpdir(), "zambil-cache-"));
    const text = "deploy it now";
    const options = { text, embedder: topicEmbedder, cacheFolder, now: new Date() };
    const scored = await scoreNotes(repo.value, options);
    if (!scored.ok) throw new Error(scored.error);
    const scores = scored.value.scores.map((score) => [score.note.name, score.score.toFixed(2)]);
    expect({ scores, unindexed: scored.value.unindexed }).toEqual({
      scores: [
        ["release", "1.00"],
        ["loops", "0.00"],
      ],
      unindexed: 3,
    });
  });

  test("embeds a description that is not in the index at query time", async () => {
    const root = await writeTestRepo({ "deploy.md": "---\ndescription: How to deploy.\n---\n" });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const cacheFolder = await mkdtemp(join(tmpdir(), "zambil-cache-"));
    const options = { text: "deploy it", embedder: topicEmbedder, cacheFolder, now: new Date() };
    const scored = await scoreNotes(repo.value, options);
    const scores = scored.ok ? scored.value.scores.map((score) => score.score) : [];
    expect({ scores, unindexed: scored.ok ? scored.value.unindexed : -1 }).toEqual({
      scores: [1],
      unindexed: 1,
    });
  });

  test("embeds at most unindexedLimit descriptions that are not in the index, and leaves out the rest", async () => {
    const root = await writeTestRepo({
      "deploy.md": "---\ndescription: How to deploy.\n---\n",
      "deploy-checks.md": "---\ndescription: What to check before a deploy.\n---\n",
      "git-deploy.md": "---\ndescription: How git starts a deploy.\n---\n",
    });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const cacheFolder = await mkdtemp(join(tmpdir(), "zambil-cache-"));
    const options = { text: "deploy it", embedder: topicEmbedder, cacheFolder, now: new Date() };
    const scored = await scoreNotes(repo.value, { ...options, unindexedLimit: 2 });
    if (!scored.ok) throw new Error(scored.error);
    const { scores, unindexed, skipped } = scored.value;
    const names = scores.map((score) => score.note.name);
    expect({ names, unindexed, skipped }).toEqual({
      names: ["deploy-checks", "deploy"],
      unindexed: 3,
      skipped: 1,
    });
  });
});
