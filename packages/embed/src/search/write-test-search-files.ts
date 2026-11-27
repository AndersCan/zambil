import { mkdir, truncate, writeFile } from "node:fs/promises";
import { cacheFolder } from "../model/cache-folder.ts";
import { dirname } from "node:path";
import type { Either } from "@zambil/core/either";
import { modelFilePath } from "../model/fetch-model.ts";
import { modelKeyOf } from "../model/embedding-model.ts";
import { searchModel } from "../model/search-model.ts";
import type { UserEnvironment } from "@zambil/core/locate-repo";
import { writeNoteIndex } from "../index/note-index-file.ts";

/** The repo whose index to write, and the descriptions that the index holds. */
export interface WriteTestSearchFilesOptions {
  root: string;
  descriptions: string[];
}

/**
 * Writes model files of the pinned size, with no real weights, and an index for a repo into the
 * cache folder of a test. It returns the path of the index, or why it cannot write it.
 */
export async function writeTestSearchFiles(
  environment: UserEnvironment,
  options: WriteTestSearchFilesOptions,
): Promise<Either<string, string>> {
  const folder = cacheFolder(environment);
  const files = [searchModel.weights, searchModel.vocabulary];
  await Promise.all(
    files.map(async (file) => {
      const path = modelFilePath(searchModel, { file, cacheFolder: folder });
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "");
      await truncate(path, file.bytes);
    }),
  );
  const vectors = new Map<string, Float32Array>();
  for (const description of options.descriptions) {
    vectors.set(description, new Float32Array([1, 0]));
  }
  const index = { modelKey: modelKeyOf(searchModel), root: options.root, vectors };
  return writeNoteIndex(index, { cacheFolder: folder });
}
