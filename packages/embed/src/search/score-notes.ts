import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import type { Embedder } from "../embed/open-embedder.ts";
import { isExpired } from "@zambil/core/is-expired";
import type { Note } from "@zambil/core/note";
import { readNoteIndex } from "../index/note-index-file.ts";
import { right } from "@zambil/core/either";
import { searchTextsOf } from "@zambil/core/search-texts";

/**
 * The text to match, the moment that decides which notes are expired, the model and the cache folder.
 * `unindexedLimit` is the most descriptions and triggers that are not in the index to embed now. Without it, each
 * one is embedded.
 */
export interface ScoreNotesOptions {
  text: string;
  now: Date;
  embedder: Embedder;
  cacheFolder: string;
  unindexedLimit?: number;
}

/** A note and its best cosine similarity to the text, from -1 to 1, over its description and triggers. */
export interface NoteScore {
  note: Note;
  score: number;
}

/**
 * Every current note with a description or a trigger, best first, how many of those texts were not in
 * the index, and how many of them were left out because of `unindexedLimit`.
 */
export interface ScoredNotes {
  scores: NoteScore[];
  unindexed: number;
  skipped: number;
}

function dotProduct(first: Float32Array, second: Float32Array): number {
  let sum = 0;
  for (const [position, component] of first.entries()) sum += component * (second[position] ?? 0);
  return sum;
}

interface BestScoreOptions {
  query: Float32Array;
  vectors: Map<string, Float32Array>;
}

/** The best score of the query against any text of the note that has a vector. */
function bestScore(note: Note, options: BestScoreOptions): number | undefined {
  let best: number | undefined;
  for (const text of searchTextsOf(note)) {
    const vector = options.vectors.get(text);
    if (vector !== undefined) best = Math.max(best ?? -1, dotProduct(options.query, vector));
  }
  return best;
}

/**
 * Scores each note that is not expired at `now` against the text, by the best of its description and
 * triggers. Expiry is checked here, at query time, never in
 * the index. A text that is not in the index is embedded now, so a stale index gives the same scores,
 * only more slowly. Past `unindexedLimit`, a text that is not in the index is left out.
 */
export async function scoreNotes(
  repo: ConfigurationRepo,
  options: ScoreNotesOptions,
): Promise<Either<string, ScoredNotes>> {
  const { embedder, cacheFolder, now } = options;
  const index = readNoteIndex(repo.root, { cacheFolder, modelKey: embedder.modelKey });
  const current = repo.notes.filter(
    (note) => searchTextsOf(note).length > 0 && !isExpired(note, { now }),
  );
  const unindexed = new Set<string>();
  for (const note of current) {
    for (const text of searchTextsOf(note)) if (!index.vectors.has(text)) unindexed.add(text);
  }
  const query = await embedder.embed([options.text], { role: "query" });
  if (!query.ok) return query;
  const embedNow = [...unindexed].slice(0, options.unindexedLimit ?? unindexed.size);
  const documents = await embedder.embed(embedNow, { role: "document" });
  if (!documents.ok) return documents;
  const vectors = new Map(index.vectors);
  for (const [position, text] of embedNow.entries()) {
    const vector = documents.value[position];
    if (vector !== undefined) vectors.set(text, vector);
  }
  const [queryVector = new Float32Array()] = query.value;
  const scores: NoteScore[] = [];
  for (const note of current) {
    const score = bestScore(note, { query: queryVector, vectors });
    if (score !== undefined) scores.push({ note, score });
  }
  scores.sort((first, second) => second.score - first.score);
  const skipped = unindexed.size - embedNow.length;
  return right({ scores, unindexed: unindexed.size, skipped });
}
