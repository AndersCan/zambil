import { noteIndexPath, readNoteIndex, writeNoteIndex } from "./note-index-file.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import type { Embedder } from "../embed/open-embedder.ts";
import { right } from "@zambil/core/either";
import { withIndexLock } from "./index-lock.ts";
import { searchTextsOf } from "@zambil/core/search-texts";

/** The loaded model, and the zambil cache folder where the index goes. */
export interface IndexNotesOptions {
  embedder: Embedder;
  cacheFolder: string;
}

/** The index file, how many texts it holds, and how many of them the model embedded this time. */
export interface IndexSummary {
  path: string;
  texts: number;
  embedded: number;
}

/** Each distinct search text in the repo, expired notes included: expiry is checked at query time. */
export function listSearchTexts(repo: ConfigurationRepo): string[] {
  const texts = new Set<string>();
  for (const note of repo.notes) {
    for (const text of searchTextsOf(note)) texts.add(text);
  }
  return [...texts];
}

/** The vectors that this run embedded, the index that it read first, and the index as it is now. */
interface MergeOptions {
  fresh: Map<string, Float32Array>;
  previous: Map<string, Float32Array>;
  latest: Map<string, Float32Array>;
}

/**
 * The vector of each text of the repo, and each text that another run added to the index after this
 * run read it. So two runs at the same time keep each other's texts.
 */
function mergeVectors(texts: string[], options: MergeOptions): Map<string, Float32Array> {
  const { fresh, previous, latest } = options;
  const vectors = new Map<string, Float32Array>();
  for (const text of texts) {
    const vector = fresh.get(text) ?? latest.get(text) ?? previous.get(text);
    if (vector !== undefined) vectors.set(text, vector);
  }
  for (const [text, vector] of latest) {
    if (!previous.has(text) && !vectors.has(text)) vectors.set(text, vector);
  }
  return vectors;
}

/**
 * Embeds the description and the triggers of every note ahead of time and writes the vectors to the cache. It
 * reuses the vectors of texts that did not change. It embeds outside the lock of the index, and
 * reads the index again under the lock before it writes. It never writes to the repo.
 */
export async function indexNotes(
  repo: ConfigurationRepo,
  options: IndexNotesOptions,
): Promise<Either<string, IndexSummary>> {
  const { embedder, cacheFolder } = options;
  const previous = readNoteIndex(repo.root, { cacheFolder, modelKey: embedder.modelKey });
  const texts = listSearchTexts(repo);
  const missing = texts.filter((text) => !previous.vectors.has(text));
  const embedded = await embedder.embed(missing, { role: "document" });
  if (!embedded.ok) return embedded;
  const fresh = new Map<string, Float32Array>();
  for (const [position, text] of missing.entries()) {
    const vector = embedded.value[position];
    if (vector !== undefined) fresh.set(text, vector);
  }
  const { modelKey } = embedder;
  const written = await withIndexLock(noteIndexPath(repo.root, { cacheFolder }), {
    action: () => {
      const latest = readNoteIndex(repo.root, { cacheFolder, modelKey });
      const vectors = mergeVectors(texts, {
        fresh,
        previous: previous.vectors,
        latest: latest.vectors,
      });
      return writeNoteIndex({ modelKey, root: repo.root, vectors }, { cacheFolder });
    },
  });
  if (!written.ok) return written;
  return right({
    path: written.value,
    texts: texts.length,
    embedded: missing.length,
  });
}
