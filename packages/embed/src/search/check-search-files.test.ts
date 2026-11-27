import { describe, expect, test } from "vite-plus/test";
import { checkSearchFiles } from "./check-search-files.ts";
import { join } from "node:path";
import { loadRepo } from "@zambil/core/load-repo";
import { mkdtemp } from "node:fs/promises";
import { modelFilePath } from "../model/fetch-model.ts";
import { searchModel } from "../model/search-model.ts";
import { tmpdir } from "node:os";
import { writeTestRepo } from "@zambil/core/write-test-repo";
import { writeTestSearchFiles } from "./write-test-search-files.ts";

describe("checkSearchFiles", () => {
  test("reports a missing model, then the descriptions that the index lacks", async () => {
    const root = await writeTestRepo({
      "a.md": "---\ndescription: Pay with a card\n---\nA.\n",
      "b.md": "---\ndescription: Ship an order\n---\nB.\n",
    });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.kind);
    const cacheHome = await mkdtemp(join(tmpdir(), "zambil-cache-"));
    const environment = { home: "/home/ada", workingFolder: "/", cacheHome };
    const before = await checkSearchFiles(repo.value, { environment });
    const written = await writeTestSearchFiles(environment, {
      root,
      descriptions: ["Pay with a card"],
    });
    if (!written.ok) throw new Error(written.error);
    const indexPath = written.value;
    const after = await checkSearchFiles(repo.value, { environment });
    const cacheFolder = join(cacheHome, "zambil");
    const weights = modelFilePath(searchModel, { file: searchModel.weights, cacheFolder });
    const modelFolder = join(weights, "..");
    const shared = { modelFolder, indexPath, descriptions: 2 };
    expect({ before, after }).toEqual({
      before: { ...shared, model: "missing", unindexed: 2 },
      after: { ...shared, model: "ready", unindexed: 1 },
    });
  });
});
