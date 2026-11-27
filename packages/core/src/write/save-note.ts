import { findExistingTarget, findNewTarget } from "./find-save-target.ts";
import { left, right } from "../either.ts";
import { addedRepoErrors } from "./added-repo-errors.ts";
import type { ConfigurationRepo } from "../repo/configuration-repo.ts";
import { editFrontmatter } from "./edit-frontmatter.ts";
import type { Either } from "../either.ts";
import { findNote } from "../repo/find-note.ts";
import { isDeepStrictEqual } from "node:util";
import { isNever } from "../is-never.ts";
import { join } from "node:path";
import { nameKey } from "../repo/index-names.ts";
import type { Note } from "../note/note.ts";
import type { NoteFile } from "../note/note-file.ts";
import { parseExpires } from "../expiry/parse-expires.ts";
import { parseFrontmatter } from "../properties/parse-frontmatter.ts";
import { parseLinkTarget } from "../properties/parse-link-target.ts";
import { parseNote } from "../note/parse-note.ts";
import type { PropertyEdit } from "./edit-frontmatter.ts";
import type { SaveTarget } from "./find-save-target.ts";
import { splitFrontmatter } from "../properties/split-frontmatter.ts";
import { splitYamlBlocks } from "./edit-frontmatter.ts";
import { writeNoteFile } from "./write-note-file.ts";

/** `create` writes a new note, `rewrite` changes an existing one, `verify` gives it a new `expires` date only. */
export type SaveMode = "create" | "rewrite" | "verify";

/** The writer's choice about expiry: a date, or on purpose no expiry at all. */
export type ExpiryChoice = { kind: "expires"; text: string } | { kind: "none" };

/** A create or a rewrite. `text` is Markdown with optional frontmatter. Empty content in a rewrite keeps the old content. */
export interface WriteRequest {
  name: string;
  text: string;
  expiry: ExpiryChoice;
  whenExpired?: string;
}

/** What to save. Only a new note takes a folder, relative to the repo root. */
export type SaveRequest =
  | ({ mode: "create"; folder?: string } & WriteRequest)
  | ({ mode: "rewrite" } & WriteRequest)
  | { mode: "verify"; name: string; expires: string };

/** `taken` and `missing` mean that the writer picked the wrong mode. `invalid` is any other refusal. */
export type SaveRefusalReason = "taken" | "missing" | "invalid";

/** Why zambil did not save a note. The note file is unchanged. */
export interface SaveRefusal {
  reason: SaveRefusalReason;
  message: string;
}

/** The loaded repo to write into, and the moment that a new `expires` date must be after. */
export interface SaveNoteOptions {
  repo: ConfigurationRepo;
  now: Date;
}

/** The note as it was written, and the warnings that it did not have before. */
export interface SavedNote {
  mode: SaveMode;
  note: Note;
  warnings: string[];
}

interface Changes {
  edits: PropertyEdit[];
  content?: string;
}

interface ChangeOptions {
  repo: ConfigurationRepo;
  now: Date;
  target: SaveTarget;
}

const expiryKeys = new Set(["expires", "when-expired"]);
const delimiterLine = /^---[ \t]*\r?(?:\n|$)/;

