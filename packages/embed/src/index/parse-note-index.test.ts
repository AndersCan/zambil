import { describe, expect, test } from "vite-plus/test";
import { formatNoteIndex, parseNoteIndex } from "./parse-note-index.ts";

const index = {
  modelKey: "model@1",
  root: "/notes",
  vectors: new Map([
    ["How to deploy.", Float32Array.of(0.5, -1)],
    ["Git.", Float32Array.of(2, 0.25)],
  ]),
};

/** An index file with this header and no vectors, padded to a float boundary. */
function withHeader(header: unknown): Uint8Array {
  const text = Buffer.from(JSON.stringify(header));
  const bytes = new Uint8Array(Math.ceil((4 + text.byteLength) / 4) * 4);
  new DataView(bytes.buffer).setUint32(0, text.byteLength, true);
  bytes.set(text, 4);
  return bytes;
}

describe("parseNoteIndex", () => {
  test("reads what formatNoteIndex writes as views into one buffer, also off a float boundary, and no index from a cut file or another format", () => {
    const bytes = formatNoteIndex(index);
    const shifted = new Uint8Array(bytes.byteLength + 1);
    shifted.set(bytes, 1);
    const header = { modelKey: "model@1", root: "/notes", dimensions: 2, texts: [] };
    expect({
      roundTrip: parseNoteIndex(bytes),
      offBoundary: parseNoteIndex(shifted.subarray(1)),
      cut: parseNoteIndex(bytes.subarray(0, bytes.byteLength - 4)),
      otherFormat: parseNoteIndex(withHeader({ ...header, format: 2 })),
      emptyIndex: parseNoteIndex(withHeader({ ...header, format: 3 }))?.vectors.size,
      notAnIndex: parseNoteIndex(Buffer.from("{}")),
      buffers: new Set(
        [...(parseNoteIndex(bytes)?.vectors.values() ?? [])].map((vector) => vector.buffer),
      ).size,
    }).toEqual({
      roundTrip: index,
      offBoundary: index,
      cut: undefined,
      otherFormat: undefined,
      emptyIndex: 0,
      notAnIndex: undefined,
      buffers: 1,
    });
  });
});
