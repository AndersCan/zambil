import { left, right, wrap } from "../either.ts";
import type { Dirent } from "node:fs";
import type { Either } from "../either.ts";
import { join } from "node:path";
import type { NoteFile } from "../note/note-file.ts";
import type { NoteProblem } from "../note/note-problem.ts";
import { readdir } from "node:fs/promises";

/** The note files of a repo, sorted by path, and the folders that could not be read. */
export interface FoundNoteFiles {
  files: NoteFile[];
  problems: NoteProblem[];
}

interface WalkOptions {
  root: string;
}

const skillFileName = "SKILL.md";

function isSkipped(entry: Dirent): boolean {
  return entry.name.startsWith(".") || entry.name === "node_modules";
}

function isSkillFolder(entries: Dirent[]): boolean {
  for (const entry of entries) {
    if (entry.isFile() && entry.name === skillFileName) return true;
  }
  return false;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function walkFolder(
  folder: string,
  options: WalkOptions,
): Promise<Either<unknown, FoundNoteFiles>> {
  const entries = await wrap(readdir(join(options.root, folder), { withFileTypes: true }));
  if (!entries.ok) return left(entries.error);
  if (folder !== "" && isSkillFolder(entries.value)) {
    const name = folder.split("/").at(-1) ?? folder;
    return right({
      files: [{ path: `${folder}/${skillFileName}`, name, kind: "skill" }],
      problems: [],
    });
  }

  const found: FoundNoteFiles = { files: [], problems: [] };
  const subfolders: string[] = [];
  for (const entry of entries.value) {
    if (isSkipped(entry)) continue;
    const path = folder === "" ? entry.name : `${folder}/${entry.name}`;
    if (entry.isDirectory()) subfolders.push(path);
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (path === skillFileName) {
      const message =
        "SKILL.md belongs in a skill folder, such as `skills/<name>/SKILL.md`, not in the repo root";
      found.problems.push({ severity: "error", path, message });
      continue;
    }
    found.files.push({ path, name: entry.name.slice(0, -".md".length), kind: "note" });
  }

  const nested = await Promise.all(
    subfolders.map(async (subfolder) => ({
      subfolder,
      walked: await walkFolder(subfolder, options),
    })),
  );
  for (const { subfolder, walked } of nested) {
    if (walked.ok) {
      found.files.push(...walked.value.files);
      found.problems.push(...walked.value.problems);
      continue;
    }
    const message = `zambil cannot read this folder: ${describeError(walked.error)}`;
    found.problems.push({ severity: "warning", path: subfolder, message });
  }
  return right(found);
}

/**
 * Finds every Markdown note under `root`. Hidden files and folders, such as `.obsidian`, and
 * `node_modules` are skipped. A folder with a `SKILL.md` is one skill: its other files are not notes.
 * Symlinks are not followed.
 */
export async function findNoteFiles(root: string): Promise<Either<unknown, FoundNoteFiles>> {
  const walked = await walkFolder("", { root });
  if (!walked.ok) return walked;
  const files = walked.value.files.toSorted((first, second) => (first.path < second.path ? -1 : 1));
  return right({ files, problems: walked.value.problems });
}
