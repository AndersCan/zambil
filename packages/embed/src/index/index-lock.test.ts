import { describe, expect, test } from "vite-plus/test";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { right } from "@zambil/core/either";
import { tmpdir } from "node:os";
import { withIndexLock } from "./index-lock.ts";

const done = { action: () => Promise.resolve(right("done")) };

describe("withIndexLock", () => {
  test("waits for a lock that another writer holds, and removes one that a stopped process left", async () => {
    const folder = await mkdtemp(join(tmpdir(), "zambil-lock-"));
    const indexPath = join(folder, "repo.index");
    const lockPath = `${indexPath}.lock`;
    await writeFile(lockPath, "");
    setTimeout(() => void rm(lockPath, { force: true }), 100);
    const started = performance.now();
    const waited = await withIndexLock(indexPath, done);
    const waitedMs = performance.now() - started;
    await writeFile(lockPath, "");
    const minuteAgo = new Date(Date.now() - 60_000);
    await utimes(lockPath, minuteAgo, minuteAgo);
    const stale = await withIndexLock(indexPath, done);
    expect({
      waited,
      hasWaited: waitedMs >= 90,
      stale,
      isReleased: existsSync(lockPath),
    }).toEqual({
      waited: right("done"),
      hasWaited: true,
      stale: right("done"),
      isReleased: false,
    });
  });
});
