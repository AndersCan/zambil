import { describe, expect, test } from "vite-plus/test";
import { dirname, join } from "node:path";
import { mkdir, mkdtemp, truncate, writeFile } from "node:fs/promises";
import { checkSearchFiles } from "./check-search-files.ts";
import { loadRepo } from "@zambil/core/load-repo";
import { modelFilePath } from "../model/fetch-model.ts";
import { modelKeyOf } from "../model/embedding-model.ts";
import { searchModel } from "../model/search-model.ts";
import { tmpdir } from "node:os";
import { writeNoteIndex } from "../index/note-index-file.ts";
import { writeTestRepo } from "@zambil/core/write-test-repo";

async function writeModelFiles(cacheFolder: string): Promise<void> {
  const files = [searchModel.weights, searchModel.vocabulary];
  await Promise.all(
    files.map(async (file) => {
      const path = modelFilePath(searchModel, { file, cacheFolder });
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "");
      await truncate(path, file.bytes);
    }),
  );
}

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
    const cacheFolder = join(cacheHome, "zambil");
    const before = checkSearchFiles(repo.value, { environment });
    await writeModelFiles(cacheFolder);
    const vectors = new Map([["Pay with a card", new Float32Array([1, 0])]]);
    const index = { modelKey: modelKeyOf(searchModel), root, vectors };
    const written = await writeNoteIndex(index, { cacheFolder });
    if (!written.ok) throw new Error(written.error);
    const after = checkSearchFiles(repo.value, { environment });
    const modelFolder = dirname(
      modelFilePath(searchModel, { file: searchModel.weights, cacheFolder }),
    );
    const shared = { modelFolder, indexPath: written.value, descriptions: 2 };
    expect({ before, after }).toEqual({
      before: { ...shared, model: "missing", unindexed: 2 },
      after: { ...shared, model: "ready", unindexed: 1 },
    });
  });
});
