import { left, wrap } from "@zambil/core/either";
import { mkdir, open, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import type { Either } from "@zambil/core/either";
import { isNever } from "@zambil/core/is-never";
import { setTimeout as sleep } from "node:timers/promises";

/** How long a writer waits for another writer, and how often it tries again. */
const waitMs = 10_000;
const retryMs = 25;

/**
 * A lock this old was left by a process that stopped. Reading and writing an index takes well under a
 * second, and the wait is longer, so a waiting writer removes such a lock in time.
 */
const staleMs = 5000;

/** `taken`: this process holds the lock. `busy`: another process holds it. `failed`: the lock file cannot be made. */
type LockAttempt = { kind: "taken" } | { kind: "busy" } | { kind: "failed"; reason: string };

/** The work to do while this process holds the lock. */
export interface WithIndexLockOptions<Result> {
  action: () => Promise<Either<string, Result>>;
}

function errorCode(error: unknown): unknown {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function takeLock(path: string): Promise<LockAttempt> {
  const handle = await wrap(open(path, "wx"));
  if (handle.ok) {
    await wrap(handle.value.close());
    return { kind: "taken" };
  }
  const isBusy = errorCode(handle.error) === "EEXIST";
  return isBusy ? { kind: "busy" } : { kind: "failed", reason: describe(handle.error) };
}

async function removeIfStale(path: string): Promise<void> {
  const stats = await wrap(stat(path));
  const isStale = stats.ok && Date.now() - stats.value.mtimeMs > staleMs;
  if (isStale) await wrap(rm(path, { force: true }));
}

/**
 * Runs the action while this process holds the lock file next to the index, so that two writers
 * never read and write the index at the same time. It waits up to 10 seconds for another writer, and
 * removes a lock that a stopped process left behind. It releases the lock also when the action fails.
 */
export async function withIndexLock<Result>(
  indexPath: string,
  options: WithIndexLockOptions<Result>,
): Promise<Either<string, Result>> {
  const lockPath = `${indexPath}.lock`;
  await wrap(mkdir(dirname(lockPath), { recursive: true }));
  const deadline = Date.now() + waitMs;
  let attempt = await takeLock(lockPath);
  while (attempt.kind === "busy" && Date.now() < deadline) {
    await removeIfStale(lockPath);
    await sleep(retryMs);
    attempt = await takeLock(lockPath);
  }
  switch (attempt.kind) {
    case "busy":
      return left(
        `another zambil holds ${lockPath}. If no other zambil runs, delete that file, then run the command again`,
      );
    case "failed":
      return left(`cannot create the lock file ${lockPath}: ${attempt.reason}`);
    case "taken":
      break;
    default:
      return isNever(attempt);
  }
  const result = await wrap(options.action());
  await wrap(rm(lockPath, { force: true }));
  return result.ok ? result.value : left(describe(result.error));
}