function invalid(message: string): Either<SaveRefusal, never> {
  return left({ reason: "invalid", message });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function expiresEdit(text: string, options: ChangeOptions): Either<SaveRefusal, PropertyEdit> {
  const expiry = parseExpires(text);
  if (expiry.kind !== "at") {
    return invalid(`"${text}" is not a date. Write 2026-11-28 or 2026-11-28T09:30.`);
  }
  if (expiry.time.getTime() <= options.now.getTime()) {
    return invalid(`The expires date ${text} is not in the future.`);
  }
  return right({ kind: "set", key: "expires", text: `expires: ${text}\n` });
}

function whenExpiredName(link: string, options: ChangeOptions): Either<SaveRefusal, string> {
  const name = parseLinkTarget(link);
  if (nameKey(name) === nameKey(options.target.file.name)) return right(options.target.file.name);
  const lookup = findNote(options.repo, { name });
  switch (lookup.kind) {
    case "found":
      return right(lookup.note.name);
    case "missing":
      return invalid(`No note has the name "${name}" for when-expired. Save that note first.`);
    case "ambiguous":
      return invalid(`The when-expired name "${name}" is used by more than one note.`);
    default:
      return isNever(lookup);
  }
}

function expiryEdit(
  expiry: ExpiryChoice,
  options: ChangeOptions,
): Either<SaveRefusal, PropertyEdit> {
  switch (expiry.kind) {
    case "none":
      return right({ kind: "remove", key: "expires" });
    case "expires":
      return expiresEdit(expiry.text, options);
    default:
      return isNever(expiry);
  }
}

function expiryEdits(
  request: WriteRequest,
  options: ChangeOptions,
): Either<SaveRefusal, PropertyEdit[]> {
  const expires = expiryEdit(request.expiry, options);
  if (!expires.ok) return expires;
  const edits = [expires.value];
  if (request.expiry.kind === "none") {
    if (request.whenExpired !== undefined) {
      return invalid("A note without expires has no when-expired note.");
    }
    edits.push({ kind: "remove", key: "when-expired" });
    return right(edits);
  }
  if (request.whenExpired === undefined) return right(edits);
  const name = whenExpiredName(request.whenExpired, options);
  if (!name.ok) return name;
  const link = JSON.stringify(`[[${name.value}]]`);
  edits.push({ kind: "set", key: "when-expired", text: `when-expired: ${link}\n` });
  return right(edits);
}

function inputEdits(frontmatter: string | undefined): Either<SaveRefusal, PropertyEdit[]> {
  if (frontmatter === undefined) return right([]);
  const parsed = parseFrontmatter(frontmatter);
  if (!parsed.ok) return invalid(`The frontmatter of the new text is wrong: ${parsed.error}.`);
  const edits: PropertyEdit[] = [];
  for (const block of splitYamlBlocks(frontmatter)) {
    if (block.key === undefined) {
      const line = block.text.trim();
      const isBlankOrComment = line === "" || line.startsWith("#");
      if (isBlankOrComment) continue;
      return invalid(`zambil cannot read this line of the frontmatter as a property: ${line}`);
    }
    if (expiryKeys.has(block.key)) {
      return invalid(`Set ${block.key} with its option, not in the frontmatter of the text.`);
    }
    edits.push({ kind: "set", key: block.key, text: block.text });
  }
  return right(edits);
}

function normalizeContent(content: string): string | undefined {
  const trimmed = content.replace(/^(?:[ \t]*\r?\n)+/, "").trimEnd();
  return trimmed === "" ? undefined : `${trimmed}\n`;
}

function writeChanges(request: WriteRequest, options: ChangeOptions): Either<SaveRefusal, Changes> {
  const split = splitFrontmatter(request.text);
  if (split.frontmatter === undefined && delimiterLine.test(split.content)) {
    return invalid("The frontmatter of the new text has no closing --- line.");
  }
  const input = inputEdits(split.frontmatter);
  if (!input.ok) return input;
  const expiry = expiryEdits(request, options);
  if (!expiry.ok) return expiry;
  const changes: Changes = { edits: [...input.value, ...expiry.value] };
  const content = normalizeContent(split.content);
  if (content !== undefined) changes.content = content;
  const isEmptyNote = content === undefined && options.target.oldText === undefined;
  return isEmptyNote ? invalid("The note has no text.") : right(changes);
}

function requestChanges(
  request: SaveRequest,
  options: ChangeOptions,
): Either<SaveRefusal, Changes> {
  switch (request.mode) {
    case "create":
    case "rewrite":
      return writeChanges(request, options);
    case "verify": {
      const expires = expiresEdit(request.expires, options);
      return expires.ok ? right({ edits: [expires.value] }) : expires;
    }
    default:
      return isNever(request);
  }
}

function readFrontmatter(yaml: string | undefined): Either<string, Record<string, unknown>> {
  return yaml === undefined ? right({}) : parseFrontmatter(yaml);
}

interface ExpectedOptions {
  edits: PropertyEdit[];
}

function expectedProperties(
  old: Record<string, unknown>,
  options: ExpectedOptions,
): Record<string, unknown> | undefined {
  const properties = { ...old };
  for (const edit of options.edits) {
    if (edit.kind === "remove") {
      delete properties[edit.key];
      continue;
    }
    const parsed = parseFrontmatter(edit.text);
    if (!parsed.ok) return undefined;
    properties[edit.key] = parsed.value[edit.key];
  }
  return properties;
}

interface ComposeOptions {
  changes: Changes;
}

function composeText(target: SaveTarget, options: ComposeOptions): Either<SaveRefusal, string> {
  const { path } = target.file;
  const old = splitFrontmatter(target.oldText ?? "");
  const oldProperties = readFrontmatter(old.frontmatter);
  if (!oldProperties.ok) {
    return invalid(
      `The frontmatter of ${path} does not parse, so zambil cannot keep its properties. Fix it by hand first.`,
    );
  }
  const { edits, content: newContent } = options.changes;
  const yaml = editFrontmatter(old.frontmatter ?? "", { edits });
  const written = readFrontmatter(yaml);
  const expected = expectedProperties(oldProperties.value, { edits });
  const keepsOthers = written.ok && isDeepStrictEqual(written.value, expected);
  if (!keepsOthers) {
    return invalid(
      `zambil cannot change the frontmatter of ${path} line by line without changing other properties. Edit it by hand.`,
    );
  }
  const content = newContent ?? old.content;
  const needsFrontmatter =
    yaml !== "" || old.frontmatter !== undefined || delimiterLine.test(content);
  if (!needsFrontmatter) return right(content);
  const separated = newContent === undefined ? content : `\n${content}`;
  return right(`---\n${yaml}---\n${separated}`);
}

interface ReviewOptions {
  repo: ConfigurationRepo;
  target: SaveTarget;
}

function takenSpelling(note: Note, options: ReviewOptions): string | undefined {
  const oldSpellings = new Set<string>();
  const oldNote = options.repo.notes.find((candidate) => candidate.path === note.path);
  for (const alias of oldNote?.aliases ?? []) oldSpellings.add(nameKey(alias));
  for (const spelling of [note.name, ...note.aliases]) {
    if (oldSpellings.has(nameKey(spelling))) continue;
    const entries = options.repo.names.get(nameKey(spelling)) ?? [];
    for (const entry of entries) {
      if (entry.note.path !== note.path) {
        return `The alias "${spelling}" in the text is already used by ${entry.note.path}. Pick another alias.`;
      }
    }
  }
  return undefined;
}

function problemsOf(text: string | undefined, file: NoteFile): string[] {
  if (text === undefined) return [];
  const parsed = parseNote(text, { file });
  return parsed.problems.map((problem) => `${problem.severity}: ${problem.message}`);
}

interface Reviewed {
  note: Note;
  warnings: string[];
}

function reviewNote(text: string, options: ReviewOptions): Either<SaveRefusal, Reviewed> {
  const { file } = options.target;
  const parsed = parseNote(text, { file });
  const known = new Set(problemsOf(options.target.oldText, file));
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const problem of parsed.problems) {
    if (known.has(`${problem.severity}: ${problem.message}`)) continue;
    if (problem.severity === "error") errors.push(problem.message);
    else warnings.push(problem.message);
  }
  if (errors.length > 0) {
    const listed = errors.join("; ");
    return invalid(`The note would be invalid: ${listed}.`);
  }
  const taken = takenSpelling(parsed.note, options);
  if (taken !== undefined) return invalid(taken);
  const added = addedRepoErrors(parsed.note, { repo: options.repo });
  if (added.length > 0) {
    const listed = added.join("; ");
    return invalid(`The repo would get an error: ${listed}.`);
  }
  return right({ note: parsed.note, warnings });
}

