# Changelog

This file lists what each release of zambil changed, newest first. A release is a git tag of the form `vX.Y.Z` on `main`. The install command installs the newest release. [`docs/releases.md`](docs/releases.md) tells how to make a release.

## Unreleased

This is the first release. zambil adds the notes of your configuration repo to your Claude Code sessions.

- A note that names a hook, such as `SessionStart` or `PreToolUse`, reaches the agent at that hook.
- `z:<name>` in a prompt adds that note next to the prompt.
- The notes whose description is similar to the prompt reach the agent too. A local model finds them, and `zambil search` runs the same match.
- A note can expire. An expired note is never shown as current, and its `when-expired` note tells how to update it.
- `zambil save` writes a note for the agent and checks names, links and expiry. If a current note has a very similar description, it refuses the new note.
- `zambil list <text>` finds notes by name, alias or description, and prints at most 100 notes.
- `zambil init`, `zambil install`, `zambil doctor` and `zambil uninstall` set up, check and remove the Claude Code hooks and the `zambil-save` skill.
- The install command installs the newest release. `zambil --version` prints the version. If zambil is not at a release, it also prints the commit.
