import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import type { ExpiryChoice, SavedNote, SaveRefusal, SaveRequest } from "@zambil/core/save-note";
import { left, right } from "@zambil/core/either";
import type { CliConfig } from "../config.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import { findDuplicateNotes } from "./find-duplicate-notes.ts";
import { findNote } from "@zambil/core/find-note";
import { findRecalls } from "@zambil/claude-code/find-recalls";
import { formatColumns } from "../list/format-columns.ts";
import { indexHint } from "../index/index-hint.ts";
import { installHint } from "./install-hint.ts";
import { isNever } from "@zambil/core/is-never";
import { loadRepo } from "@zambil/core/load-repo";
import { nameKey } from "@zambil/core/index-names";
import type { Note } from "@zambil/core/note";
import type { NoteFile } from "@zambil/core/note-file";
import type { NoteScore } from "@zambil/embed/score-notes";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { parseNote } from "@zambil/core/parse-note";
import { quoteArgument } from "@zambil/core/quote-argument";
import { repoOptionHelp } from "../parse-command-args.ts";
import { saveNote } from "@zambil/core/save-note";
import { sharedOptions } from "../parse-command-args.ts";
import { updateIndex } from "./update-index.ts";

const saveOptions = {
  ...sharedOptions,
  expires: { type: "string" },
  "no-expires": { type: "boolean" },
  "when-expired": { type: "string" },
  folder: { type: "string" },
  rewrite: { type: "boolean" },
  verified: { type: "boolean" },
  "allow-similar": { type: "boolean" },
} as const;

interface SaveFlags {
  expires?: string;
  "no-expires"?: boolean;
  "when-expired"?: string;
  folder?: string;
  rewrite?: boolean;
  verified?: boolean;
  "allow-similar"?: boolean;
}

/** The request without its text, which comes from standard input for a create or a rewrite. */
type PlannedSave =
  | {
      mode: "create" | "rewrite";
      name: string;
      expiry: ExpiryChoice;
      whenExpired?: string;
      folder?: string;
    }
  | { mode: "verify"; name: string; expires: string };

const expiryChoiceHint =
  "Choose an expiry: add --expires <date>, or add --no-expires for a note that makes no claims that go out of date.";

function expiryChoice(flags: SaveFlags): Either<string, ExpiryChoice> {
  const hasDate = flags.expires !== undefined;
  const hasNone = flags["no-expires"] === true;
  if (hasDate && hasNone) return left("Use --expires or --no-expires, not both.");
  if (hasNone && flags["when-expired"] !== undefined) {
    return left("--when-expired needs --expires. A note without expires has no when-expired note.");
  }
  if (flags.expires !== undefined) return right({ kind: "expires", text: flags.expires });
  return hasNone ? right({ kind: "none" }) : left(expiryChoiceHint);
}

function planVerify(name: string, flags: SaveFlags): Either<string, PlannedSave> {
  const hasOtherFlag =
    flags["no-expires"] === true ||
    flags["when-expired"] !== undefined ||
    flags.folder !== undefined ||
    flags["allow-similar"] === true;
  if (hasOtherFlag) {
    return left("--verified sets a new expires date only. Use --rewrite to change more.");
  }
  if (flags.rewrite === true) return left("Use --rewrite or --verified, not both.");
  if (flags.expires === undefined) {
    return left("--verified needs the new date: add --expires <date>.");
  }
  return right({ mode: "verify", name, expires: flags.expires });
}

interface PlanOptions {
  flags: SaveFlags;
}

function planSave(positionals: string[], options: PlanOptions): Either<string, PlannedSave> {
  const { flags } = options;
  const [name, ...extra] = positionals;
  if (name === undefined) return left("Give the name of the note.");
  if (extra.length > 0) return left("Give one name. Put the text of the note on standard input.");
  if (flags.verified === true) return planVerify(name, flags);
  const mode = flags.rewrite === true ? "rewrite" : "create";
  if (mode === "rewrite" && flags.folder !== undefined) {
    return left("--folder is only for a new note. zambil does not move notes.");
  }
  if (mode === "rewrite" && flags["allow-similar"] === true) {
    return left("--allow-similar is only for a new note.");
  }
  const expiry = expiryChoice(flags);
  if (!expiry.ok) return expiry;
  const planned: PlannedSave = { mode, name, expiry: expiry.value };
  if (flags["when-expired"] !== undefined) planned.whenExpired = flags["when-expired"];
  if (flags.folder !== undefined) planned.folder = flags.folder;
  return right(planned);
}

interface RequestOptions {
  input: CommandRunOptions["input"];
}

async function toRequest(
  planned: PlannedSave,
  options: RequestOptions,
): Promise<Either<string, SaveRequest>> {
  if (planned.mode === "verify") return right(planned);
  const text = await options.input.readAll();
  if (planned.mode === "create" && text.trim() === "") {
    return left("Give the text of the new note on standard input.");
  }
  return right({ ...planned, text });
}

interface RefusalOptions {
  request: SaveRequest;
}

