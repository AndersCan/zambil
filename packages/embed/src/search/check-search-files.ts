import { cacheFolder } from "../model/cache-folder.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { dirname } from "node:path";
import { listDescriptions } from "../index/index-notes.ts";
import { modelFilePath } from "../model/fetch-model.ts";
import { modelKeyOf } from "../model/embedding-model.ts";
import { noteIndexPath } from "../index/note-index-file.ts";
import { readNoteIndex } from "../index/note-index-file.ts";
import { searchModel } from "../model/search-model.ts";
import { stat } from "node:fs/promises";
import type { UserEnvironment } from "@zambil/core/locate-repo";
import { wrap } from "@zambil/core/either";

/** `ready`: each file of the search model is in the cache with its pinned size. */
export type ModelState = "ready" | "missing";

/** The state of the model and of the index of one repo, and where they are. */
export interface SearchFiles {
  model: ModelState;
  modelFolder: string;
  indexPath: string;
  descriptions: number;
  unindexed: number;
}

/** Where the cache folder is. */
export interface CheckSearchFilesOptions {
  environment: UserEnvironment;
}

/**
 * Whether each file of the search model is in the cache with its pinned size. It reads two file
 * sizes, so a hook can call it. A file that it cannot read counts as missing.
 */
export async function checkModel(options: CheckSearchFilesOptions): Promise<ModelState> {
  const folder = cacheFolder(options.environment);
  const files = [searchModel.weights, searchModel.vocabulary];
  const sizes = await Promise.all(
    files.map((file) => wrap(stat(modelFilePath(searchModel, { file, cacheFolder: folder })))),
  );
  const isReady = files.every((file, position) => {
    const size = sizes[position];
    return size?.ok === true && size.value.size === file.bytes;
  });
  return isReady ? "ready" : "missing";
}

/**
 * Whether similar notes can work: the model is in the cache, and how many descriptions the index
 * lacks. It reads two file sizes and the index, and never loads the model.
 */
export async function checkSearchFiles(
  repo: ConfigurationRepo,
  options: CheckSearchFilesOptions,
): Promise<SearchFiles> {
  const folder = cacheFolder(options.environment);
  const model = await checkModel(options);
  const weights = modelFilePath(searchModel, { file: searchModel.weights, cacheFolder: folder });
  const modelKey = modelKeyOf(searchModel);
  const index = readNoteIndex(repo.root, { cacheFolder: folder, modelKey });
  const descriptions = listDescriptions(repo);
  const unindexed = descriptions.filter((description) => !index.vectors.has(description));
  return {
    model,
    modelFolder: dirname(weights),
    indexPath: noteIndexPath(repo.root, { cacheFolder: folder }),
    descriptions: descriptions.length,
    unindexed: unindexed.length,
  };
}
