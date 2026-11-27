import { join, posix } from "node:path";
import { left, right } from "../either.ts";
import type { Either } from "../either.ts";
import { isFile } from "../repo/is-file.ts";
import { isNever } from "../is-never.ts";
import { lstatSync } from "node:fs";
import type { Stats } from "node:fs";

/** The root of the repo that the folder must be inside. */
export interface CheckFolderOptions {
  root: string;
}

type FolderState = "missing" | "folder" | "link" | "other";

function unsafeLstat(path: string): Stats | undefined {
  return lstatSync(path, { throwIfNoEntry: false });
}

function readStats(path: string): Either<unknown, Stats | undefined> {
  try {
    return right(unsafeLstat(path));
  } catch (error: unknown) {
    return left(error);
  }
}

function folderState(path: string): FolderState {
  const stats = readStats(path);
  if (!stats.ok) return "other";
  if (stats.value === undefined) return "missing";
  if (stats.value.isSymbolicLink()) return "link";
  return stats.value.isDirectory() ? "folder" : "other";
}

function isHiddenPart(part: string): boolean {
  return part.startsWith(".") || part === "node_modules";
}

function checkExistingParts(parts: string[], options: CheckFolderOptions): Either<string, true> {
  let folder = "";
  for (const part of parts) {
    folder = folder === "" ? part : `${folder}/${part}`;
    const state = folderState(join(options.root, folder));
    switch (state) {
      case "missing":
        return right(true);
      case "link":
        return left(`${folder} is a symbolic link, and zambil writes only inside the repo`);
      case "other":
        return left(`${folder} is not a folder`);
      case "folder":
        break;
      default:
        return isNever(state);
    }
    if (isFile(join(options.root, folder, "SKILL.md"))) {
      return left(
        `${folder} is a skill folder, and its other files are not notes; pick another folder`,
      );
    }
  }
  return right(true);
}

/**
 * Makes sure that a new note can go in a folder: inside the repo, not hidden, not through a symbolic
 * link and not in a skill folder, because zambil would not read a note there. Returns the folder
 * relative to the root, with `/`, or `""` for the root.
 */
export function checkFolder(folder: string, options: CheckFolderOptions): Either<string, string> {
  const normalized = posix.normalize(folder.replaceAll("\\", "/")).replace(/\/+$/, "");
  const relative = normalized === "." ? "" : normalized;
  const isOutside = posix.isAbsolute(relative) || relative === ".." || relative.startsWith("../");
  if (isOutside) return left(`The folder ${folder} is outside the repo`);
  if (relative === "") return right("");
  const parts = relative.split("/");
  if (parts.some((part) => isHiddenPart(part))) {
    return left(
      `zambil does not read notes in ${relative}, because a part starts with . or is node_modules`,
    );
  }
  const existing = checkExistingParts(parts, options);
  return existing.ok ? right(relative) : existing;
}
