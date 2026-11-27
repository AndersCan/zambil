import { describe, expect, test } from "vite-plus/test";
import { fileURLToPath } from "node:url";
import { loadRepo } from "../repo/load-repo.ts";
import type { NoteResolution } from "./resolve-note.ts";
import { resolveNote } from "./resolve-note.ts";

const sampleRepo = fileURLToPath(new URL("../../fixtures/sample-repo", import.meta.url));

function summarize(resolution: NoteResolution) {
  if (resolution.kind !== "expired") return { kind: resolution.kind };
  const refresh =
    resolution.whenExpired?.kind === "found" ? resolution.whenExpired.note.name : undefined;
  return { kind: resolution.kind, note: resolution.note.name, refresh };
}

describe("resolveNote", () => {
  test("returns an expired note as expired, with its when-expired note", () => {
    const loaded = loadRepo(sampleRepo);
    const names = loaded.ok ? loaded.value.names : new Map();
    const before = resolveNote({ names }, { name: "today", now: new Date(2026, 10, 27) });
    const after = resolveNote({ names }, { name: "today", now: new Date(2026, 10, 28) });
    expect([summarize(before), summarize(after)]).toEqual([
      { kind: "found" },
      { kind: "expired", note: "today", refresh: "refresh-today" },
    ]);
  });

  test("passes a missing name through", () => {
    const loaded = loadRepo(sampleRepo);
    const resolution = loaded.ok
      ? resolveNote(loaded.value, { name: "nope", now: new Date() })
      : undefined;
    expect(resolution).toEqual({ kind: "missing", name: "nope" });
  });
});
