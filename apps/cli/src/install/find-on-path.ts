import { accessSync, constants, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";

/** The folders of `PATH`, in order. */
export interface FindOnPathOptions {
  searchPath: string[];
}

function unsafeCheckExecutable(path: string): void {
  accessSync(path, constants.X_OK);
}

function isExecutableFile(path: string): boolean {
  if (statSync(path, { throwIfNoEntry: false })?.isFile() !== true) return false;
  try {
    unsafeCheckExecutable(path);
    return true;
  } catch {
    return false;
  }
}

/** The full path of the first program with this name in `PATH`, the same one that a shell runs. */
export function findOnPath(name: string, options: FindOnPathOptions): string | undefined {
  for (const folder of options.searchPath) {
    const path = join(folder, name);
    if (isAbsolute(folder) && isExecutableFile(path)) return path;
  }
  return undefined;
}
