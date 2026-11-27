import { describe, expect, test } from "vite-plus/test";
import { matchCases, noMatchCases, proseRepo } from "../measure/prose-cases.ts";
import { cacheFolder } from "../model/cache-folder.ts";
import { join } from "node:path";
import { loadRepo } from "@zambil/core/load-repo";
import { mkdtemp } from "node:fs/promises";
import { openEmbedder } from "../embed/open-embedder.ts";
import { readMeasureEnvironment } from "../measure/config.ts";
import { searchModel } from "../model/search-model.ts";
import { searchNotes } from "./search-notes.ts";
import { tmpdir } from "node:os";

describe("searchNotes", () => {
  test(
    "finds the expected note for the clear prose cases and never a wrong one",
    { timeout: 120_000 },
    async () => {
      const repo = loadRepo(proseRepo);
      if (!repo.ok) throw new Error(repo.error.message);
      const models = cacheFolder(readMeasureEnvironment());
      const embedder = await openEmbedder(searchModel, { cacheFolder: models, report: () => {} });
      if (!embedder.ok) throw new Error(embedder.error);
      const emptyCache = await mkdtemp(join(tmpdir(), "zambil-cache-"));
      const found: string[] = [];
      const falseMatches: string[] = [];
      const options = { embedder: embedder.value, now: new Date(), cacheFolder: emptyCache };
      const cases = [...matchCases, ...noMatchCases];
      const results = await Promise.all(
        cases.map((proseCase) => searchNotes(repo.value, { ...options, text: proseCase.query })),
      );
      for (const [position, result] of results.entries()) {
        const proseCase = cases[position] ?? { query: "", expected: [] };
        if (!result.ok) throw new Error(result.error);
        for (const match of result.value.matches) {
          const isExpected = proseCase.expected.includes(match.note.name);
          if (isExpected) found.push(proseCase.query);
          else falseMatches.push(`${proseCase.query} -> ${match.note.name}`);
        }
      }
      expect({ found, falseMatches }).toEqual({
        found: [
          "my branch is behind main",
          "fix the merge conflicts",
          "ship the website to the live servers",
          "add a test for this function",
          "the server is slow, find out why",
          "where do I keep the database password",
          "convert a timestamp to local time",
          "match an email address with a pattern",
          "give this variable a clearer name",
        ],
        falseMatches: [],
      });
    },
  );
});
