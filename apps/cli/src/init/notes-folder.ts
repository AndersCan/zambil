import { left, right, wrap } from "@zambil/core/either";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { starterNoteName, starterNoteText } from "./starter-note.ts";
import type { Either } from "@zambil/core/either";
import { join } from "node:path";

/** `has-files` covers any entry, hidden ones too, such as the `.obsidian` folder of a vault. */
export type FolderState = "missing" | "empty" | "has-files" | "not-a-folder";

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function isMissing(reason: unknown): boolean {
  return reason instanceof Error && "code" in reason && reason.code === "ENOENT";
}

/** Whether the notes folder is there, and whether it holds anything. */
export async function folderState(folder: string): Promise<Either<string, FolderState>> {
  const status = await wrap(stat(folder));
  if (!status.ok) {
    if (isMissing(status.error)) return right("missing");
    return left(`zambil cannot read ${folder}: ${describe(status.error)}`);
  }
  if (!status.value.isDirectory()) return right("not-a-folder");
  const entries = await wrap(readdir(folder));
  if (!entries.ok) return left(`zambil cannot read ${folder}: ${describe(entries.error)}`);
  return right(entries.value.length === 0 ? "empty" : "has-files");
}

/** `written` when the folder got the starter note, `kept` when it already had files and stayed as it was. */
export type PrepareResult = "written" | "kept";

/** What `folderState` found. */
export interface PrepareNotesFolderOptions {
  state: FolderState;
}

/**
 * Creates the notes folder if it is missing, and writes the starter note into a folder that has no
 * files. A folder with files stays as it is. The note is created, never replaced.
 */
export async function prepareNotesFolder(
  folder: string,
  options: PrepareNotesFolderOptions,
): Promise<Either<string, PrepareResult>> {
  const { state } = options;
  if (state === "has-files" || state === "not-a-folder") return right("kept");
  const created = await wrap(mkdir(folder, { recursive: true }));
  if (!created.ok) return left(`zambil cannot create ${folder}: ${describe(created.error)}`);
  const path = join(folder, `${starterNoteName}.md`);
  const written = await wrap(writeFile(path, starterNoteText, { flag: "wx" }));
  if (!written.ok) return left(`zambil cannot write ${path}: ${describe(written.error)}`);
  return right("written");
}
