/** How a file's place in the repo marks it: a Markdown note, or the `SKILL.md` of a skill folder. */
export type NoteFileKind = "note" | "skill";

/** A note file found in a repo, before it is read. `path` is relative to the repo root and uses `/`. */
export interface NoteFile {
  path: string;
  name: string;
  kind: NoteFileKind;
}
