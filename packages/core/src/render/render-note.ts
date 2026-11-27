import { describeLink, oneLineDescription } from "./describe-link.ts";
import type { ExpiredMode, TargetLookup } from "./find-target.ts";
import type { Note, ScriptNote } from "../note/note.ts";
import { removeBlockId, sectionKey } from "./select-section.ts";
import type { RenderWording, SkillOffer } from "./render-wording.ts";
import type { ConfigurationRepo } from "../repo/configuration-repo.ts";
import { expiredPhrase } from "./describe-expiry.ts";
import { findTarget } from "./find-target.ts";
import { findWikilinks } from "./find-wikilinks.ts";
import { formatMoment } from "./describe-expiry.ts";
import { isFile } from "../repo/is-file.ts";
import { isNever } from "../is-never.ts";
import { join } from "node:path";
import type { MarkdownLine } from "./scan-lines.ts";
import { nameKey } from "../repo/index-names.ts";
import { parseWikilinkTarget } from "./parse-wikilink-target.ts";
import { quoteArgument } from "../quote-argument.ts";
import type { RenderContext } from "./describe-link.ts";
import type { Wikilink } from "./find-wikilinks.ts";
import type { WikilinkTarget } from "./parse-wikilink-target.ts";

/** What to show, the clock, the wording of the agent tool, and whether to read an expired note anyway. */
export interface RenderNoteOptions {
  target: string;
  now: Date;
  wording: RenderWording;
  expired?: ExpiredMode;
}

/** `shown`: the content is in the text. `expired`: a warning stands in its place. `unresolved`: no such note or part. */
export type RenderStatus = "shown" | "expired" | "unresolved";

/** The text for the agent, and what it holds. */
export interface RenderedNote {
  status: RenderStatus;
  text: string;
}

interface TrailEntry {
  key: string;
  label: string;
}

interface EmbedContext extends RenderContext {
  trail: TrailEntry[];
}

interface BlockOptions {
  target: WikilinkTarget;
  context: EmbedContext;
}

const updateSentence =
  "You can offer the user an update. Save a change, or a new `expires` date, only when the user asks for it.";

interface CannotShowOptions {
  reason: string;
}

function cannotShow(subject: string, options: CannotShowOptions): string {
  return `Warning: zambil cannot show ${subject}, because ${options.reason}.`;
}

function openTag(note: Note, options: BlockOptions): string {
  const attributes = [`name=${JSON.stringify(note.name)}`, `path=${JSON.stringify(note.path)}`];
  const { subpath } = options.target;
  if (subpath.kind !== "whole") attributes.push(`section=${JSON.stringify(subpath.text)}`);
  const joined = attributes.join(" ");
  return `<${note.kind} ${joined}>`;
}

interface WrapOptions extends BlockOptions {
  parts: string[];
}

function wrap(note: Note, options: WrapOptions): string {
  const body: string[] = [];
  for (const part of options.parts) {
    if (part !== "") body.push(part);
  }
  const text = body.join("\n\n");
  return `${openTag(note, options)}\n${text}\n</${note.kind}>`;
}

interface LeadOptions extends BlockOptions {
  lead: string;
}

function whenExpiredSentence(note: Note, options: LeadOptions): string {
  if (note.whenExpired === undefined) return "";
  const target = parseWikilinkTarget(note.whenExpired);
  const link = describeLink(target, { context: options.context });
  return `${options.lead} ${link}`;
}

function descriptionLine(note: Note): string {
  return note.description === undefined ? "" : `Description: ${oneLineDescription(note)}`;
}

function expiredBlock(note: Note, options: BlockOptions): string {
  const readAnyway = options.context.wording.openExpired(options.target.text);
  const head = [
    descriptionLine(note),
    `Warning: this note ${expiredPhrase(note)}, so its content can be out of date. It is not shown here.`,
    whenExpiredSentence(note, { ...options, lead: "To update or verify it, read" }),
    `You can skip this note. ${readAnyway}`,
    updateSentence,
  ];
  return wrap(note, { ...options, parts: [joinLines(head)] });
}

function joinLines(lines: string[]): string {
  const kept: string[] = [];
  for (const line of lines) {
    if (line !== "") kept.push(line);
  }
  return kept.join("\n");
}

function verifySentence(note: Note, options: BlockOptions): string {
  const lead =
    note.expiry.kind === "at"
      ? `This note is current until ${formatMoment(note.expiry.time)}, but it can be wrong before that date. To verify its claims, read`
      : "This note can be wrong. To verify its claims, read";
  return whenExpiredSentence(note, { ...options, lead });
}

function readAnywayLines(note: Note, options: BlockOptions): string[] {
  return [
    `Warning: this note ${expiredPhrase(note)}, so its content can be out of date. It is shown because you chose to read it anyway.`,
    whenExpiredSentence(note, { ...options, lead: "To update or verify it, read" }),
    updateSentence,
  ];
}

function scriptSentence(note: ScriptNote, options: BlockOptions): string {
  const path = join(options.context.repo.root, note.script.path);
  if (!isFile(path)) return `Warning: no file is at ${path}, so the script cannot run.`;
  const quoted = quoteArgument(path);
  const command = note.script.runWith === undefined ? quoted : `${note.script.runWith} ${quoted}`;
  return `The script is ${path}. Run it with \`${command}\`.`;
}

function skillOffer(note: Note, options: BlockOptions): SkillOffer {
  return { name: note.name, path: join(options.context.repo.root, note.path) };
}

