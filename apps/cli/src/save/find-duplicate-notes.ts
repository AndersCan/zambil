import { checkSearchFiles } from "@zambil/embed/check-search-files";
import type { CliConfig } from "../config.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { NoteScore } from "@zambil/embed/score-notes";
import { wrap } from "@zambil/core/either";

/**
 * The lowest score at which a new description repeats a current note, measured with `searchModel`
 * (multi-qa-minilm-l6-cos-v1): paraphrases of one note score 0.85 to 0.95, and most notes on another
 * subject score under 0.65. Measure it again when the model changes.
 */
export const duplicateScore = 0.8;

/** The repo before the save, the startup config, and the moment that decides which notes are expired. */
export interface FindDuplicateNotesOptions {
  repo: ConfigurationRepo;
  config: CliConfig;
  now: Date;
}

/**
 * The current notes whose description scores `duplicateScore` or more against the description, best
 * first. Triggers are left out, and a description on more than one line counts as one line, because
 * the score was measured between two whole descriptions. It loads the model only when the model is in the cache, so a save never waits for a download.
 * When the model does not load, or the search fails or throws, it finds no notes and the save goes on.
 */
export async function findDuplicateNotes(
  description: string,
  options: FindDuplicateNotesOptions,
): Promise<NoteScore[]> {
  const { repo, config, now } = options;
  const { environment } = config;
  const files = await checkSearchFiles(repo, { environment });
  if (files.model === "missing") return [];
  const loaded = await wrap(import("@zambil/embed/open-note-search"));
  if (!loaded.ok) return [];
  const opened = await wrap(
    loaded.value.openNoteSearch(environment, { report: () => undefined, download: "never" }),
  );
  const noteSearch = opened.ok ? opened.value : opened;
  if (!noteSearch.ok) return [];
  if (files.unindexed > 0) await wrap(noteSearch.value.index(repo));
  const descriptionsOnly = {
    ...repo,
    notes: repo.notes.map((note) => ({ ...note, triggers: [] })),
  };
  const text = description.replaceAll(/\s+/g, " ");
  const searched = await wrap(noteSearch.value.search(descriptionsOnly, { text, now }));
  const result = searched.ok ? searched.value : searched;
  if (!result.ok) return [];
  return result.value.matches.filter((match) => match.score >= duplicateScore);
}
