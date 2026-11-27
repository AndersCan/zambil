import { readNoteIndex, writeNoteIndex } from "./note-index-file.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import type { Embedder } from "../embed/open-embedder.ts";
import { right } from "@zambil/core/either";

/** The loaded model, and the zambil cache folder where the index goes. */
export interface IndexNotesOptions {
  embedder: Embedder;
  cacheFolder: string;
}

/** The index file, how many descriptions it holds, and how many of them the model embedded this time. */
export interface IndexSummary {
  path: string;
  descriptions: number;
  embedded: number;
}

/** Each distinct description in the repo, expired notes included: expiry is checked at query time. */
export function listDescriptions(repo: ConfigurationRepo): string[] {
  const descriptions = new Set<string>();
  for (const note of repo.notes) {
    if (note.description !== undefined) descriptions.add(note.description);
  }
  return [...descriptions];
}

/**
 * Embeds the description of every note ahead of time and writes the vectors to the cache. It
 * reuses the vectors of descriptions that did not change. It never writes to the repo.
 */
export async function indexNotes(
  repo: ConfigurationRepo,
  options: IndexNotesOptions,
): Promise<Either<string, IndexSummary>> {
  const { embedder, cacheFolder } = options;
  const previous = readNoteIndex(repo.root, { cacheFolder, modelKey: embedder.modelKey });
  const descriptions = listDescriptions(repo);
  const missing = descriptions.filter((description) => !previous.vectors.has(description));
  const embedded = await embedder.embed(missing, { role: "document" });
  if (!embedded.ok) return embedded;
  const vectors = new Map<string, Float32Array>();
  for (const [position, description] of missing.entries()) {
    const vector = embedded.value[position];
    if (vector !== undefined) vectors.set(description, vector);
  }
  for (const description of descriptions) {
    const vector = previous.vectors.get(description);
    if (vector !== undefined) vectors.set(description, vector);
  }
  const written = await writeNoteIndex(
    { modelKey: embedder.modelKey, root: repo.root, vectors },
    { cacheFolder },
  );
  if (!written.ok) return written;
  return right({
    path: written.value,
    descriptions: descriptions.length,
    embedded: missing.length,
  });
}
