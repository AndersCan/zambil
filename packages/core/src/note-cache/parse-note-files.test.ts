import { describe, expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRepo } from "../repo/load-repo.ts";
import { noteCachePath } from "./note-cache-file.ts";
import { tmpdir } from "node:os";
import { writeTestRepo } from "../repo/write-test-repo.ts";

const minuteAgo = new Date(Date.now() - 60_000);
const hourAgo = new Date(Date.now() - 3_600_000);

/** The most notes that zambil supports in one repo. The timing test loads this many. */
const supportedNotes = 20_000;

function writeLargeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "zambil-large-repo-"));
  for (let position = 0; position < supportedNotes; position += 1) {
    const folderNumber = position % 50;
    const folder = join(root, `folder-${folderNumber}`);
    if (position < 50) mkdirSync(folder);
    const path = join(folder, `note-${position}.md`);
    writeFileSync(path, `---\ndescription: Note ${position}.\ntags: [cart]\n---\nText.\n`);
    utimesSync(path, minuteAgo, minuteAgo);
  }
  return root;
}

function fastestLoad(root: string, options: LoadOptions): number {
  const times: number[] = [];
  for (let run = 0; run < 3; run += 1) {
    const started = performance.now();
    loadRepo(root, options);
    times.push(performance.now() - started);
  }
  return Math.min(...times);
}

interface LoadOptions {
  cacheFolder?: string;
}

function descriptions(root: string, options: LoadOptions) {
  const repo = loadRepo(root, options);
  return repo.ok ? repo.value.notes.map((note) => note.description) : repo.error;
}

describe("parseNoteFiles", () => {
  test("reuses a parsed note while its file keeps its size and modified time", async () => {
    const root = await writeTestRepo({
      "deploy.md": "---\ndescription: Deploy A.\nexpires: 2030-01-01\n---\nText.\n",
    });
    const path = join(root, "deploy.md");
    const cacheFolder = mkdtempSync(join(tmpdir(), "zambil-cache-"));
    utimesSync(path, minuteAgo, minuteAgo);
    const fresh = loadRepo(root);
    loadRepo(root, { cacheFolder });
    const cached = loadRepo(root, { cacheFolder });
    writeFileSync(path, "---\ndescription: Deploy B.\nexpires: 2030-01-01\n---\nText.\n");
    utimesSync(path, minuteAgo, minuteAgo);
    const sameStats = descriptions(root, { cacheFolder });
    utimesSync(path, hourAgo, hourAgo);
    const newTime = descriptions(root, { cacheFolder });
    writeFileSync(noteCachePath(root, { cacheFolder }), "{");
    const brokenCache = descriptions(root, { cacheFolder });
    const freshNotes = fresh.ok ? fresh.value.notes : [];
    expect({
      cached: cached.ok ? cached.value.notes : [],
      sameStats,
      newTime,
      brokenCache,
      withoutCache: descriptions(root, {}),
    }).toEqual({
      cached: freshNotes,
      sameStats: ["Deploy A."],
      newTime: ["Deploy B."],
      brokenCache: ["Deploy B."],
      withoutCache: ["Deploy B."],
    });
  });

  test("parses a file again on the next load when it changed in the last two seconds", async () => {
    const root = await writeTestRepo({ "deploy.md": "---\ndescription: Deploy A.\n---\n" });
    const path = join(root, "deploy.md");
    const cacheFolder = mkdtempSync(join(tmpdir(), "zambil-cache-"));
    const first = descriptions(root, { cacheFolder });
    const { mtime } = statSync(path);
    writeFileSync(path, "---\ndescription: Deploy B.\n---\n");
    utimesSync(path, mtime, mtime);
    expect({ first, second: descriptions(root, { cacheFolder }) }).toEqual({
      first: ["Deploy A."],
      second: ["Deploy B."],
    });
  });

  test(
    "loads 20,000 unchanged notes from the cache in at most half the time of a full parse",
    { timeout: 120_000 },
    () => {
      const root = writeLargeRepo();
      const cacheFolder = mkdtempSync(join(tmpdir(), "zambil-cache-"));
      loadRepo(root, { cacheFolder });
      const full = fastestLoad(root, {});
      const cached = fastestLoad(root, { cacheFolder });
      expect(cached).toBeLessThanOrEqual(full / 2);
    },
  );
});
