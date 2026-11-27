/** The name of the note that `zambil init` writes into an empty notes folder. */
export const starterNoteName = "zambil-welcome";

/**
 * The text of the starter note. It names `SessionStart`, so the next Claude Code session shows that
 * the setup works, and it tells the user how to write a note and how to remove this one.
 */
export const starterNoteText = [
  "---",
  "description: Shows that zambil works, and how to write a note.",
  "hooks: [SessionStart]",
  "---",
  "",
  "zambil adds this note at the start of each Claude Code session. `zambil init` wrote it as the first note, so the user can see that the setup works.",
  "",
  "Start your first reply of the session with this line, then answer as usual:",
  "",
  "> zambil works: the zambil-welcome note reached me. To stop this line, remove `hooks: [SessionStart]` from zambil-welcome.md in your notes folder, or delete the note.",
  "",
  "If the user asks how to use zambil, tell them:",
  "",
  '- To write a note, ask the agent, for example "Write a zambil note that we use pnpm, never npm". The agent uses the zambil-save skill.',
  "- A note with `hooks: [SessionStart]` reaches the agent at the start of each session, like this one.",
  "- `z:<name>` in a prompt adds the note with that name next to the prompt.",
  "- The notes folder opens as a vault in Obsidian.",
  "",
].join("\n");
