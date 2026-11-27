import { left, right } from "../either.ts";
import { checkFolder } from "./check-folder.ts";
import { checkNewName } from "./check-new-name.ts";
import type { ConfigurationRepo } from "../repo/configuration-repo.ts";
import type { Either } from "../either.ts";
import { findNote } from "../repo/find-note.ts";
import { isNever } from "../is-never.ts";
import { nameKey } from "../repo/index-names.ts";
import type { NoteFile } from "../note/note-file.ts";
import { readTextFile } from "../repo/read-text-file.ts";
import type { SaveRefusal } from "./save-note.ts";

/** The file to write, and its current text when the note exists. */
export interface SaveTarget {
  file: NoteFile;
  oldText?: string;
}

/** The repo to look in. Only a new note takes a folder. An existing note stays where it is. */
export interface FindSaveTargetOptions {
  repo: ConfigurationRepo;
  folder?: string;
}

function invalid(message: string): Either<SaveRefusal, never> {
  return left({ reason: "invalid", message });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The file for a new note. The name and its aliases must be free, and the folder must be one that zambil reads. */
export function findNewTarget(
  name: string,
  options: FindSaveTargetOptions,
): Either<SaveRefusal, SaveTarget> {
  const checked = checkNewName(name);
  if (!checked.ok) return invalid(checked.error);
  const lookup = findNote(options.repo, { name });
  if (lookup.kind === "ambiguous") {
    return invalid(`The name "${name}" is already used by more than one note.`);
  }
  if (lookup.kind === "found") {
    const { note } = lookup;
    if (nameKey(note.name) !== nameKey(name)) {
      return invalid(
        `"${name}" is an alias of ${note.path}. Pick another name, or rewrite that note by its name, "${note.name}".`,
      );
    }
    return left({
      reason: "taken",
      message: `The name "${name}" is already used by ${note.path}.`,
    });
  }
  const folder = checkFolder(options.folder ?? "", { root: options.repo.root });
  if (!folder.ok) return invalid(`${folder.error}.`);
  const path = folder.value === "" ? `${name}.md` : `${folder.value}/${name}.md`;
  return right({ file: { path, name, kind: "note" } });
}

/** The file of an existing note, found by its name, not by an alias, so that the writer knows which note changes. */
export function findExistingTarget(
  name: string,
  options: FindSaveTargetOptions,
): Either<SaveRefusal, SaveTarget> {
  const lookup = findNote(options.repo, { name });
  switch (lookup.kind) {
    case "missing":
      return left({ reason: "missing", message: `No note has the name "${name}".` });
    case "ambiguous": {
      const paths = lookup.notes.map((note) => note.path);
      const listed = paths.join(", ");
      return invalid(
        `The name "${name}" is used by more than one note: ${listed}. Make the names unique first.`,
      );
    }
    case "found":
      break;
    default:
      return isNever(lookup);
  }
  const { note } = lookup;
  if (nameKey(note.name) !== nameKey(name)) {
    return invalid(`"${name}" is an alias of ${note.path}. Use its name, "${note.name}".`);
  }
  const text = readTextFile(`${options.repo.root}/${note.path}`);
  if (!text.ok) return invalid(`zambil cannot read ${note.path}: ${describeError(text.error)}.`);
  const kind = note.kind === "skill" ? "skill" : "note";
  return right({ file: { path: note.path, name: note.name, kind }, oldText: text.value });
}
