import { left, right, wrap } from "@zambil/core/either";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { starterNoteName, starterNoteText } from "./starter-note.ts";
import type { Either } from "@zambil/core/either";
import { join } from "node:path";

/**
 * `has-files` means a file or folder whose name does not start with `.`. A folder with only hidden
 * entries, such as a new vault with only `.obsidian` or a new `.git`, counts as `empty`.
 */
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
  const hasFiles = entries.value.some((name) => !name.startsWith("."));
  return right(hasFiles ? "has-files" : "empty");
}

/** `write` adds the starter note, which is created and never replaced. `skip` only creates the folder. */
export type StarterMode = "write" | "skip";

/** Whether to write the starter note. */
export interface CreateNotesFolderOptions {
  starter: StarterMode;
}

/** Creates the notes folder if it is missing, and the starter note if asked. */
export async function createNotesFolder(
  folder: string,
  options: CreateNotesFolderOptions,
): Promise<Either<string, undefined>> {
  const created = await wrap(mkdir(folder, { recursive: true }));
  if (!created.ok) return left(`zambil cannot create ${folder}: ${describe(created.error)}`);
  if (options.starter === "skip") return right(undefined);
  const path = join(folder, `${starterNoteName}.md`);
  const written = await wrap(writeFile(path, starterNoteText, { flag: "wx" }));
  if (!written.ok) return left(`zambil cannot write ${path}: ${describe(written.error)}`);
  return right(undefined);
}
