import { describe, expect, test } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRepo } from "../repo/load-repo.ts";
import { noteCachePath } from "./note-cache-file.ts";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { writeTestRepo } from "../repo/write-test-repo.ts";

const minuteAgo = new Date(Date.now() - 60_000);

/** The timing test loads this many notes of about 1.5 KB each, as in the review of zambil. */
const timedNotes = 10_000;

const noteText = "Text of the note. ".repeat(80);

function writeLargeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "zambil-large-repo-"));
  for (let position = 0; position < timedNotes; position += 1) {
    const folderNumber = position % 50;
    const folder = join(root, `folder-${folderNumber}`);
    if (position < 50) mkdirSync(folder);
    const path = join(folder, `note-${position}.md`);
    writeFileSync(path, `---\ndescription: Note ${position}.\ntags: [cart]\n---\n${noteText}\n`);
    utimesSync(path, minuteAgo, minuteAgo);
  }
  return root;
}

interface LoadOptions {
  cacheFolder?: string;
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

function descriptions(root: string, options: LoadOptions) {
  const repo = loadRepo(root, options);
  return repo.ok ? repo.value.notes.map((note) => note.description) : repo.error;
}

const loadRepoUrl = new URL("../repo/load-repo.ts", import.meta.url).href;

/** The repo to load, and the cache folder that both processes share. */
interface ExpiryInOptions {
  root: string;
  cacheFolder: string;
}

/** The expiry time of the one note of the repo, as a new Node process in the time zone reads it. */
function expiryIn(timeZone: string, options: ExpiryInOptions): string {
  const script = [
    `const { loadRepo } = await import(${JSON.stringify(loadRepoUrl)});`,
    `const repo = loadRepo(${JSON.stringify(options.root)}, { cacheFolder: ${JSON.stringify(options.cacheFolder)} });`,
    "console.log(repo.value.notes[0].expiry.time.toISOString());",
  ].join("\n");
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    env: { TZ: timeZone },
  });
  return run.stdout.trim();
}

describe("parseNoteFiles", () => {
  test("reuses a parsed note while its file is unchanged, and parses it again after any write", async () => {
    const root = await writeTestRepo({
      "deploy.md": "---\ndescription: Deploy A.\nexpires: 2030-01-01\n---\nText.\n",
    });
    const path = join(root, "deploy.md");
    const cacheFolder = mkdtempSync(join(tmpdir(), "zambil-cache-"));
    const cachePath = noteCachePath(root, { cacheFolder });
    utimesSync(path, minuteAgo, minuteAgo);
    const fresh = loadRepo(root);
    loadRepo(root, { cacheFolder });
    const written = statSync(cachePath).mtimeMs;
    const cached = loadRepo(root, { cacheFolder });
    const isRewritten = statSync(cachePath).mtimeMs !== written;
    writeFileSync(path, "---\ndescription: Deploy B.\nexpires: 2030-01-01\n---\nText.\n");
    utimesSync(path, minuteAgo, minuteAgo);
    const sameSizeAndTime = descriptions(root, { cacheFolder });
    writeFileSync(cachePath, "{");
    const brokenCache = descriptions(root, { cacheFolder });
    expect({
      cached: cached.ok ? cached.value.notes : [],
      isRewritten,
      sameSizeAndTime,
      brokenCache,
      withoutCache: descriptions(root, {}),
    }).toEqual({
      cached: fresh.ok ? fresh.value.notes : [],
      isRewritten: false,
      sameSizeAndTime: ["Deploy B."],
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

  test("reads an expiry date again in another time zone", async () => {
    const root = await writeTestRepo({
      "deploy.md": "---\ndescription: Deploy.\nexpires: 2030-01-01\n---\n",
    });
    utimesSync(join(root, "deploy.md"), minuteAgo, minuteAgo);
    const cacheFolder = mkdtempSync(join(tmpdir(), "zambil-cache-"));
    const utc = expiryIn("UTC", { root, cacheFolder });
    const tokyo = expiryIn("Asia/Tokyo", { root, cacheFolder });
    expect({ utc, tokyo }).toEqual({
      utc: "2030-01-01T00:00:00.000Z",
      tokyo: "2029-12-31T15:00:00.000Z",
    });
  });

  test(
    "loads 10,000 unchanged notes from the cache in at most three quarters of the time of a full parse",
    { timeout: 120_000 },
    () => {
      const root = writeLargeRepo();
      const cacheFolder = mkdtempSync(join(tmpdir(), "zambil-cache-"));
      try {
        loadRepo(root, { cacheFolder });
        const full = fastestLoad(root, {});
        const cached = fastestLoad(root, { cacheFolder });
        expect(cached).toBeLessThanOrEqual(full * 0.75);
      } finally {
        rmSync(root, { recursive: true, force: true });
        rmSync(cacheFolder, { recursive: true, force: true });
      }
    },
  );
});