function describeRefusal(refusal: SaveRefusal, options: RefusalOptions): string {
  const { request } = options;
  const lines = [`zambil did not save "${request.name}". ${refusal.message}`];
  switch (refusal.reason) {
    case "taken":
      if (request.mode === "create") lines.push("To change that note, add --rewrite.");
      break;
    case "missing":
      if (request.mode === "rewrite") lines.push("To create it, leave out --rewrite.");
      break;
    case "invalid":
      break;
    default:
      return isNever(refusal.reason);
  }
  return lines.join("\n");
}

function describeSaved(saved: SavedNote): string {
  const { path } = saved.note;
  switch (saved.mode) {
    case "create":
      return `Created ${path}.`;
    case "rewrite":
      return `Rewrote ${path}.`;
    case "verify": {
      const expires = String(saved.note.properties.expires);
      return `Verified ${path}. It now expires on ${expires}.`;
    }
    default:
      return isNever(saved.mode);
  }
}

/** The warning for a name that a plain `z:<name>` in a prompt does not recall, as the hook reads the prompt. */
function recallWarning(name: string): string | undefined {
  const [recall] = findRecalls(`z:${name}`);
  if (recall !== undefined && nameKey(recall.target) === nameKey(name)) return undefined;
  const result = recall === undefined ? "nothing" : `"${recall.target}"`;
  return `A plain z:${name} in a prompt recalls ${result}, not this note. Write z:[[${name}]] to recall it.`;
}

/** Warnings that `zambil check` does not give: a name that `z:<name>` cannot recall, and a missing description. */
function usabilityWarnings(saved: SavedNote): string[] {
  const { note } = saved;
  const warnings: string[] = [];
  const recalled = recallWarning(note.name);
  if (saved.mode === "create" && recalled !== undefined) warnings.push(recalled);
  if (saved.mode !== "verify" && note.description === undefined) {
    warnings.push(
      "The note has no description, so zambil search and the similar notes in a prompt never find it. Add `description: <one sentence>` to its frontmatter.",
    );
  }
  return warnings;
}

interface ReminderOptions {
  repoFlag: string | undefined;
}

function whenExpiredReminder(saved: SavedNote, options: ReminderOptions): string | undefined {
  const { note } = saved;
  const hasNoGuide = note.expiry.kind !== "never" && note.whenExpired === undefined;
  if (!hasNoGuide) return undefined;
  const repo = options.repoFlag === undefined ? "" : ` --repo ${quoteArgument(options.repoFlag)}`;
  const name = quoteArgument(note.name);
  const expires = quoteArgument(String(note.properties.expires));
  return [
    `Reminder: ${note.path} expires, but it has no when-expired note.`,
    "Save a note that tells how to update this note or verify its claims. Then link it:",
    `  zambil save ${name} --rewrite --expires ${expires} --when-expired <that note>${repo} < /dev/null`,
  ].join("\n");
}

/** The expiry option that a rewrite needs to keep the expiry of the note as it is. */
function keptExpiryFlag(note: Note): string {
  const { expiry } = note;
  switch (expiry.kind) {
    case "never":
      return "--no-expires";
    case "at":
    case "unreadable":
      return `--expires ${quoteArgument(String(note.properties.expires))}`;
    default:
      return isNever(expiry);
  }
}

interface SimilarMessageOptions {
  name: string;
  repoFlag: string | undefined;
}

function describeSimilar(similar: NoteScore[], options: SimilarMessageOptions): string {
  const rows = [["", "SCORE", "NAME", "PATH", "DESCRIPTION"]];
  for (const { note, score } of similar) {
    const description = (note.description ?? "").replaceAll(/\s*\n\s*/g, " ");
    rows.push(["", score.toFixed(2), note.name, note.path, description]);
  }
  const [best] = similar;
  const repo = options.repoFlag === undefined ? "" : ` --repo ${quoteArgument(options.repoFlag)}`;
  if (best === undefined) return "";
  const name = quoteArgument(best.note.name);
  const expiry = keptExpiryFlag(best.note);
  const subject = similar.length === 1 ? "A current note has" : "Current notes have";
  return [
    `zambil did not save "${options.name}". ${subject} a very similar description:`,
    formatColumns(rows),
    `If the new note says the same, put its text into ${name}, the best match, instead. This command keeps the expiry of that note:`,
    `  zambil save ${name} --rewrite ${expiry}${repo} < merged-text.md`,
    "If it is about something else, run the same save again with --allow-similar.",
  ].join("\n");
}

interface SimilarCheckOptions {
  repo: ConfigurationRepo;
  config: CliConfig;
  now: Date;
  flags: SaveFlags & { repo?: string };
}

