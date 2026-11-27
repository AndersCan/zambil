import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import type { ExpiryChoice, SavedNote, SaveRefusal, SaveRequest } from "@zambil/core/save-note";
import { left, right } from "@zambil/core/either";
import type { Either } from "@zambil/core/either";
import { isNever } from "@zambil/core/is-never";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { quoteArgument } from "@zambil/core/quote-argument";
import { repoOptionHelp } from "../parse-command-args.ts";
import { saveNote } from "@zambil/core/save-note";
import { sharedOptions } from "../parse-command-args.ts";

const saveOptions = {
  ...sharedOptions,
  expires: { type: "string" },
  "no-expires": { type: "boolean" },
  "when-expired": { type: "string" },
  folder: { type: "string" },
  rewrite: { type: "boolean" },
  verified: { type: "boolean" },
} as const;

interface SaveFlags {
  expires?: string;
  "no-expires"?: boolean;
  "when-expired"?: string;
  folder?: string;
  rewrite?: boolean;
  verified?: boolean;
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
    flags.folder !== undefined;
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

/** A plain `z:<name>` ends at a space, a comma or a backtick, so such a name needs `z:[[<name>]]`. */
const endsPlainRecall = /[\s,`]/u;

/** Warnings that `zambil check` does not give: a name that `z:<name>` cannot recall, and a missing description. */
function usabilityWarnings(saved: SavedNote): string[] {
  const { note } = saved;
  const warnings: string[] = [];
  const isNew = saved.mode === "create";
  if (isNew && endsPlainRecall.test(note.name)) {
    warnings.push(
      `In a prompt, write z:[[${note.name}]] to recall this note. A plain z:<name> ends at a space, a comma or a backtick.`,
    );
  }
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
  return 0;
}

/** `zambil save <name>`: the one way to write a note. It runs only when the user asks for a note, never from a hook. */
export const saveCommand: Command = {
  summary: "Create or rewrite a note, or record that its claims still hold.",
  usage:
    "Usage: zambil save <name> (--expires <date> | --no-expires) [--when-expired <name>] [--folder <path>] [--rewrite] [--repo <path>]\n       zambil save <name> --verified --expires <date> [--repo <path>]",
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
      flag: "--verified",
      text: "The claims still hold: set a new --expires date and nothing else.",
    },
    repoOptionHelp,
  ],
  run: runSave,
};