function findTarget(
  request: SaveRequest,
  options: SaveNoteOptions,
): Either<SaveRefusal, SaveTarget> {
  const { repo } = options;
  if (request.mode !== "create") return findExistingTarget(request.name, { repo });
  const folderOptions = request.folder === undefined ? { repo } : { repo, folder: request.folder };
  return findNewTarget(request.name, folderOptions);
}

/**
 * Saves one note on purpose: creates it, rewrites it, or records that its claims still hold with a new
 * `expires` date. Properties and content that the request does not name stay as they were. Nothing is
 * written when the request is refused. Call it only for an explicit request of the user, never from a
 * hook.
 */
export function saveNote(
  request: SaveRequest,
  options: SaveNoteOptions,
): Either<SaveRefusal, SavedNote> {
  const target = findTarget(request, options);
  if (!target.ok) return target;
  const changeOptions = { repo: options.repo, now: options.now, target: target.value };
  const changes = requestChanges(request, changeOptions);
  if (!changes.ok) return changes;
  const text = composeText(target.value, { changes: changes.value });
  if (!text.ok) return text;
  const reviewed = reviewNote(text.value, { repo: options.repo, target: target.value });
  if (!reviewed.ok) return reviewed;
  const { path } = target.value.file;
  const mode = request.mode === "create" ? "create" : "replace";
  const written = writeNoteFile(join(options.repo.root, path), { text: text.value, mode });
  if (!written.ok) {
    const reason = describeError(written.error);
    return invalid(`zambil cannot write ${path}: ${reason}`);
  }
  return right({ mode: request.mode, ...reviewed.value });
}
