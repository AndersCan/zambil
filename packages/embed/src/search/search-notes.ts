import { matchLimit, minimumScore } from "../model/search-model.ts";
import type { NoteScore, ScoreNotesOptions } from "./score-notes.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import { right } from "@zambil/core/either";
import { scoreNotes } from "./score-notes.ts";

/** The matches, best first, and how many descriptions were not in the index and were embedded now. */
export interface SearchResult {
  matches: NoteScore[];
  unindexed: number;
}

/**
 * Finds the current notes whose description is similar to the text: at most `matchLimit` notes that
 * score at least `minimumScore`. Expired notes are left out. `openEmbedder(searchModel, ...)` gives the
 * embedder, and the caller can reuse it for many searches.
 */
export async function searchNotes(
  repo: ConfigurationRepo,
  options: ScoreNotesOptions,
): Promise<Either<string, SearchResult>> {
  const scored = await scoreNotes(repo, options);
  if (!scored.ok) return scored;
  const matches: NoteScore[] = [];
  for (const score of scored.value.scores) {
    if (score.score >= minimumScore && matches.length < matchLimit) matches.push(score);
  }
  return right({ matches, unindexed: scored.value.unindexed });
}
