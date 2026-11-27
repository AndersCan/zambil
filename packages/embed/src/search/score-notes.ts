import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import type { Embedder } from "../embed/open-embedder.ts";
import { isExpired } from "@zambil/core/is-expired";
import type { Note } from "@zambil/core/note";
import { readNoteIndex } from "../index/note-index-file.ts";
import { right } from "@zambil/core/either";

/** The text to match, the moment that decides which notes are expired, the model and the cache folder. */
export interface ScoreNotesOptions {
  text: string;
  now: Date;
  embedder: Embedder;
  cacheFolder: string;
}

/** A note and the cosine similarity of its description to the text, from -1 to 1. */
export interface NoteScore {
  note: Note;
  score: number;
}

/** Every current note with a description, best first, and how many descriptions were not in the index. */
export interface ScoredNotes {
  scores: NoteScore[];
  unindexed: number;
}

function dotProduct(first: Float32Array, second: Float32Array): number {
  let sum = 0;
  for (const [position, component] of first.entries()) sum += component * (second[position] ?? 0);
  return sum;
}

/**
 * Scores the description of each note that is not expired at `now` against the text. Expiry is
 * checked here, at query time, never in the index. A description that is not in the index is
 * embedded now, so a stale index gives the same scores, only more slowly.
 */
export async function scoreNotes(
  repo: ConfigurationRepo,
  options: ScoreNotesOptions,
): Promise<Either<string, ScoredNotes>> {
  const { embedder, cacheFolder, now } = options;
  const index = readNoteIndex(repo.root, { cacheFolder, modelKey: embedder.modelKey });
  const current = repo.notes.filter(
    (note) => note.description !== undefined && !isExpired(note, { now }),
  );
  const unindexed = new Set<string>();
  for (const note of current) {
    if (!index.vectors.has(note.description ?? "")) unindexed.add(note.description ?? "");
  }
  const query = await embedder.embed([options.text], { role: "query" });
  if (!query.ok) return query;
  const documents = await embedder.embed([...unindexed], { role: "document" });
  if (!documents.ok) return documents;
  const vectors = new Map(index.vectors);
  for (const [position, description] of [...unindexed].entries()) {
    const vector = documents.value[position];
    if (vector !== undefined) vectors.set(description, vector);
  }
  const [queryVector = new Float32Array()] = query.value;
  const scores: NoteScore[] = [];
  for (const note of current) {
    const vector = vectors.get(note.description ?? "");
    if (vector !== undefined) scores.push({ note, score: dotProduct(queryVector, vector) });
  }
  scores.sort((first, second) => second.score - first.score);
  return right({ scores, unindexed: unindexed.size });
}
