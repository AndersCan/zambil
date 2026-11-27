import { statSync } from "node:fs";

function unsafeStat(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() === true;
}

/** Tells whether a regular file is at `path`. A path that cannot be checked is not a file. */
export function isFile(path: string): boolean {
  try {
    return unsafeStat(path);
  } catch {
    return false;
  }
}
