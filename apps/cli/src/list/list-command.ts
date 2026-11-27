import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { filterNotes } from "./filter-notes.ts";
import { firstNoteHint } from "../save/first-note-hint.ts";
import { formatColumns } from "./format-columns.ts";
import { isExpired } from "@zambil/core/is-expired";
import type { Note } from "@zambil/core/note";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { quoteArgument } from "@zambil/core/quote-argument";
import { repoOptionHelp } from "../parse-command-args.ts";
import { sharedOptions } from "../parse-command-args.ts";

/** The most notes that `zambil list` prints without `--all`, so that a large repo does not flood the context of an agent. */
export const listLimit = 100;

const listOptions = { ...sharedOptions, all: { type: "boolean" } } as const;

interface FormatListOptions {
  now: Date;
}

function formatList(notes: Note[], options: FormatListOptions): string {
  const rows = [["NAME", "KIND", "PATH", "DESCRIPTION"]];
  for (const note of notes) {
    const description = (note.description ?? "").replaceAll(/\s*\n\s*/g, " ");
    const shown = isExpired(note, options) ? `(expired) ${description}` : description;
    rows.push([note.name, note.kind, note.path, shown]);
  }
  return formatColumns(rows);
}

interface CommandLineOptions {
  repoFlag: string | undefined;
}

function commandLine(words: string, options: CommandLineOptions): string {
  const { repoFlag } = options;
  return repoFlag === undefined ? words : `${words} --repo ${quoteArgument(repoFlag)}`;
}

interface MoreNotesOptions {
  shown: number;
  text: string;
  repoFlag: string | undefined;
}

function moreNotesHint(total: number, options: MoreNotesOptions): string {
  if (options.text !== "") {
    return [
      `zambil listed ${options.shown} of the ${total} notes that have each word of "${options.text}".`,
      "To narrow the list, add a word. To list every match, add --all.",
    ].join("\n");
  }
  const filter = commandLine("zambil list <word>", options);
  const search = commandLine('zambil search "<what the note is about>"', options);
  return [
    `zambil listed ${options.shown} of ${total} notes. To find a note, run \`${filter}\` or \`${search}\`.`,
    "To list every note, add --all.",
  ].join("\n");
}

interface NoMatchOptions {
  text: string;
  repoFlag: string | undefined;
}

function noMatch(options: NoMatchOptions): string {
  const search = commandLine(`zambil search ${quoteArgument(options.text)}`, options);
  return [
    `No note has each word of "${options.text}" in its name, an alias or its description.`,
    `To find notes with a similar description, run \`${search}\`.`,
  ].join("\n");
}

function runList(options: CommandRunOptions): ExitCode {
  const { output } = options;
  const parsed = parseCommandArgs({
    args: options.args,
    options: listOptions,
    allowPositionals: true,
  });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${listCommand.usage}\n`);
    return 2;
  }
  const { values, positionals } = parsed.value;
  const repoFlag = values.repo;
  const repo = openRepo({ flag: repoFlag, config: options.config });
  if (!repo.ok) {
    output.error(`${repo.error}\n`);
    return 2;
  }
  const isEmpty = repo.value.notes.length === 0 && repo.value.problems.length === 0;
  if (isEmpty) {
    output.write(`${firstNoteHint({ root: repo.value.root, repoFlag })}\n`);
    return 0;
  }
  const text = positionals.join(" ").trim();
  const notes = filterNotes(repo.value.notes, { text });
  const shown = values.all === true ? notes : notes.slice(0, listLimit);
  const hasNoMatch = notes.length === 0 && text !== "";
  if (hasNoMatch) output.write(`${noMatch({ text, repoFlag })}\n`);
  if (shown.length > 0) output.write(`${formatList(shown, { now: options.now })}\n`);
  if (shown.length < notes.length) {
    output.error(`${moreNotesHint(notes.length, { shown: shown.length, text, repoFlag })}\n`);
  }
  if (repo.value.problems.length > 0) {
    const check = commandLine("zambil check", { repoFlag });
    output.error(`The repo has problems. Run \`${check}\` to see them.\n`);
  }
  return 0;
}

/** `zambil list [<text>]`: one line per note, with its name, kind, path and description. */
export const listCommand: Command = {
  summary: "List the notes with their kind, path and description.",
  usage: "Usage: zambil list [<text>] [--all] [--repo <path>]",
  details: [
    "With a text, it lists only the notes that have each of its words in the name, an alias or the description.",
    `It lists at most ${listLimit} notes, and says how many it left out. An expired note says (expired) before its description.`,
  ].join("\n"),
  options: [{ flag: "--all", text: `List every note, also past ${listLimit}.` }, repoOptionHelp],
  run: runList,
};
