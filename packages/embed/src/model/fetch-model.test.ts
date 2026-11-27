import { describe, expect, test } from "vite-plus/test";
import { fetchModel } from "./fetch-model.ts";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { searchModel } from "./search-model.ts";
import { tmpdir } from "node:os";

describe("fetchModel", () => {
  test("with download never, a model that is not in the cache is an error and nothing is fetched", async () => {
    const cacheFolder = await mkdtemp(join(tmpdir(), "zambil-cache-"));
    const reports: string[] = [];
    const fetched = await fetchModel(searchModel, {
      cacheFolder,
      report: (message) => reports.push(message),
      download: "never",
    });
    const folder = join(cacheFolder, "models", searchModel.id, searchModel.revision);
    expect({ fetched, reports, files: readdirSync(cacheFolder) }).toEqual({
      fetched: {
        ok: false,
        error: `the model Xenova/multi-qa-MiniLM-L6-cos-v1 is not in ${folder}. Run \`zambil index\` to download it.`,
      },
      reports: [],
      files: [],
    });
  });
});
