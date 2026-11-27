import { basename, dirname, join, resolve } from "node:path";
import { lstatSync, readFileSync } from "node:fs";
import type { Stats } from "node:fs";

/**
 * Where an agent works: its folder, the names of the project there (the git repo and the folder), and
 * the home folder that `~/` in a note's `paths` stands for.
 */
export interface ProjectPlace {
  folder: string;
  projects: string[];
  home: string;
}

/** The home folder that `~/` stands for. */
export interface FindProjectPlaceOptions {
  home: string;
}

type GitEntry = "folder" | "file" | "none";

function unsafeLstat(path: string): Stats | undefined {
  return lstatSync(path, { throwIfNoEntry: false });
}

/** A `.git` entry that cannot be read counts as none, so the search goes on upward. */
function gitEntry(path: string): GitEntry {
  let info: Stats | undefined;
  try {
    info = unsafeLstat(path);
  } catch {
    return "none";
  }
  if (info === undefined) return "none";
  return info.isDirectory() ? "folder" : "file";
}

function unsafeReadText(path: string): string {
  return readFileSync(path, "utf8");
}

function readText(path: string): string {
  try {
    return unsafeReadText(path);
  } catch {
    return "";
  }
}

const worktreeGitDir = /^gitdir:\s*(?<main>.+)\/\.git\/worktrees\/[^/]+\s*$/m;

/** A worktree has a `.git` file that points into the `.git` folder of the main clone, which names the repo. */
function repoName(root: string): string {
  if (gitEntry(join(root, ".git")) !== "file") return basename(root);
  const main = worktreeGitDir.exec(readText(join(root, ".git")))?.groups?.main;
  return main === undefined ? basename(root) : basename(main);
}

function findRepoRoot(folder: string): string | undefined {
  let current = folder;
  while (gitEntry(join(current, ".git")) === "none") {
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
  return current;
}

/**
 * The place of a folder. It looks up the folders above it for a `.git` entry, a few `lstat` calls, so
 * that a note for a repo applies in each folder of that repo.
 */
export function findProjectPlace(folder: string, options: FindProjectPlaceOptions): ProjectPlace {
  const full = resolve(folder);
  const root = findRepoRoot(full);
  const names = root === undefined ? [basename(full)] : [repoName(root), basename(full)];
  return { folder: full, projects: [...new Set(names)], home: options.home };
}
