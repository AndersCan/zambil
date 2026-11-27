import { left, right } from "../either.ts";
import type { Either } from "../either.ts";
import { readFileSync } from "node:fs";

function unsafeReadFileSync(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Reads a UTF-8 file. It reads synchronously on purpose: the CLI runs on every prompt, and a thousand
 * small notes read about seven times faster this way than with parallel promises.
 */
export function readTextFile(path: string): Either<unknown, string> {
  try {
    return right(unsafeReadFileSync(path));
  } catch (error: unknown) {
    return left(error);
  }
}
