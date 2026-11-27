# Changelog

This file lists what each release of zambil changed, newest first. A release is a git tag of the form `vX.Y.Z` on `main`. The install command installs the newest release. [`docs/releases.md`](docs/releases.md) tells how to make a release.

## Unreleased

This is the first release. zambil adds the notes of your configuration repo to your Claude Code sessions.

- A note that names a hook, such as `SessionStart` or `PreToolUse`, reaches the agent at that hook.
- `z:<name>` in a prompt adds that note next to the prompt.
- The notes whose description is similar to the prompt reach the agent too. A local model finds them, and `zambil search` runs the same match.
- A note can expire. An expired note is never shown as current, and its `when-expired` note tells how to update it.
- `zambil save` writes a note for the agent and checks names, links and expiry. If a current note has a very similar description, it refuses the new note.
- A note comes once in a session or subagent, not again at each prompt and tool call. `z:<name>` and a note at `Stop` come each time.
- A subagent gets the `SessionStart` notes, and `zambil install` always connects `SubagentStart`.
- The `projects` and `paths` properties limit a note to some projects or folders.
- A `when-expired` note that names no hook is no longer a similar note.
- A note can list `triggers`: prompts that the note is for. Similarity search matches each trigger as well as the description.
- At `PreToolUse`, `PostToolUse` and `PostToolUseFailure`, the zambil hook runs only for the tools that the notes name, when each note there has `tools`.
- `zambil list <text>` finds notes by name, alias or description, and prints at most 100 notes.
- `zambil init`, `zambil install`, `zambil doctor` and `zambil uninstall` set up, check and remove the Claude Code hooks and the `zambil-save` skill.
- `zambil update` updates zambil, prints what changed, and runs `zambil doctor`.
- The install command installs the newest release. `zambil --version` prints the version. If zambil is not at a release, it also prints the commit.
