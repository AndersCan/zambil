import { left, right, wrap } from "@zambil/core/either";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import { nameKey } from "@zambil/core/index-names";
import type { Note } from "@zambil/core/note";
import type { NoteScore } from "@zambil/embed/score-notes";
import type { ShownNotes } from "../session/shown-notes.ts";
import type { UserEnvironment } from "@zambil/core/locate-repo";

/**
 * The prompt as typed, the clock that decides which notes are expired, where the cache folder is, and
 * the notes that the context already holds, by name key.
 */
export interface FindSimilarNotesOptions {
  prompt: string;
  now: Date;
  environment: UserEnvironment;
  inContext?: ShownNotes;
}

/** The notes that match the prompt, best first, and how many notes were left out because they are not in the index. */
export interface SimilarNotes {
  matches: NoteScore[];
  skipped: number;
}

/**
 * Why there are no similar notes. `no-model`: the model is missing or cannot load, which a run of
 * `zambil index` downloads or reports. `failed`: the embedder or the search failed.
 */
export interface SimilarNotesError {
  kind: "no-model" | "failed";
  message: string;
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

/** A first word such as `/compact` or `/review:pr`. A path such as `/work/app.ts` has a second `/`. */
const slashCommand = /^\/[^\s/]+(?:\s|$)/u;

/** A slash command is for Claude Code, not a question for the notes, and a prompt with no letter carries no topic. */
export function readPrompt(prompt: string): PromptKind {
  const trimmed = prompt.trim();
  if (slashCommand.test(trimmed)) return "command";
  return letter.test(trimmed) ? "text" : "no-text";
}

/** The notes that the context already holds, by name key. */
export interface SearchableNotesOptions {
  inContext: ShownNotes;
}

/**
 * The notes that a prompt can match. A `SessionStart` note and a note in `inContext` are in the context
 * already, so they take no match, and a lower note can take the place.
 */
export function searchableNotes(notes: Note[], options: SearchableNotesOptions): Note[] {
  return notes.filter((note) => {
    const isInContext =
      note.hooks.includes("SessionStart") || Object.hasOwn(options.inContext, nameKey(note.name));
    return !isInContext;
  });
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function failed(message: string): Either<SimilarNotesError, never> {
  return left({ kind: "failed", message });
}

/**
 * Finds the current notes whose description is similar to the prompt. It never downloads the model,
 * so a missing model is an error. Every failure, a thrown one too, is an error value, so that the hook
 * still adds its other notes. It writes nothing. It loads the embedder only for a prompt with text, in
 * a repo with at least one description. It searches only the `searchableNotes`.
 */
export async function findSimilarNotes(
  repo: ConfigurationRepo,
  options: FindSimilarNotesOptions,
): Promise<Either<SimilarNotesError, SimilarNotes>> {
  const none = right({ matches: [], skipped: 0 });
  if (readPrompt(options.prompt) !== "text") return none;
  const hasDescription = repo.notes.some((note) => note.description !== undefined);
  if (!hasDescription) return none;
  const loaded = await wrap(import("@zambil/embed/open-note-search"));
  if (!loaded.ok) return failed(`cannot load the embedder: ${describe(loaded.error)}`);
  const opened = await wrap(
    loaded.value.openNoteSearch(options.environment, { report: () => {}, download: "never" }),
  );
  if (!opened.ok) return failed(`the embedder failed: ${describe(opened.error)}`);
  const noteSearch = opened.value;
  if (!noteSearch.ok) return left({ kind: "no-model", message: noteSearch.error });
  const { prompt, now } = options;
  const notes = searchableNotes(repo.notes, { inContext: options.inContext ?? {} });
  const searchOptions = { text: prompt, now, unindexedLimit };
  const searched = await wrap(noteSearch.value.search({ ...repo, notes }, searchOptions));
  if (!searched.ok) return failed(`the search failed: ${describe(searched.error)}`);
  const result = searched.value;
  if (!result.ok) return failed(result.error);
  return right({ matches: result.value.matches, skipped: result.value.skipped });
}
