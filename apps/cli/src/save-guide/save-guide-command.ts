import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { parseCommandArgs } from "../parse-command-args.ts";
import { sharedOptions } from "../parse-command-args.ts";

const guide = `Before you write a zambil note

Write a note only when the user asks for it. zambil never writes a note on its own, and a hook or a background job never writes one. This is also true for an update or a new expires date of an expired note: ask the user first.

You write the first version of a note. When the user asks for changes, rewrite it. The user fine-tunes the text by hand in Obsidian, so change only what the user asked you to change.

A note that makes claims goes out of date. The code changes, and then the note is false and confuses the next agent. So:

1. Give the note an expires date: the date when its claims are likely to change.
2. Give it a when-expired note that tells how to update the note or verify its claims, for example the files and commands to read. Save the when-expired note first, because it must exist.
3. Use --no-expires only for a note that makes no claims that go out of date, such as a preference of the user.

Give each note a description in its frontmatter. Similarity search matches the prompt against it.

Before you save a new note, look for a note that covers it already. Search by meaning, and list by a word of the name or the description:

  zambil search "<what the note is about>"
  zambil list <word>

If a note covers it, change that note with --rewrite. Do not save a second note. zambil save also refuses a new note when a current note has a very similar description. If the new note is about something else, add --allow-similar.

Then save the when-expired note and the note:

  zambil save check-deploy --no-expires <<'EOF'
  ---
  description: How to check the deploy note.
  ---
  Read the Makefile and compare the deploy target with the deploy note.
  EOF

  zambil save deploy --expires 2027-01-15 --when-expired check-deploy <<'EOF'
  ---
  description: How to deploy the web app.
  ---
  Run \`make deploy\` from the root of the repo.
  EOF

  zambil save deploy --rewrite --expires 2027-01-15 < new-text.md
  zambil save deploy --verified --expires 2027-03-01

--rewrite keeps the properties that the new text does not set. --verified records that the claims still hold: give it a new expires date: the date when its claims are likely to change next. It keeps the content.
`;

function runSaveGuide(options: CommandRunOptions): ExitCode {
  const parsed = parseCommandArgs({ args: options.args, options: sharedOptions });
  if (!parsed.ok) {
    options.output.error(`${parsed.error}\n${saveGuideCommand.usage}\n`);
    return 2;
  }
  options.output.write(guide);
  return 0;
}

/** `zambil save-guide`: what an agent must know before it writes a note. */
export const saveGuideCommand: Command = {
  summary: "Print what an agent must know before it writes a note.",
  usage: "Usage: zambil save-guide [--repo <path>]",
  details: "The zambil-save skill tells the agent to run it.",
  audience: "agent",
  options: [
    {
      flag: "--repo <path>",
      text: "Accepted, so that the zambil-save skill can pass it. The guide is the same for every repo.",
    },
  ],
  run: runSaveGuide,
};
