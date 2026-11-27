import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { countSearchTexts } from "./count-search-texts.ts";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { repoOptionHelp } from "../parse-command-args.ts";
import { sharedOptions } from "../parse-command-args.ts";

async function runIndex(options: CommandRunOptions): Promise<ExitCode> {
  const { output } = options;
  const parsed = parseCommandArgs({ args: options.args, options: sharedOptions });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${indexCommand.usage}\n`);
    return 2;
  }
  const repo = openRepo({ flag: parsed.value.values.repo, config: options.config });
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
  const summary = await noteSearch.value.index(repo.value, { removedTexts: "drop" });
  if (!summary.ok) {
    output.error(`zambil cannot index the notes: ${summary.error}. Then run zambil index again.\n`);
    return 1;
  }
  const { texts, embedded, path } = summary.value;
  const count = countSearchTexts(texts);
  output.write(`Indexed ${count}, ${embedded} of them new, in ${path}.\n`);
  return 0;
}

/** `zambil index`: embeds the note descriptions and triggers ahead of time, so that `zambil search` is fast. */
export const indexCommand: Command = {
  summary: "Embed the note descriptions and triggers ahead of time, so that search is fast.",
  details:
    "The index and the model are in $XDG_CACHE_HOME/zambil, or ~/.cache/zambil. The first run downloads the model, about 23 MB. zambil hook finds similar notes only after that run, because it never downloads the model. zambil never changes a note.",
  usage: "Usage: zambil index [--repo <path>]",
  options: [repoOptionHelp],
  run: runIndex,
};
