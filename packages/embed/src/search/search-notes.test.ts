import { caseLabel, matchCases, noMatchCases, proseRepo } from "../measure/prose-cases.ts";
import { describe, expect, test } from "vite-plus/test";
import { cacheFolder } from "../model/cache-folder.ts";
import { join } from "node:path";
import { loadRepo } from "@zambil/core/load-repo";
import { mkdtemp } from "node:fs/promises";
import { openEmbedder } from "../embed/open-embedder.ts";
import { readMeasureEnvironment } from "../measure/config.ts";
import { searchModel } from "../model/search-model.ts";
import { searchNotes } from "./search-notes.ts";
import { tmpdir } from "node:os";
import { writeTestRepo } from "@zambil/core/write-test-repo";

async function openSearchModel() {
  const models = cacheFolder(readMeasureEnvironment());
  const embedder = await openEmbedder(searchModel, {
    cacheFolder: models,
    report: () => {},
    download: "allow",
  });
  if (!embedder.ok) throw new Error(embedder.error);
  return embedder.value;
}

describe("searchNotes", () => {
  test(
    'finds 52 of the 95 expected notes on 50 notes, "iterating" included, with 21 known false matches',
    { timeout: 120_000 },
    async () => {
      const repo = loadRepo(proseRepo);
      if (!repo.ok) throw new Error(repo.error.message);
      const embedder = await openSearchModel();
      const emptyCache = await mkdtemp(join(tmpdir(), "zambil-cache-"));
      const found: string[] = [];
      const falseMatches: string[] = [];
      const options = { embedder, now: new Date(), cacheFolder: emptyCache };
      const cases = [...matchCases, ...noMatchCases];
      const results = await Promise.all(
        cases.map((proseCase) => searchNotes(repo.value, { ...options, text: proseCase.query })),
      );
      for (const [position, result] of results.entries()) {
        const proseCase = cases[position] ?? { query: "", expected: [] };
        if (!result.ok) throw new Error(result.error);
        for (const match of result.value.matches) {
          const isExpected = proseCase.expected.includes(match.note.name);
          const label = caseLabel(proseCase.query);
          if (isExpected) found.push(label);
          else falseMatches.push(`${label} -> ${match.note.name}`);
        }
      }
      expect({
        found: found.length,
        findsIterating: found.includes("iterating"),
        falseMatches,
      }).toEqual({
        found: 52,
        findsIterating: true,
        falseMatches: [
          "my branch is behind main -> branches",
          "describe my changes for git -> branches",
          "install the dependencies of a Python script -> dependencies",
          "the server is slow, find out why -> web-performance",
          "where do I keep the database password -> backups",
          "print what the service does so I can debug it -> monitoring",
          "I opened a PR yesterday, but main moved on and GitHub now says that my branch is out of date and has conflicts in package.json. Bring my branch up to date with main and sort out the conflicts so that CI runs again. -> branches",
          "squash my last three commits and put them on top of the latest main -> git-bisect",
          "squash my last three commits and put them on top of the latest main -> commit-messages",
          "write a good commit message for these changes -> git-bisect",
          "cut a new release of the package -> dependencies",
          "We cannot tell which request failed in the logs. Add a request id to every log line of the api service and log the start and end of each request. -> rate-limiting",
          "the tests in cart.spec.ts pass on my machine but fail every third run in CI -> unit-tests",
          "write up what happened during yesterday's outage -> time-off",
          "how do I submit my hotel receipt from the conference? -> commit-messages",
          "where can I see the stack trace of the error that the customer hit? -> incident-reports",
          "Write a cover letter for a job as a nurse at the city hospital. I have five years of experience in the emergency room. -> incident-reports",
          "Set up a GitHub Actions workflow that runs the linter on each pull request. -> pull-requests",
          "Set up a GitHub Actions workflow that runs the linter on each pull request. -> code-review",
          "Convert this JavaScript file to TypeScript and add the types. -> for-loops",
          "Read the spec in docs/checkout.md and implement the coupon field on the checkout page. Coupons are validated by the existing /coupons endpoint. Show an inline message when a coupon is invalid, and update the total when it is valid. -> input-validation",
        ],
      });
    },
  );

  test(
    "finds a note through a trigger when its description scores under the threshold",
    { timeout: 120_000 },
    async () => {
      const description = "description: How to open a pull request and write its description.";
      const triggers = "triggers: [open a PR, create a pull request]";
      const root = await writeTestRepo({
        "plain/pull-requests.md": `---\n${description}\n---\n`,
        "with-triggers/pull-requests.md": `---\n${description}\n${triggers}\n---\n`,
      });
      const embedder = await openSearchModel();
      const indexFolder = await mkdtemp(join(tmpdir(), "zambil-cache-"));
      async function matches(folder: string) {
        const repo = loadRepo(join(root, folder));
        if (!repo.ok) throw new Error(repo.error.message);
        const text = "open a PR for this";
        const result = await searchNotes(repo.value, {
          embedder,
          now: new Date(),
          cacheFolder: indexFolder,
          text,
        });
        return result.ok ? result.value.matches.map((match) => match.note.path) : result.error;
      }
      expect({
        plain: await matches("plain"),
        withTriggers: await matches("with-triggers"),
      }).toEqual({ plain: [], withTriggers: ["pull-requests.md"] });
    },
  );
});
