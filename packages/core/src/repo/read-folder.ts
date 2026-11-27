import { left, right } from "../either.ts";
import type { Dirent } from "node:fs";
import type { Either } from "../either.ts";
import { readdirSync } from "node:fs";

function unsafeReadFolderSync(path: string): Dirent[] {
  return readdirSync(path, { withFileTypes: true });
}

/** Lists the entries of a folder, synchronously for the same speed reason as `readTextFile`. */
export function readFolder(path: string): Either<unknown, Dirent[]> {
  try {
    return right(unsafeReadFolderSync(path));
  } catch (error: unknown) {
    return left(error);
  }
}
