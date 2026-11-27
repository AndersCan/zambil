import { left, right } from "../either.ts";
import { comparePaths } from "./compare-paths.ts";
import type { Dirent } from "node:fs";
import type { Either } from "../either.ts";
import { join } from "node:path";
import type { NoteFile } from "../note/note-file.ts";
import type { NoteProblem } from "../note/note-problem.ts";
import { readFolder } from "./read-folder.ts";

/** The note files of a repo, sorted by path, and the folders that could not be read. */
export interface FoundNoteFiles {
  files: NoteFile[];
  problems: NoteProblem[];
}

interface WalkOptions {
  root: string;
  found: FoundNoteFiles;
}

interface EntriesOptions extends WalkOptions {
  folder: string;
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

function walkEntries(entries: Dirent[], options: EntriesOptions): void {
  const { found, folder } = options;
  if (folder !== "" && isSkillFolder(entries)) {
    const name = folder.split("/").at(-1) ?? folder;
    found.files.push({ path: `${folder}/${skillFileName}`, name, kind: "skill" });
    return;
  }
  for (const entry of entries) {
    if (isSkipped(entry)) continue;
    const path = folder === "" ? entry.name : `${folder}/${entry.name}`;
    if (entry.isDirectory()) walkFolder(path, options);
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (path === skillFileName) {
      const message =
        "SKILL.md belongs in a skill folder, such as `skills/<name>/SKILL.md`, not in the repo root";
      found.problems.push({ severity: "error", path, message });
      continue;
    }
    found.files.push({ path, name: entry.name.slice(0, -".md".length), kind: "note" });
  }
}

function walkFolder(folder: string, options: WalkOptions): void {
  const entries = readFolder(join(options.root, folder));
  if (entries.ok) {
    walkEntries(entries.value, { ...options, folder });
    return;
  }
  const message = `zambil cannot read this folder: ${describeError(entries.error)}`;
  options.found.problems.push({ severity: "warning", path: folder, message });
}

/**
 * Finds every Markdown note under `root`. Hidden files and folders, such as `.obsidian`, and
 * `node_modules` are skipped. A folder with a `SKILL.md` is one skill: its other files are not notes.
 * Symlinks are not followed.
 */
export function findNoteFiles(root: string): Either<unknown, FoundNoteFiles> {
  const entries = readFolder(root);
  if (!entries.ok) return left(entries.error);
  const found: FoundNoteFiles = { files: [], problems: [] };
  walkEntries(entries.value, { root, found, folder: "" });
  const files = found.files.toSorted((first, second) =>
    comparePaths(first.path, { other: second.path }),
  );
  return right({ files, problems: found.problems });
}
