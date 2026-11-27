import { describe, expect, test } from "vite-plus/test";
import { keepSessionNotes, readSessionNotes } from "./session-notes.ts";
import { mkdir, mkdtemp, readdir, utimes, writeFile } from "node:fs/promises";
import type { HookAnswerRequest } from "../hook-input/parse-hook-input.ts";
import { join } from "node:path";
import { sessionFileMaxAge } from "./session-file.ts";
import { tmpdir } from "node:os";

const now = new Date(2026, 10, 27, 9, 0);

interface RequestOptions {
  sessionId: string;
}

function request(hookEventName: string, options: RequestOptions): HookAnswerRequest {
  const session = { sessionId: options.sessionId };
  return { kind: "answer", input: { kind: "plain", hookEventName }, session };
}

describe("session notes", () => {
  test("reads a broken file as no notes, keeps no file for an unsafe id, and starts again at SessionStart", async () => {
    const cacheHome = await mkdtemp(join(tmpdir(), "zambil-sessions-"));
    const options = { environment: { home: "/home/ada", workingFolder: "/", cacheHome }, now };
    const folder = join(cacheHome, "zambil", "sessions");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "broken.json"), "{ not json");
    await writeFile(join(folder, "old.json"), '{"notes":{"a":"v1"}}\n');
    const longAgo = new Date(now.getTime() - sessionFileMaxAge - 1000);
    await utimes(join(folder, "old.json"), longAgo, longAgo);
    const unsafe = request("Stop", { sessionId: "../escape" });
    const kept = await keepSessionNotes(unsafe, { ...options, before: {}, added: { a: "v1" } });
    const broken = await readSessionNotes(request("Stop", { sessionId: "broken" }), options);
    const written = await keepSessionNotes(request("Stop", { sessionId: "s1" }), {
      ...options,
      before: { a: "v1" },
      added: { b: "v2" },
    });
    const beforeStart = await readSessionNotes(request("Stop", { sessionId: "s1" }), options);
    const started = await readSessionNotes(request("SessionStart", { sessionId: "s1" }), options);
    expect({
      kept,
      broken,
      written,
      beforeStart,
      started,
      unsafe: await readSessionNotes(unsafe, options),
      files: await readdir(folder),
      afterStart: await readSessionNotes(request("Stop", { sessionId: "s1" }), options),
    }).toEqual({
      kept: { ok: true, value: undefined },
      broken: { ok: true, value: {} },
      written: { ok: true, value: undefined },
      beforeStart: { ok: true, value: { a: "v1", b: "v2" } },
      started: { ok: true, value: {} },
      unsafe: { ok: true, value: {} },
      files: ["broken.json"],
      afterStart: { ok: true, value: {} },
    });
  });
});
