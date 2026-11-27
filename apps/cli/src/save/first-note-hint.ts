import { quoteArgument } from "@zambil/core/quote-argument";

/** The repo as zambil read it, and the `--repo` flag as the user typed it, if any. */
export interface FirstNoteHintOptions {
  root: string;
  repoFlag: string | undefined;
}

/** What to print for a repo without notes: what a note is, and a command that saves the first one. */
export function firstNoteHint(options: FirstNoteHintOptions): string {
  const repo = options.repoFlag === undefined ? "" : ` --repo ${quoteArgument(options.repoFlag)}`;
  const text = "'---' 'description: How I like my code reviewed.' '---' 'Point out bugs first.'";
  return [
    `The repo ${options.root} has no notes yet. A note is a Markdown file in that folder.`,
    "To create the first one, write the file in your editor, or run:",
    `  printf '%s\\n' ${text} | zambil save code-review --no-expires${repo}`,
    "Then type z:code-review in a Claude Code prompt to add the note to it.",
  ].join("\n");
}
