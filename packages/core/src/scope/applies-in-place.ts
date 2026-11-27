import { join, resolve, sep } from "node:path";
import type { Note } from "../note/note.ts";
import type { ProjectPlace } from "./project-place.ts";

/** Where the agent works, or `undefined` when the hook input names no folder. */
export interface AppliesInPlaceOptions {
  place: ProjectPlace | undefined;
}

interface PathOptions {
  place: ProjectPlace;
}

/** A path that is not full and does not start with `~/` gets a warning from `zambil check` and never matches. */
function isUnderPath(path: string, options: PathOptions): boolean {
  const { place } = options;
  const expanded = path.startsWith("~/") ? join(place.home, path.slice(2)) : path;
  if (!expanded.startsWith("/")) return false;
  const prefix = resolve(expanded);
  return place.folder === prefix || place.folder.startsWith(`${prefix}${sep}`);
}

/**
 * Whether a note applies where the agent works. A note without `projects` and `paths` applies
 * everywhere. A note with them applies in a project of that name, or under one of the paths. Names
 * compare in any case. With no place, a scoped note does not apply.
 */
export function appliesInPlace(note: Note, options: AppliesInPlaceOptions): boolean {
  const isScoped = note.projects.length > 0 || note.paths.length > 0;
  if (!isScoped) return true;
  const { place } = options;
  if (place === undefined) return false;
  const projects = new Set(place.projects.map((project) => project.toLowerCase()));
  const inProject = note.projects.some((project) => projects.has(project.toLowerCase()));
  return inProject || note.paths.some((path) => isUnderPath(path, { place }));
}
