import { cacheFolder } from "../model/cache-folder.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import { indexNotes } from "../index/index-notes.ts";
import type { IndexSummary } from "../index/index-notes.ts";
import { openEmbedder } from "../embed/open-embedder.ts";
import { right } from "@zambil/core/either";
import { searchModel } from "../model/search-model.ts";
import { searchNotes } from "./search-notes.ts";
import type { SearchResult } from "./search-notes.ts";
import type { UserEnvironment } from "@zambil/core/locate-repo";

/** Where to tell the user that a download starts. */
export interface OpenNoteSearchOptions {
  report: (message: string) => void;
}

/** The text to match, and the moment that decides which notes are expired. */
export interface NoteSearchOptions {
  text: string;
  now: Date;
}

/** Search and index with the search model, its threshold and the zambil cache folder. */
export interface NoteSearch {
  search: (
    repo: ConfigurationRepo,
    options: NoteSearchOptions,
  ) => Promise<Either<string, SearchResult>>;
  index: (repo: ConfigurationRepo) => Promise<Either<string, IndexSummary>>;
}

/**
 * Loads the search model, and downloads it first on a new machine. Load it once per process, then
 * search as often as needed. This is the entry point for the CLI and for an agent adapter.
 */
export async function openNoteSearch(
  environment: UserEnvironment,
  options: OpenNoteSearchOptions,
): Promise<Either<string, NoteSearch>> {
  const folder = cacheFolder(environment);
  const embedder = await openEmbedder(searchModel, { cacheFolder: folder, report: options.report });
  if (!embedder.ok) return embedder;
  const shared = { embedder: embedder.value, cacheFolder: folder };
  return right({
    search: (repo, searchOptions) => searchNotes(repo, { ...searchOptions, ...shared }),
    index: (repo) => indexNotes(repo, shared),
  });
}
