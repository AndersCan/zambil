import { asRecord } from "@zambil/core/as-record";

/** The vectors of one repo's descriptions, by description text, from one model. */
export interface NoteIndex {
  modelKey: string;
  root: string;
  vectors: Map<string, Float32Array>;
}

/** The version of the index file. A file with another version is ignored and rebuilt. */
export const indexFormat = 1;

function unsafeParseJson(text: string): unknown {
  return JSON.parse(text);
}

function decodeVector(base64: string): Float32Array {
  const bytes = Buffer.from(base64, "base64");
  return new Float32Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
}

function readEntries(entries: unknown): Map<string, Float32Array> | undefined {
  if (!Array.isArray(entries)) return undefined;
  const vectors = new Map<string, Float32Array>();
  for (const entry of entries) {
    const record = asRecord(entry);
    const { description, vector } = record ?? {};
    const isEntry = typeof description === "string" && typeof vector === "string";
    if (!isEntry) return undefined;
    vectors.set(description, decodeVector(vector));
  }
  return vectors;
}

/** Reads an index file. A file that is not valid, or that has another format, is no index at all. */
export function parseNoteIndex(text: string): NoteIndex | undefined {
  let parsed: unknown;
  try {
    parsed = unsafeParseJson(text);
  } catch {
    return undefined;
  }
  const record = asRecord(parsed);
  const { format, modelKey, root, entries } = record ?? {};
  const hasHeader =
    format === indexFormat && typeof modelKey === "string" && typeof root === "string";
  if (!hasHeader) return undefined;
  const vectors = readEntries(entries);
  if (vectors === undefined) return undefined;
  return { modelKey, root, vectors };
}

/** The text of an index file. Each vector is base64 of its 32-bit floats, which is smaller and faster to read than JSON numbers. */
export function formatNoteIndex(index: NoteIndex): string {
  const entries = [];
  for (const [description, vector] of index.vectors) {
    const bytes = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
    entries.push({ description, vector: bytes.toString("base64") });
  }
  return JSON.stringify({
    format: indexFormat,
    modelKey: index.modelKey,
    root: index.root,
    entries,
  });
}
