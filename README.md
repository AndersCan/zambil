# zambil

zambil gives an AI agent the right notes at the right time. You keep the notes in a folder of Markdown files that you own. zambil adds the notes that apply to each Claude Code session. The same folder opens in Obsidian, so you can read and edit the notes there.

## Quick start

You need Node 24 or later with npm, git and Claude Code. The steps work on Linux and macOS.

1. Install zambil:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/AndersCan/zambil/main/install.sh | sh
   ```

   The first install downloads about 120 MB. The output ends with these lines:

   ```text
   zambil is ready. To set it up, run:

     zambil init
   ```

   If the output says that `~/.local/bin` is not on your `PATH`, add the line that it prints to the profile of your shell. Then open a new terminal.

2. Set up zambil:

   ```sh
   zambil init
   ```

   On the first run, `zambil init` makes the notes folder `~/zambil-notes` with one starter note. It connects the folder to Claude Code. It also downloads a model of 23 MB that finds similar notes. To keep the notes in another folder, run `zambil init <folder>` in place of `zambil init`. If you use Obsidian, read [Use an Obsidian vault that you have](#use-an-obsidian-vault-that-you-have) first. The output of zambil calls the notes folder the configuration repo. The output ends with a check and the next steps:

   ```text
   Checked 1 note: no problems.

   Next:
     1. Start a new Claude Code session. Its first reply says that the zambil-welcome note reached it.
   ```

3. Start a new Claude Code session in any project, and send a short prompt, for example `hello`. The first reply starts with this line:

   ```text
   > zambil works: the zambil-welcome note reached me. To stop this line, remove `hooks: [SessionStart]` from zambil-welcome.md in your notes folder, or delete the note.
   ```

   If the first prompt is a task, the agent can skip the line. A session that started before `zambil init` has no zambil hooks. If you do not see the line in a new session, run `zambil doctor`. See [When something is wrong](#when-something-is-wrong).

## Write your first note

A note is a Markdown file in the notes folder. The filename without `.md` is the name of the note.

To let the agent write a note, ask for it in a Claude Code prompt:

```text
Write a zambil note that we use pnpm, never npm.
```

The agent chooses a name, for example `use-pnpm`, and a description. It saves the note with `zambil save`. Claude Code asks you to allow the `zambil` commands. Allow them. Apart from the starter note, zambil never writes a note on its own. The agent writes a note only on your request. `zambil save` also adds the note to the search for similar notes. If the note names a hook that zambil does not connect yet, the agent tells you to run `zambil install`.

To write a note yourself, make a file in the notes folder, for example `~/zambil-notes/shell-style.md`:

```markdown
---
description: How to write shell commands in my projects.
---

Quote every path. Use `set -euo pipefail` in scripts.
```

A note reaches the agent in three ways:

- You type `z:<name>` in a prompt, for example `Fix the backup script the way z:shell-style says`.
- The note names a hook in its `hooks` property. A hook is a moment in a session where Claude Code runs a command. With `hooks: [SessionStart]`, the note reaches the agent at the start of each session, like the starter note, and each subagent that it starts.
- The description of the note is similar to your prompt.

After you add or change notes in your editor, run `zambil index`. It keeps the search for similar notes fast. If a note names a hook that no note named before, run `zambil install` too. Apart from `SessionStart`, `SubagentStart` and `UserPromptSubmit`, zambil connects only the hooks that your notes name. Then start a new Claude Code session.

`zambil list` lists your notes, and `zambil show <name>` prints a note as the agent gets it. [`docs/notes.md`](docs/notes.md) describes every property, expiry, skills, scripts, links and embeds.

## Use an Obsidian vault that you have

zambil reads the same properties, tags, links and embeds as Obsidian. It skips `.obsidian` and the other folders that start with `.`. You can connect a vault in two ways.

To keep the zambil notes in one folder of the vault, run:

```sh
zambil init ~/vault/zambil
```

Use the path of your vault in place of `~/vault`. zambil reads only the `zambil` folder, and writes the starter note there. Your other notes stay out of the sessions. In Obsidian, keep the vault open as before. The notes show in its `zambil` folder.

To use the whole vault, run `zambil init ~/vault`. zambil writes no starter note and changes no file in a folder that has files. So no line comes at the start of a session. To make sure that it works, type `z:<name>` with the name of one of your notes in a prompt. If the name has spaces, write it in brackets, for example `z:[[Meeting notes]]`. The agent then answers with what the note says. A note reaches the agent only in the three ways above. If a daily note has no `hooks` and no `description`, only `z:<name>` brings it to the agent.

zambil needs a unique name for each note in the whole folder. Obsidian allows the same name in two folders, but zambil reports it as an error:

```text
Daily/launch.md: error: the name "launch" is used by 2 notes: Daily/launch.md, Projects/launch.md
```

`zambil init` still connects the hooks, and it lists each error. Rename one of the two notes, and then run `zambil init ~/vault` again. [`docs/obsidian.md`](docs/obsidian.md) tells you how to find the notes for a hook in the search of Obsidian.

## When something is wrong

Run `zambil doctor`. It checks the whole setup and changes nothing. For each problem, it prints a `Fix:` line with the command that fixes it. For example, after you add `hooks: [PreToolUse]` to `shell-style.md`, it prints:

```text
fail  The zambil hooks in /home/ada/.claude/settings.json do not match what zambil install writes now.
      PreToolUse has no zambil hook, but the note shell-style.md names it.
      Fix: zambil install