function offerLine(note: Note, options: BlockOptions): string {
  switch (note.kind) {
    case "note":
      return "";
    case "skill":
      return options.context.wording.loadSkill(skillOffer(note, options));
    case "script":
      return scriptSentence(note, options);
    default:
      return isNever(note);
  }
}

interface EmbedOptions {
  note: Note;
  context: EmbedContext;
}

interface InNoteOptions {
  note: Note;
}

/** A target with an empty name, such as `#Steps`, points to the note that holds it. */
function inNote(target: WikilinkTarget, options: InNoteOptions): WikilinkTarget {
  if (target.name !== "") return target;
  const { name } = options.note;
  return { ...target, name, text: `${name}${target.text}` };
}

function renderEmbed(link: Wikilink, options: EmbedOptions): string {
  const { note, context } = options;
  const target = inNote(link.target, { note });
  const lookup = findTarget(target, { repo: context.repo, now: context.now, expired: "warn" });
  return renderLookup(lookup, { target, context, subject: link.raw });
}

interface ContentOptions {
  lines: MarkdownLine[];
  context: EmbedContext;
}

interface RenderedContent {
  text: string;
  links: WikilinkTarget[];
}

function renderContent(note: Note, options: ContentOptions): RenderedContent {
  const output: string[] = [];
  const links = new Map<string, WikilinkTarget>();
  for (const line of options.lines) {
    if (line.kind === "code") {
      output.push(line.text);
      continue;
    }
    const source = removeBlockId(line.text);
    let text = "";
    let cursor = 0;
    for (const link of findWikilinks(source)) {
      text += source.slice(cursor, link.start);
      cursor = link.end;
      if (link.kind === "embed") {
        const rest = source.slice(link.end);
        const before = text.trim() === "" ? "" : "\n";
        const after = rest.trim() === "" ? "" : "\n";
        const embedded = renderEmbed(link, { note, context: options.context });
        const lead = text.trimEnd();
        text = `${lead}${before}${embedded}${after}`;
        cursor += rest.length - rest.trimStart().length;
        continue;
      }
      text += link.raw;
      const target = inNote(link.target, { note });
      const key = nameKey(target.text);
      if (!links.has(key)) links.set(key, target);
    }
    output.push(text + source.slice(cursor));
  }
  const text = output
    .join("\n")
    .replace(/^(?:[ \t]*\n)+/, "")
    .trimEnd();
  return { text, links: [...links.values()] };
}

function linksSection(links: WikilinkTarget[], options: BlockOptions): string {
  if (links.length === 0) return "";
  const lines = ["Links:"];
  for (const target of links) lines.push(`- ${describeLink(target, { context: options.context })}`);
  return lines.join("\n");
}

interface ShownOptions extends BlockOptions {
  lookup: Extract<TargetLookup, { kind: "found" }>;
}

function shownBlock(note: Note, options: ShownOptions): string {
  const { lookup } = options;
  const entry = { key: trailKey(note, options), label: trailLabel(note, options) };
  const context = { ...options.context, trail: [...options.context.trail, entry] };
  const inner = { ...options, context };
  const head = [descriptionLine(note)];
  if (lookup.expiry === "expired") head.push(...readAnywayLines(note, inner));
  else head.push(verifySentence(note, inner));
  head.push(offerLine(note, inner));
  if (note.kind === "skill") return wrap(note, { ...inner, parts: [joinLines(head)] });
  const content = renderContent(note, { lines: lookup.lines, context });
  const links = linksSection(content.links, inner);
  return wrap(note, { ...inner, parts: [joinLines(head), content.text, links] });
}

function trailKey(note: Note, options: BlockOptions): string {
  const { subpath } = options.target;
  return `${nameKey(note.name)}${sectionKey(subpath)}`;
}

function trailLabel(note: Note, options: BlockOptions): string {
  const { subpath } = options.target;
  return subpath.kind === "whole" ? note.name : `${note.name}${subpath.text}`;
}

interface LookupOptions extends BlockOptions {
  subject: string;
}

function renderLookup(lookup: TargetLookup, options: LookupOptions): string {
  switch (lookup.kind) {
    case "unresolved":
      return cannotShow(options.subject, { reason: lookup.reason });
    case "expired":
      return expiredBlock(lookup.note, options);
    case "found": {
      const key = trailKey(lookup.note, options);
      const isCycle = options.context.trail.some((entry) => entry.key === key);
      if (!isCycle) return shownBlock(lookup.note, { ...options, lookup });
      const labels = options.context.trail.map((entry) => entry.label);
      const path = [...labels, trailLabel(lookup.note, options)].join(" > ");
      return cannotShow(options.subject, { reason: `it embeds itself: ${path}` });
    }
    default:
      return isNever(lookup);
  }
}

/**
 * Turns a link target, such as `deploy`, `deploy#Steps` or `deploy#^intro`, into the text an agent
 * gets. Embeds are filled in, links bring in only a name and a description, and an expired note gets a
 * warning in place of its content unless `expired` is `show`. Skills and scripts are offers.
 */
export function renderNote(
  repo: Pick<ConfigurationRepo, "root" | "names">,
  options: RenderNoteOptions,
): RenderedNote {
  const target = parseWikilinkTarget(options.target);
  const context = { repo, now: options.now, wording: options.wording, trail: [] };
  const expired = options.expired ?? "warn";
  const lookup = findTarget(target, { repo, now: options.now, expired });
  const subject = JSON.stringify(target.text);
  const text = renderLookup(lookup, { target, context, subject });
  switch (lookup.kind) {
    case "found":
      return { status: "shown", text };
    case "expired":
      return { status: "expired", text };
    case "unresolved":
      return { status: "unresolved", text };
    default:
      return isNever(lookup);
  }
}
