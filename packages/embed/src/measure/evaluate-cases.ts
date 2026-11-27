import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import type { Embedder } from "../embed/open-embedder.ts";
import { matchLimit } from "../model/search-model.ts";
import type { ProseCase } from "./prose-cases.ts";
import { right } from "@zambil/core/either";
import { scoreNotes } from "../search/score-notes.ts";

/** The cases, the model, the moment for expiry, and a cache folder. */
export interface EvaluateCasesOptions {
  cases: ProseCase[];
  embedder: Embedder;
  now: Date;
  cacheFolder: string;
}

/** A note and its score for one case. */
export interface RankedNote {
  name: string;
  score: number;
}

/**
 * For one case: the best note and its score, the best expected note's score, the best score of a note
 * that must not match, and the notes that a search can return, best first.
 */
export interface CaseResult {
  query: string;
  expected: string[];
  top: string;
  topScore: number;
  expectedScore: number | undefined;
  wrongScore: number;
  ranked: RankedNote[];
}

/** Scores every note for each case, the same way a search does, but without a threshold. */
export async function evaluateCases(
  repo: ConfigurationRepo,
  options: EvaluateCasesOptions,
): Promise<Either<string, CaseResult[]>> {
  const { embedder, now, cacheFolder } = options;
  const results: CaseResult[] = [];
  for (const proseCase of options.cases) {
    const scored = await scoreNotes(repo, { embedder, now, cacheFolder, text: proseCase.query });
    if (!scored.ok) return scored;
    const [best] = scored.value.scores;
    const expected = scored.value.scores.find((score) =>
      proseCase.expected.includes(score.note.name),
    );
    const wrong = scored.value.scores.find(
      (score) => !proseCase.expected.includes(score.note.name),
    );
    const ranked: RankedNote[] = [];
    for (const score of scored.value.scores.slice(0, matchLimit)) {
      ranked.push({ name: score.note.name, score: score.score });
    }
    results.push({
      query: proseCase.query,
      expected: proseCase.expected,
      top: best?.note.name ?? "",
      topScore: best?.score ?? 0,
      expectedScore: expected?.score,
      wrongScore: wrong?.score ?? 0,
      ranked,
    });
  }
  return right(results);
}