```

Fix the problems from the top down, because a later problem can come from an earlier one. Then run `zambil doctor` again. When the setup is good, it says `Nothing to fix.`

Claude Code also shows a warning at the start of a session when the setup is broken. An example is a notes folder that you moved:

```text
SessionStart:startup says: zambil: The configuration repo /home/ada/zambil-notes does not exist. No note reaches this session. Run zambil doctor to see the fix.
```

If the zambil clone moved or is gone, your shell says that it cannot find `zambil`, and `zambil doctor` cannot start. Claude Code then shows this warning at each hook:

```text
SessionStart:startup says: zambil cannot start, so no note reaches this session. To install zambil again, run: curl -fsSL https://raw.githubusercontent.com/AndersCan/zambil/main/install.sh | sh
```

Run the install command of [Update zambil](#update-zambil). It changes no note and no file of Claude Code. If you moved the clone on purpose, set `ZAMBIL_HOME` as in [Move zambil](#move-zambil).

`zambil help` lists the commands, and `zambil <command> --help` explains one command.

## Update zambil

Run the install command again:

```sh
curl -fsSL https://raw.githubusercontent.com/AndersCan/zambil/main/install.sh | sh
```

It updates the clone of zambil in `~/.local/share/zambil` and installs the new dependencies. If you changed files in the clone, it stops and tells you how to keep your changes. If you moved zambil, set the same `ZAMBIL_HOME` as in [Move zambil](#move-zambil). After the update, run `zambil doctor`. If the new version writes other hooks, `zambil doctor` tells you to run `zambil install`.

The install command installs the newest release, a tag such as `v0.1.0`. Until the first release exists, it installs the newest commit of `main`. [`CHANGELOG.md`](CHANGELOG.md) lists what each release changed, and `zambil --version` prints the version that runs. To install one release, add its tag, for example `| ZAMBIL_GIT_REF=v0.1.0 sh`. A clone that follows `main` stays on `main`. If a release exists, the install command prints the command that moves the clone to releases.

## Move the notes folder

1. Move the folder, for example `mv ~/zambil-notes ~/notes`.
2. Run `zambil init ~/notes`. It saves the new path, and points the hooks at it. It writes no starter note, because the folder has files.
3. Start a new Claude Code session.

## Move zambil

The install command puts zambil in `~/.local/share/zambil`. To put zambil in another folder, set `ZAMBIL_HOME` for the install command:

```sh
curl -fsSL https://raw.githubusercontent.com/AndersCan/zambil/main/install.sh | ZAMBIL_HOME=~/apps/zambil sh
```

It installs zambil in the new folder and points `~/.local/bin/zambil` at it. The hooks run `~/.local/bin/zambil`, so they keep working. You do not need to run the `zambil init` that the output names. Then delete the old folder with `rm -rf ~/.local/share/zambil`. Set the same `ZAMBIL_HOME` each time that you update.

## Uninstall

To disconnect zambil from Claude Code, run:

```sh
zambil uninstall
```

It removes the zambil hooks from `~/.claude/settings.json` and the `zambil-save` skill from `~/.claude/skills/zambil-save`. The rest of the file, your own hooks too, stays as it is. If `zambil init` made `settings.json`, the file stays with `{}` in it. Start a new Claude Code session to stop the hooks.

`zambil uninstall` never changes your notes. It also leaves these files in place:

| What                                            | Where                                               | Size         |
| ----------------------------------------------- | --------------------------------------------------- | ------------ |
| zambil and its dependencies                     | `~/.local/share/zambil`                             | About 300 MB |
| The `zambil` command, a link                    | `~/.local/bin/zambil`                               | One link     |
| The path of the notes folder                    | `~/.config/zambil/config.json`                      | One file     |
| The model, the index and the hook list          | `~/.cache/zambil`                                   | About 23 MB  |
| The download caches of npm and pnpm, on Linux   | `~/.npm`, `~/.cache/pnpm` and `~/.local/share/pnpm` | About 330 MB |
| The files of ONNX Runtime, which runs the model | `~/.cache/Microsoft/DeveloperTools/.onnxruntime`    | About 40 KB  |

To remove zambil completely, run these commands after `zambil uninstall`. They keep your notes:

```sh
rm -rf ~/.local/share/zambil ~/.cache/zambil ~/.config/zambil
rm ~/.local/bin/zambil
```

Other programs share the download caches of npm and pnpm and the files of ONNX Runtime, so these commands keep them. The table gives the default paths. If you set `ZAMBIL_HOME`, `ZAMBIL_BIN_DIR`, `CLAUDE_CONFIG_DIR`, `XDG_DATA_HOME`, `XDG_CONFIG_HOME` or `XDG_CACHE_HOME`, the files are in those folders.

## Learn more

- [`docs/notes.md`](docs/notes.md) describes the note format: every property, expiry, skills, scripts, links and embeds.
- [`apps/cli/README.md`](apps/cli/README.md) describes every command and its exit codes.
- [`packages/claude-code/README.md`](packages/claude-code/README.md) describes what the hooks add, and what `zambil install` writes.
- [`docs/obsidian.md`](docs/obsidian.md) tells you how to search the notes in Obsidian.
- [`vision.md`](vision.md) describes the goals of zambil.

## Work on zambil

The repo is a pnpm workspace with four packages. `packages/core` reads the notes folder, `packages/embed` finds notes with a similar description, `packages/claude-code` connects zambil to Claude Code, and `apps/cli` is the `zambil` command.

Run `pnpm install` and then `pnpm test` in the root of the repo. Run `pnpm run ready` before you push. [`AGENTS.md`](AGENTS.md) tells you how to set up, test and change the repo.
