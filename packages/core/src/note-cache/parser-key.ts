import { left, right } from "../either.ts";
import { createHash } from "node:crypto";
import type { Either } from "../either.ts";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFolder } from "../repo/read-folder.ts";
import { readTextFile } from "../repo/read-text-file.ts";

/** The folders with the code that turns a file into a note. */
const parserFolders = ["../note/", "../properties/", "../expiry/", "../scope/"];

/**
 * A hash of the code that parses a note. The note cache keeps it, so that a zambil update that
 * parses notes in another way does not reuse notes that the old code parsed. It reads about 20 small
 * files.
 */
export function parserKey(): Either<unknown, string> {
  const hash = createHash("sha256");
  for (const folder of parserFolders) {
    const path = fileURLToPath(new URL(folder, import.meta.url));
    const entries = readFolder(path);
    if (!entries.ok) return left(entries.error);
    const names: string[] = [];
    for (const entry of entries.value) if (entry.name.endsWith(".ts")) names.push(entry.name);
    for (const name of names.toSorted()) {
      const source = readTextFile(join(path, name));
      if (!source.ok) return left(source.error);
      hash.update(name).update(source.value);
    }
  }
  return right(hash.digest("hex").slice(0, 16));
}
