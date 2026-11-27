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
  test("reads a broken file as no notes, keeps no file for an unsafe id, and removes old files at SessionStart", async () => {
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
    const started = await keepSessionNotes(request("SessionStart", { sessionId: "new" }), {
      ...options,
      before: {},
      added: { s: "v2" },
    });
    expect({
      kept,
      broken,
      started,
      unsafe: await readSessionNotes(unsafe, options),
      files: (await readdir(folder)).toSorted(),
      fresh: await readSessionNotes(request("Stop", { sessionId: "new" }), options),
    }).toEqual({
      kept: { ok: true, value: undefined },
      broken: {},
      started: { ok: true, value: undefined },
      unsafe: {},
      files: ["broken.json", "new.json"],
      fresh: { s: "v2" },
    });
  });
});
