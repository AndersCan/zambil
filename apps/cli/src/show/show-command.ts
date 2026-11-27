import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { openRepo } from "../open-repo.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { renderNote } from "@zambil/core/render-note";
import { sharedOptions } from "../parse-command-args.ts";
import { showWording } from "./show-wording.ts";

const showOptions = { ...sharedOptions, expired: { type: "boolean" } } as const;

function runShow(options: CommandRunOptions): ExitCode {
  const { output } = options;
  const parsed = parseCommandArgs({
    args: options.args,
    options: showOptions,
    allowPositionals: true,
  });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${showCommand.usage}\n`);
    return 2;
  }
  const { values, positionals } = parsed.value;
  const [target] = positionals;
  if (target === undefined || positionals.length > 1) {
    output.error(`Name one note.\n${showCommand.usage}\n`);
    return 2;
  }
  const repo = openRepo({ flag: values.repo, config: options.config });
  if (!repo.ok) {
    output.error(`${repo.error}\n`);
    return 2;
  }
  const wording = showWording({ repo: values.repo === undefined ? undefined : repo.value.root });
  const expired = values.expired === true ? "show" : "warn";
  const rendered = renderNote(repo.value, { target, now: options.now, wording, expired });
  output.write(`${rendered.text}\n`);
  return rendered.status === "unresolved" ? 1 : 0;
}

/** `zambil show <name>`: the text that an agent gets for a note, with its embeds and links filled in. */
export const showCommand: Command = {
  summary: "Print a note as the agent gets it, with embeds, links and expiry warnings.",
  usage: "Usage: zambil show <name>[#heading|#^block] [--expired] [--repo <path>]",
  details: [
    "An expired note prints a warning in place of its content. --expired prints the content anyway.",
    "A name that no note has or that more than one note has, or a missing heading or block, sets the exit code to 1.",
  ].join("\n"),
  run: runShow,
};
