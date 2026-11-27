import { asRecord } from "@zambil/core/as-record";

/** The vectors of one repo's descriptions, by description text, from one model. */
export interface NoteIndex {
  modelKey: string;
  root: string;
  vectors: Map<string, Float32Array>;
}

/** The version of the index file. A file with another version is ignored and rebuilt. */
export const indexFormat = 2;

function unsafeParseJson(text: string): unknown {
  return JSON.parse(text);
}

function decodeVector(base64: string): Float32Array | undefined {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) return undefined;
  const start = bytes.byteOffset;
  return new Float32Array(bytes.buffer.slice(start, start + bytes.byteLength));
}

/** Every vector, or `undefined` when an entry is not a description and a vector of the same length as the others. */
function readEntries(entries: unknown): Map<string, Float32Array> | undefined {
  if (!Array.isArray(entries)) return undefined;
  const vectors = new Map<string, Float32Array>();
  let dimensions: number | undefined;
  for (const entry of entries) {
    const { description, vector } = asRecord(entry) ?? {};
    const isEntry = typeof description === "string" && typeof vector === "string";
    if (!isEntry) return undefined;
    const decoded = decodeVector(vector);
    if (decoded === undefined) return undefined;
    dimensions ??= decoded.length;
    if (decoded.length !== dimensions) return undefined;
    vectors.set(description, decoded);
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
