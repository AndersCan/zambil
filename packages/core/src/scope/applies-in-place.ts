import { join, sep } from "node:path";
import type { Note } from "../note/note.ts";
import type { ProjectPlace } from "./project-place.ts";
import { realPath } from "./project-place.ts";

/** Where the agent works, or `undefined` when the hook input names no folder. */
export interface AppliesInPlaceOptions {
  place: ProjectPlace | undefined;
}

interface PathOptions {
  place: ProjectPlace;
}

/** A note with `projects` or `paths` applies only in some places. */
export function isScoped(note: Note): boolean {
  return note.projects.length > 0 || note.paths.length > 0;
}

/** A path in `paths` is full, or starts at the home folder with `~`. `zambil check` warns about any other path. */
export function isScopePath(path: string): boolean {
  return path === "~" || path.startsWith("~/") || path.startsWith("/");
}

function isUnderPath(path: string, options: PathOptions): boolean {
  const { place } = options;
  if (!isScopePath(path)) return false;
  const expanded = path.startsWith("~") ? join(place.home, path.slice(1)) : path;
  const prefix = realPath(expanded);
  const folderPrefix = prefix.endsWith(sep) ? prefix : `${prefix}${sep}`;
  return place.folder === prefix || place.folder.startsWith(folderPrefix);
}

/**
 * Whether a note applies where the agent works. A note without `projects` and `paths` applies
 * everywhere. A note with them applies in a project of that name, or under one of the paths. Names
 * compare in any case. With no place, a scoped note does not apply.
 */
export function appliesInPlace(note: Note, options: AppliesInPlaceOptions): boolean {
  if (!isScoped(note)) return true;
  const { place } = options;
  if (place === undefined) return false;
  const projects = new Set(place.projects.map((project) => project.toLowerCase()));
  const inProject = note.projects.some((project) => projects.has(project.toLowerCase()));
  return inProject || note.paths.some((path) => isUnderPath(path, { place }));
}
