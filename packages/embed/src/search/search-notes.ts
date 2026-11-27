import { matchLimit, minimumScore } from "../model/search-model.ts";
import type { NoteScore, ScoreNotesOptions } from "./score-notes.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import { right } from "@zambil/core/either";
import { scoreNotes } from "./score-notes.ts";

/**
 * The matches, best first, how many descriptions and triggers were not in the index, and how many of those were
 * left out because of `unindexedLimit`.
 */
export interface SearchResult {
  matches: NoteScore[];
  unindexed: number;
  skipped: number;
}

/**
 * Finds the current notes whose description or a trigger is similar to the text: at most `matchLimit` notes that
 * score at least `minimumScore`. Expired notes are left out. The threshold fits `searchModel` only, so
 * callers outside this package use `openNoteSearch`, which pairs the two.
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
  const { unindexed, skipped } = scored.value;
  return right({ matches, unindexed, skipped });
}
