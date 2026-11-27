import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { matchLimit, minimumScore } from "@zambil/embed/search-model";
import { formatColumns } from "../list/format-columns.ts";
import type { NoteScore } from "@zambil/embed/score-notes";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { quoteArgument } from "@zambil/core/quote-argument";
import { sharedOptions } from "../parse-command-args.ts";

function formatMatches(matches: NoteScore[]): string {
  const rows = [["SCORE", "NAME", "PATH", "DESCRIPTION"]];
  for (const { note, score } of matches) {
    const description = (note.description ?? "").replaceAll(/\s*\n\s*/g, " ");
    rows.push([score.toFixed(2), note.name, note.path, description]);
  }
  return formatColumns(rows);
}

function indexHint(flag: string | undefined): string {
  return flag === undefined ? "zambil index" : `zambil index --repo ${quoteArgument(flag)}`;
}

async function runSearch(options: CommandRunOptions): Promise<ExitCode> {
  const { output } = options;
  const parsed = parseCommandArgs({
    args: options.args,
    options: sharedOptions,
    allowPositionals: true,
  });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${searchCommand.usage}\n`);
    return 2;
  }
  const text = parsed.value.positionals.join(" ").trim();
  if (text === "") {
    output.error(`zambil search needs a text to match.\n${searchCommand.usage}\n`);
    return 2;
  }
  const flag = parsed.value.values.repo;
  const repo = openRepo({ flag, config: options.config });
  if (!repo.ok) {
    output.error(`${repo.error}\n`);
    return 2;
  }
  const { openNoteSearch } = await import("@zambil/embed/open-note-search");
  const noteSearch = await openNoteSearch(options.config.environment, {
    report: (message) => output.error(`${message}\n`),
    download: "allow",
  });
  if (!noteSearch.ok) {
    output.error(`zambil cannot load its model: ${noteSearch.error}\n`);
    return 1;
  }
  const result = await noteSearch.value.search(repo.value, { text, now: options.now });
  if (!result.ok) {
    output.error(`zambil cannot search the notes: ${result.error}\n`);
    return 1;
  }
  const { matches, unindexed } = result.value;
  const noMatch = `No note scores ${minimumScore} or more.\n`;
  output.write(matches.length === 0 ? noMatch : `${formatMatches(matches)}\n`);
  if (unindexed > 0) {
    const hint = indexHint(flag);
    const count = unindexed === 1 ? "1 description is" : `${unindexed} descriptions are`;
    output.error(`${count} not in the index. Run \`${hint}\` to make search faster.\n`);
  }
  return 0;
}

/** `zambil search <text>`: the current notes whose description is similar to the text, best first. */
export const searchCommand: Command = {
  summary: "Find the notes whose description is similar to a text.",
  details: `It prints at most ${matchLimit} notes, best first, and leaves out expired notes. Only a score of ${minimumScore} or more, out of 1, is a match.`,
  usage: "Usage: zambil search <text> [--repo <path>]",
  run: runSearch,
};
