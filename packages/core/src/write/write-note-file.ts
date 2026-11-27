import { left, right } from "../either.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Either } from "../either.ts";

/** `create` fails when a file is already at the path. `replace` overwrites the note that is there. */
export type WriteMode = "create" | "replace";

/** The text of the note and how to treat a file that is already there. */
export interface WriteNoteFileOptions {
  text: string;
  mode: WriteMode;
}

function unsafeWriteFile(path: string, options: WriteNoteFileOptions): void {
  writeFileSync(path, options.text, { flag: options.mode === "create" ? "wx" : "w" });
}

function unsafeMakeFolder(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

/** Writes a note file. A new note also gets its missing folders. */
export function writeNoteFile(path: string, options: WriteNoteFileOptions): Either<unknown, true> {
  try {
    if (options.mode === "create") unsafeMakeFolder(path);
    unsafeWriteFile(path, options);
    return right(true);
  } catch (error: unknown) {
    return left(error);
  }
}