/** Why a new note is not saved: a current note already has a very similar description. */
async function similarRefusal(
  request: SaveRequest,
  options: SimilarCheckOptions,
): Promise<string | undefined> {
  const { flags } = options;
  const isChecked = request.mode === "create" && flags["allow-similar"] !== true;
  if (!isChecked) return undefined;
  const isNameTaken = findNote(options.repo, { name: request.name }).kind !== "missing";
  if (isNameTaken) return undefined;
  const file: NoteFile = { name: request.name, path: `${request.name}.md`, kind: "note" };
  const { description } = parseNote(request.text, { file }).note;
  if (description === undefined) return undefined;
  const similar = await findDuplicateNotes(description, options);
  if (similar.length === 0) return undefined;
  return describeSimilar(similar, { name: request.name, repoFlag: flags.repo });
}

/** The repo folder, the startup config, and the `--repo` flag as the user typed it. */
interface FollowUpOptions {
  root: string;
  config: CliConfig;
  repoFlag: string | undefined;
}

/** What to print after a save: a failed index update, and a hook that needs install. Neither fails the save. */
async function followUps(saved: SavedNote, options: FollowUpOptions): Promise<string[]> {
  const repo = loadRepo(options.root);
  if (!repo.ok) return [];
  const [indexed, hint] = await Promise.all([
    updateIndex(repo.value, options),
    installHint(saved.note, { ...options, repo: repo.value }),
  ]);
  const lines: string[] = [];
  if (!indexed.ok) {
    const index = indexHint(options.repoFlag);
    lines.push(
      `${saved.note.path}: warning: zambil cannot add the note to the index for similar notes: ${indexed.error}. Run ${index}.`,
    );
  }
  if (hint !== undefined) lines.push(hint);
  return lines;
}

async function runSave(options: CommandRunOptions): Promise<ExitCode> {
  const { output } = options;
  const parsed = parseCommandArgs({
    args: options.args,
    options: saveOptions,
    allowPositionals: true,
  });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${saveCommand.usage}\n`);
    return 2;
  }
  const { values, positionals } = parsed.value;
  const planned = planSave(positionals, { flags: values });
  if (!planned.ok) {
    output.error(`${planned.error}\n${saveCommand.usage}\n`);
    return 2;
  }
  const repo = openRepo({ flag: values.repo, config: options.config });
  if (!repo.ok) {
    output.error(`${repo.error}\n`);
    return 2;
  }
  const request = await toRequest(planned.value, { input: options.input });
  if (!request.ok) {
    output.error(`${request.error}\n${saveCommand.usage}\n`);
    return 2;
  }
  const refusal = await similarRefusal(request.value, {
    repo: repo.value,
    config: options.config,
    now: options.now,
    flags: values,
  });
  if (refusal !== undefined) {
    output.error(`${refusal}\n`);
    return 1;
  }
  const saved = saveNote(request.value, { repo: repo.value, now: options.now });
  if (!saved.ok) {
    output.error(`${describeRefusal(saved.error, { request: request.value })}\n`);
    return 1;
  }
  output.write(`${describeSaved(saved.value)}\n`);
  const warnings = [...saved.value.warnings, ...usabilityWarnings(saved.value)];
  for (const warning of warnings) {
    output.error(`${saved.value.note.path}: warning: ${warning}\n`);
  }
  const reminder = whenExpiredReminder(saved.value, { repoFlag: values.repo });
  if (reminder !== undefined) output.error(`${reminder}\n`);
  const root = repo.value.root;
  const lines = await followUps(saved.value, {
    root,
    config: options.config,
    repoFlag: values.repo,
  });
  for (const line of lines) output.error(`${line}\n`);
  return 0;
}

/** `zambil save <name>`: the one way to write a note. It runs only when the user asks for a note, never from a hook. */
export const saveCommand: Command = {
  summary: "Create or rewrite a note, or record that its claims still hold.",
  usage:
    "Usage: zambil save <name> (--expires <date> | --no-expires) [--when-expired <name>] [--folder <path>] [--rewrite] [--allow-similar] [--repo <path>]\n       zambil save <name> --verified --expires <date> [--repo <path>]",
  details: [
    "The text of the note comes on standard input: Markdown, with optional frontmatter.",
    "Its properties are set on the note. The other properties of the note stay as they are.",
    "Give the note a description in its frontmatter, so that similarity search can find it.",
    "An agent runs `zambil save-guide` before it writes a note.",
  ].join("\n"),
  options: [
    {
      flag: "--expires <date>",
      text: "The note is current until this date, for example 2027-01-15.",
    },
    {
      flag: "--no-expires",
      text: "The note makes no claims that can go out of date. Removes expires and when-expired.",
    },
    {
      flag: "--when-expired <name>",
      text: "The note that tells how to update this note or verify its claims.",
    },
    {
      flag: "--folder <path>",
      text: "The folder for a new note, relative to the repo. The default is the root.",
    },
    {
      flag: "--rewrite",
      text: "Change an existing note. Text without content keeps the old content.",
    },
    {
      flag: "--allow-similar",
      text: "Save a new note, also when a current note has a very similar description. zambil checks this only when the search model is in the cache.",
    },
    {
      flag: "--verified",
      text: "The claims still hold: set a new --expires date and nothing else.",
    },
    repoOptionHelp,
  ],
  run: runSave,
};
