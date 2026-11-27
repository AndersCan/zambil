import { asRecord } from "@zambil/core/as-record";

/** The vectors of one repo's descriptions, by description text, from one model. */
export interface NoteIndex {
  modelKey: string;
  root: string;
  vectors: Map<string, Float32Array>;
}

/** The version of the index file. A file with another version is ignored and rebuilt. */
export const indexFormat = 3;

const headerLengthBytes = 4;
const floatBytes = Float32Array.BYTES_PER_ELEMENT;

interface IndexHeader {
  modelKey: string;
  root: string;
  dimensions: number;
  texts: string[];
}

function unsafeParseJson(text: string): unknown {
  return JSON.parse(text);
}

function parseJson(text: string): unknown {
  try {
    return unsafeParseJson(text);
  } catch {
    return undefined;
  }
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function readHeader(text: string): IndexHeader | undefined {
  const { format, modelKey, root, dimensions, texts } = asRecord(parseJson(text)) ?? {};
  const hasNames = typeof modelKey === "string" && typeof root === "string";
  const hasShape = Number.isInteger(dimensions) && Number(dimensions) > 0 && isTextList(texts);
  const isHeader = format === indexFormat && hasNames && hasShape;
  if (!isHeader) return undefined;
  return { modelKey, root, dimensions: Number(dimensions), texts };
}

function alignToFloat(offset: number): number {
  return Math.ceil(offset / floatBytes) * floatBytes;
}

/** The vector block as floats, without a copy when the block starts on a float boundary in memory. */
function floatView(block: Uint8Array): Float32Array {
  const isAligned = block.byteOffset % floatBytes === 0;
  const aligned = isAligned ? block : block.slice();
  return new Float32Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / floatBytes);
}

/**
 * Reads an index file: the length of a JSON header, the header with the texts, then one block of
 * 32-bit floats. Each vector is a view into the block, so a large index needs no parse per vector. A
 * file that is not valid, or that has another format, is no index at all.
 */
export function parseNoteIndex(bytes: Uint8Array): NoteIndex | undefined {
  if (bytes.byteLength < headerLengthBytes) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerEnd = headerLengthBytes + view.getUint32(0, true);
  if (headerEnd > bytes.byteLength) return undefined;
  const header = readHeader(Buffer.from(bytes.subarray(headerLengthBytes, headerEnd)).toString());
  if (header === undefined) return undefined;
  const start = alignToFloat(headerEnd);
  const { dimensions, texts } = header;
  if (bytes.byteLength !== start + texts.length * dimensions * floatBytes) return undefined;
  const floats = floatView(bytes.subarray(start));
  const vectors = new Map<string, Float32Array>();
  for (const [position, text] of texts.entries()) {
    vectors.set(text, floats.subarray(position * dimensions, (position + 1) * dimensions));
  }
  return { modelKey: header.modelKey, root: header.root, vectors };
}

/** The bytes of an index file, in the layout that `parseNoteIndex` reads. Every vector has the same length. */
export function formatNoteIndex(index: NoteIndex): Uint8Array {
  const texts = [...index.vectors.keys()];
  const [first] = index.vectors.values();
  const dimensions = first?.length ?? 1;
  const header = {
    format: indexFormat,
    modelKey: index.modelKey,
    root: index.root,
    dimensions,
    texts,
  };
  const headerBytes = Buffer.from(JSON.stringify(header));
  const start = alignToFloat(headerLengthBytes + headerBytes.byteLength);
  const bytes = new Uint8Array(start + texts.length * dimensions * floatBytes);
  new DataView(bytes.buffer).setUint32(0, headerBytes.byteLength, true);
  bytes.set(headerBytes, headerLengthBytes);
  const floats = new Float32Array(bytes.buffer, start, texts.length * dimensions);
  for (const [position, vector] of [...index.vectors.values()].entries()) {
    floats.set(vector.subarray(0, dimensions), position * dimensions);
  }
  return bytes;
}
