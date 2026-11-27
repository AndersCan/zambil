import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { firstNoteHint } from "../save/first-note-hint.ts";
import { formatColumns } from "./format-columns.ts";
import { isExpired } from "@zambil/core/is-expired";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { quoteArgument } from "@zambil/core/quote-argument";
import { repoOptionHelp } from "../parse-command-args.ts";
import { sharedOptions } from "../parse-command-args.ts";

interface FormatListOptions {
  now: Date;
}

function formatList(repo: ConfigurationRepo, options: FormatListOptions): string {
  const rows = [["NAME", "KIND", "PATH", "DESCRIPTION"]];
  for (const note of repo.notes) {
    const description = (note.description ?? "").replaceAll(/\s*\n\s*/g, " ");
    const shown = isExpired(note, options) ? `(expired) ${description}` : description;
    rows.push([note.name, note.kind, note.path, shown]);
  }
  return formatColumns(rows);
}

function runList(options: CommandRunOptions): ExitCode {
  const { output } = options;
  const parsed = parseCommandArgs({ args: options.args, options: sharedOptions });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${listCommand.usage}\n`);
    return 2;
  }
  const repo = openRepo({ flag: parsed.value.values.repo, config: options.config });
  if (!repo.ok) {
    output.error(`${repo.error}\n`);
    return 2;
  }
  const repoFlag = parsed.value.values.repo;
  const isEmpty = repo.value.notes.length === 0 && repo.value.problems.length === 0;
  if (isEmpty) {
    output.write(`${firstNoteHint({ root: repo.value.root, repoFlag })}\n`);
    return 0;
  }
  output.write(`${formatList(repo.value, { now: options.now })}\n`);
  if (repo.value.problems.length > 0) {
    const check =
      repoFlag === undefined ? "zambil check" : `zambil check --repo ${quoteArgument(repoFlag)}`;
    output.error(`The repo has problems. Run \`${check}\` to see them.\n`);
  }
  return 0;
}

/** `zambil list`: one line per note, with its name, kind, path and description. */
export const listCommand: Command = {
  summary: "List every note with its kind, path and description.",
  usage: "Usage: zambil list [--repo <path>]",
  details: "An expired note says (expired) before its description.",
  options: [repoOptionHelp],
  run: runList,
};
