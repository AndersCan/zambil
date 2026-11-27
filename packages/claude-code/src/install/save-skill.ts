import { quoteArgument } from "@zambil/core/quote-argument";

/** The folder name of the skill in the `skills` folder of Claude Code. */
export const saveSkillName = "zambil-save";

/** The configuration repo that the skill writes to, as a full path. */
export interface SaveSkillOptions {
  repoRoot: string;
}

/**
 * The `SKILL.md` that tells the agent how to write a note. Claude Code shows only the description in
 * each session and loads the rest when the agent uses the skill, so the guide costs little context.
 */
export function saveSkillText(options: SaveSkillOptions): string {
  const repo = quoteArgument(options.repoRoot);
  return [
    "---",
    `name: ${saveSkillName}`,
    "description: Write, rewrite or verify a note in the user's zambil notes. Use it when the user asks you to write, save, change or verify a note, or to keep something as a note.",
    "---",
    "",
    `The notes of the user are in the zambil configuration repo ${options.repoRoot}. zambil never writes a note on its own. Write a note only when the user asks for it.`,
    "",
    `1. Run \`zambil save-guide --repo ${repo}\` and follow it.`,
    `2. Run \`zambil list --repo ${repo}\` to see the names that are in use.`,
    `3. Save the note with \`zambil save <name> --repo ${repo}\` and the options that the guide gives.`,
    "",
    "Do not change the files of the repo with other tools. `zambil save` checks the names, the links and the expiry before it writes.",
    "",
  ].join("\n");
}
