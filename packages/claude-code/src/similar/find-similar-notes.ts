import { left, right, wrap } from "@zambil/core/either";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import type { NoteScore } from "@zambil/embed/score-notes";
import type { UserEnvironment } from "@zambil/core/locate-repo";

/** The prompt as typed, the clock that decides which notes are expired, and where the cache folder is. */
export interface FindSimilarNotesOptions {
  prompt: string;
  now: Date;
  environment: UserEnvironment;
}

/** The notes that match the prompt, best first, and how many notes were left out because they are not in the index. */
export interface SimilarNotes {
  matches: NoteScore[];
  skipped: number;
}

/** What a prompt holds: text to match, a slash command for Claude Code, or no letter at all. */
export type PromptKind = "text" | "command" | "no-text";

/**
 * The most descriptions that are not in the index to embed on one prompt. Each takes a few
 * milliseconds, so a few new notes still match before the next `zambil index`, and a repo that was
 * never indexed does not stall the prompt.
 */
export const unindexedLimit = 10;

const letter = /\p{L}/u;

/** A slash command is for Claude Code, not a question for the notes, and a prompt with no letter carries no topic. */
export function readPrompt(prompt: string): PromptKind {
  const trimmed = prompt.trim();
  if (trimmed.startsWith("/")) return "command";
  return letter.test(trimmed) ? "text" : "no-text";
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/**
 * Finds the current notes whose description is similar to the prompt. It never downloads the model:
 * a missing model is an error that tells the user to run `zambil index`. It writes nothing. It loads
 * the embedder only for a prompt with text, in a repo with at least one description.
 */
export async function findSimilarNotes(
  repo: ConfigurationRepo,
  options: FindSimilarNotesOptions,
): Promise<Either<string, SimilarNotes>> {
  const none = right({ matches: [], skipped: 0 });
  if (readPrompt(options.prompt) !== "text") return none;
  const hasDescription = repo.notes.some((note) => note.description !== undefined);
  if (!hasDescription) return none;
  const loaded = await wrap(import("@zambil/embed/open-note-search"));
  if (!loaded.ok) return left(`cannot load the embedder: ${describe(loaded.error)}`);
  const noteSearch = await loaded.value.openNoteSearch(options.environment, {
    report: () => {},
    download: "never",
  });
  if (!noteSearch.ok) return noteSearch;
  const { prompt, now } = options;
  const result = await noteSearch.value.search(repo, { text: prompt, now, unindexedLimit });
  if (!result.ok) return result;
  return right({ matches: result.value.matches, skipped: result.value.skipped });
}
