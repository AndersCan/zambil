import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
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
  const { cacheFolder } = await import("@zambil/embed/cache-folder");
  const { indexNotes } = await import("@zambil/embed/index-notes");
  const { openEmbedder } = await import("@zambil/embed/open-embedder");
  const { searchModel } = await import("@zambil/embed/search-model");
  const folder = cacheFolder(options.config.environment);
  const embedder = await openEmbedder(searchModel, {
    cacheFolder: folder,
    report: (message) => output.error(`${message}\n`),
  });
  if (!embedder.ok) {
    output.error(`zambil cannot load its model: ${embedder.error}\n`);
    return 1;
  }
  const summary = await indexNotes(repo.value, { embedder: embedder.value, cacheFolder: folder });
  if (!summary.ok) {
    output.error(`zambil cannot index the notes: ${summary.error}\n`);
    return 1;
  }
  const { descriptions, embedded, path } = summary.value;
  output.write(`Indexed ${descriptions} descriptions, ${embedded} of them new, in ${path}.\n`);
  return 0;
}

/** `zambil index`: embeds the note descriptions ahead of time, so that `zambil search` is fast. */
export const indexCommand: Command = {
  summary: "Embed the note descriptions ahead of time, so that search is fast.",
  details:
    "The index and the model are in $XDG_CACHE_HOME/zambil, or ~/.cache/zambil. The first run downloads the model, about 23 MB. zambil never changes a note.",
  usage: "Usage: zambil index [--repo <path>]",
  run: runIndex,
};
