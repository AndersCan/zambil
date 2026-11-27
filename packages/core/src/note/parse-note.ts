import type { Expiry, Note, PlainNote } from "./note.ts";
import type { NoteProblem, ProblemSeverity } from "./note-problem.ts";
import { findInlineTags } from "../properties/find-inline-tags.ts";
import { isScopePath } from "../scope/applies-in-place.ts";
import type { KnownProperties } from "../properties/read-properties.ts";
import type { NoteFile } from "./note-file.ts";
import { parseExpires } from "../expiry/parse-expires.ts";
import { parseFrontmatter } from "../properties/parse-frontmatter.ts";
import { posix } from "node:path";
import { readProperties } from "../properties/read-properties.ts";
import { splitFrontmatter } from "../properties/split-frontmatter.ts";

/** The file that the text came from. */
export interface ParseNoteOptions {
  file: NoteFile;
}

/** A note and the problems that its own file has. Problems across notes, such as duplicates, are not here. */
export interface ParsedNote {
  note: Note;
  problems: NoteProblem[];
}

interface Finding {
  severity: ProblemSeverity;
  message: string;
}

interface KindOptions {
  file: NoteFile;
  known: KnownProperties;
  findings: Finding[];
}

const unlinkableCharacters = /[[\]#^|]/;
const expiresLine = /(?:^|[{,])[ \t]*["']?expires["']?[ \t]*:(?<text>[^\n]*)$/m;

interface ExpiryOptions {
  frontmatter: string | undefined;
  properties: Record<string, unknown> | undefined;
  known: KnownProperties;
}

function expiryMessage(expiry: Expiry, options: ExpiryOptions): string | undefined {
  if (expiry.kind !== "unreadable") return undefined;
  if (options.properties === undefined) {
    return "the note has `expires`, but its frontmatter does not parse, so it counts as expired";
  }
  const forms = "write 2026-11-28 or 2026-11-28T09:30";
  return `\`expires\` is not a date: ${JSON.stringify(expiry.text)}; ${forms}. The note counts as expired`;
}

function readExpiry(options: ExpiryOptions): Expiry {
  const { properties, known } = options;
  if (properties === undefined) {
    const line = expiresLine.exec(options.frontmatter ?? "")?.groups?.text;
    return line === undefined ? { kind: "never" } : { kind: "unreadable", text: line.trim() };
  }
  const raw = properties.expires;
  const hasWrongShape = known.expires === undefined && raw !== undefined && raw !== null;
  if (hasWrongShape) return { kind: "unreadable", text: JSON.stringify(raw) };
  return parseExpires(known.expires);
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(tag);
  }
  return unique;
}

function scriptPath(options: KindOptions): string | undefined {
  const script = options.known.script ?? "";
  const resolved = posix.normalize(posix.join(posix.dirname(options.file.path), script));
  const isOutside = posix.isAbsolute(script) || resolved === ".." || resolved.startsWith("../");
  return isOutside ? undefined : resolved;
}

function skillFindings(plain: PlainNote, options: KindOptions): void {
  const { known, findings } = options;
  if (known.name !== undefined && known.name !== plain.name) {
    const message = `\`name\` is "${known.name}", but a skill takes its folder name: "${plain.name}"`;
    findings.push({ severity: "error", message });
  }
  if (known.script !== undefined) {
    findings.push({
      severity: "error",
      message: "a skill cannot have `script`; describe its scripts in SKILL.md",
    });
  }
  if (plain.description === undefined) {
    const message = "a skill needs a `description`, so that the agent knows when to load it";
    findings.push({ severity: "warning", message });
  }
}

function withKind(plain: PlainNote, options: KindOptions): Note {
  const { known, findings } = options;
  if (options.file.kind === "skill") {
    skillFindings(plain, options);
    return { ...plain, kind: "skill" };
  }
  if (known.script === undefined) {
    if (known.runWith !== undefined) {
      findings.push({ severity: "warning", message: "`run-with` has no effect without `script`" });
    }
    return plain;
  }
  const path = scriptPath(options);
  if (path === undefined) {
    const script = JSON.stringify(known.script);
    const message = `\`script\` is ${script}, but it must be a path inside the repo, relative to the folder of the note`;
    findings.push({ severity: "error", message });
    return plain;
  }
  const script = known.runWith === undefined ? { path } : { path, runWith: known.runWith };
  return { ...plain, kind: "script", script };
}

function propertyFindings(plain: PlainNote, options: KindOptions): void {
  const { known, findings } = options;
  if (known.whenExpired !== undefined && plain.expiry.kind === "never") {
    findings.push({
      severity: "warning",
      message: "`when-expired` has no effect without `expires`",
    });
  }
  for (const path of known.paths) {
    if (isScopePath(path)) continue;
    findings.push({
      severity: "warning",
      message: `\`paths\` holds "${path}", but each path must be a full path or start with ~/, so zambil ignores it`,
    });
  }
  for (const project of known.projects) {
    if (!project.includes("/")) continue;
    findings.push({
      severity: "warning",
      message: `\`projects\` holds "${project}", but a project is the name of a repo or a folder. Put a path in \`paths\``,
    });
  }
  for (const name of [plain.name, ...known.aliases]) {
    if (!unlinkableCharacters.test(name)) continue;
    findings.push({
      severity: "warning",
      message: `Obsidian cannot link to "${name}": it has #, ^, [, ] or |`,
    });
  }
}

/**
 * Reads one note file. The note always comes back, so that a broken note still has a name. Each
 * property with the wrong shape is left out and reported.
 */
export function parseNote(text: string, options: ParseNoteOptions): ParsedNote {
  const { file } = options;
  const findings: Finding[] = [];
  const split = splitFrontmatter(text);
  const parsed = split.frontmatter === undefined ? undefined : parseFrontmatter(split.frontmatter);
  if (parsed?.ok === false) findings.push({ severity: "error", message: parsed.error });
  const parsedProperties = parsed?.ok === false ? undefined : (parsed?.value ?? {});
  const properties = parsedProperties ?? {};
  const reading = readProperties(properties);
  for (const message of reading.problems) findings.push({ severity: "error", message });
  const known = reading.known;

  const plain: PlainNote = {
    kind: "note",
    name: file.name,
    path: file.path,
    aliases: known.aliases,
    tags: uniqueTags([...known.tags, ...findInlineTags(split.content)]),
    hooks: known.hooks,
    tools: known.tools,
    projects: known.projects,
    paths: known.paths,
    expiry: readExpiry({ frontmatter: split.frontmatter, properties: parsedProperties, known }),
    properties,
    content: split.content,
  };
  if (known.description !== undefined) plain.description = known.description;
  if (known.whenExpired !== undefined) plain.whenExpired = known.whenExpired;

  const expiryOptions = { frontmatter: split.frontmatter, properties: parsedProperties, known };
  const message = expiryMessage(plain.expiry, expiryOptions);
  if (message !== undefined) findings.push({ severity: "error", message });
  const kindOptions = { file, known, findings };
  propertyFindings(plain, kindOptions);
  const note = withKind(plain, kindOptions);
  const problems = findings.map((finding) => ({ ...finding, path: file.path }));
  return { note, problems };
}
