import { left, right, wrap } from "@zambil/core/either";
import { checkSearchFiles } from "@zambil/embed/check-search-files";
import type { CliConfig } from "../config.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";

/** `updated`: the index now holds each description and trigger. `skipped`: nothing was missing, or the model is not in the cache. */
export type IndexUpdate = "updated" | "skipped";

/** Where the cache folder is. */
export interface UpdateIndexOptions {
  config: CliConfig;
}

/**
 * Embeds the descriptions and triggers that the index of the repo lacks, so that a saved note is a similar note at
 * once. It loads the model only when the model is in the cache, so a save never waits for a download.
 */
export async function updateIndex(
  repo: ConfigurationRepo,
  options: UpdateIndexOptions,
): Promise<Either<string, IndexUpdate>> {
  const { environment } = options.config;
  const files = await checkSearchFiles(repo, { environment });
  const isNeeded = files.model === "ready" && files.unindexed > 0;
  if (!isNeeded) return right("skipped");
  const loaded = await wrap(import("@zambil/embed/open-note-search"));
  if (!loaded.ok) return left(String(loaded.error));
  const noteSearch = await loaded.value.openNoteSearch(environment, {
    report: () => undefined,
    download: "never",
  });
  const summary = noteSearch.ok ? await noteSearch.value.index(repo) : noteSearch;
  if (!summary.ok) return left(summary.error);
  return right("updated");
}
