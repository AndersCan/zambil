# zambil

zambil gives an AI agent the right notes at the right time. You keep your notes, skills and scripts in your own folder of Markdown files, the configuration repo. zambil reads that folder and adds the notes that apply to the context of the agent. It works with Claude Code first.

A note reaches the agent in three ways:

1. At a Claude Code hook that the note names, for example at the start of each session. A hook is a moment in a session where Claude Code runs a command.
2. When you type `z:<name>` in a prompt, for example `Ship it the way z:deploy says`.
3. As a note with a description that is similar to a text. `zambil search <text>` lists these notes.

zambil never writes a note on its own. You write a note, or you ask the agent to write it. The configuration repo opens in Obsidian, so you can read and edit the notes there. `vision.md` describes the goals.

## Set up

You need Node 24 or later with npm, git and Claude Code. The steps work on Linux and macOS.

1. Install zambil:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/AndersCan/zambil/main/install.sh | sh
   ```

   The script clones zambil into `~/.local/share/zambil`, or into `$XDG_DATA_HOME/zambil` if you set that variable. It installs the dependencies that it needs to run. It links `zambil` into `~/.local/bin`. If that folder is not on your `PATH`, the script prints the line to add to the profile of your shell. To update zambil, run the same command again. The script stops and changes nothing if the clone has local changes. Set `ZAMBIL_HOME` or `ZAMBIL_BIN_DIR` to use other folders.

2. Run `zambil help` in another folder to make sure that `zambil` is on your `PATH`.

3. Make a configuration repo. This is a folder of notes that you own. To start with an example, copy the sample repo of the clone:

   ```sh
   cp -r ~/.local/share/zambil/packages/core/fixtures/sample-repo ~/notes
   ```

4. Tell zambil where the repo is. Write its path to the user configuration file:

   ```sh
   mkdir -p ~/.config/zambil && echo '{ "repo": "~/notes" }' > ~/.config/zambil/config.json
   ```

   Each command also takes `--repo <path>`, and the `ZAMBIL_REPO` environment variable works too.

5. Make sure that zambil reads the notes. `zambil check` must say `no problems`, or list the problems to fix:

   ```sh
   zambil check
   ```

6. Install the hooks in Claude Code:

   ```sh
   zambil install
   ```

7. Start a new Claude Code session. Claude Code reads the hooks at the start of a session. In the sample repo, the note `welcome` names the `SessionStart` hook, so the agent gets it at the start of each session.

### What `zambil install` does

- It adds a hook that runs `zambil hook` to `~/.claude/settings.json`. If you set `CLAUDE_CONFIG_DIR`, the file is `$CLAUDE_CONFIG_DIR/settings.json`. The hook runs at `UserPromptSubmit` and at each other hook that a note names. The rest of the file, your own hooks too, stays as it is.
- It writes the `zambil-save` skill to `skills/zambil-save/SKILL.md` in the same folder as `settings.json`. A skill is a set of instructions for the agent. Claude Code shows only its description in each session, and loads the rest on demand. When you ask the agent to write a note, the skill tells it to run `zambil save-guide` and `zambil save`.
- It reads the current list of Claude Code hooks from the [hooks reference](https://code.claude.com/docs/en/hooks), and keeps it in `~/.cache/zambil`.
- It indexes the descriptions of the notes for similar notes. The first run downloads the model, 23 MB, to `~/.cache/zambil`.

Each hook gets the full path of `zambil` and of the repo, so it works from every project folder. It also sets `NODE_COMPILE_CACHE`, which makes each run about twice as fast. `zambil install` never changes a note, and a second run leaves the file as it is.

Run `zambil install` again in these cases:

- A note names a hook that no note named before. zambil installs only the hooks that your notes name, because each hook starts a process on every event.
- You move the configuration repo. First write the new path to `~/.config/zambil/config.json`.
- You move the clone. First link `apps/cli/src/main.ts` of the moved clone to `~/.local/bin/zambil` again. The hooks then work again, because they run the link.

Without a network connection, run `zambil install --offline`. It skips the hook list and the model. Run `zambil index` later to download the model.

To remove everything that `zambil install` added, run `zambil uninstall`. It removes the zambil hooks and the `zambil-save` skill. It keeps your notes and the rest of the file.

## Use it

A note is a Markdown file with properties in its frontmatter. The filename is the name of the note, and names are unique in the whole repo. This note goes to the agent before each `Bash` tool call:

```markdown
---
description: How to write shell commands in my projects.
hooks: [PreToolUse]
tools: [Bash]
---

Quote every path. Use `set -euo pipefail` in scripts.
```

`docs/notes.md` describes every property, expiry, skills, scripts, links and embeds.

These commands help you work with the notes:

| Command                | What it does                                                    |
| ---------------------- | --------------------------------------------------------------- |
| `zambil list`          | Lists every note with its kind, path and description.           |
| `zambil check`         | Reports invalid notes and hook names that zambil never answers. |
| `zambil show <name>`   | Prints a note as the agent gets it.                             |
| `zambil search <text>` | Lists the notes with a description that is similar to the text. |
| `zambil index`         | Indexes the descriptions again, so that the search is fast.     |
| `zambil save <name>`   | Writes a note from standard input. The agent uses it.           |
| `zambil install`       | Installs the hooks and the skill in Claude Code.                |
| `zambil uninstall`     | Removes them.                                                   |

To write a note with the agent, ask for it in a prompt, for example `Write a note that we use pnpm, never npm`. The agent uses the `zambil-save` skill. It chooses a name, an expiry and a description, and saves the note with `zambil save`. It writes a note only on your request.

`zambil check` warns about a hook name that zambil never answers. An example is a hook that cannot add context, such as `Notification`. Another example is a name that is not a Claude Code hook, such as `sessionstart` in place of `SessionStart`.

`apps/cli/README.md` describes every command. `packages/claude-code/README.md` describes what the hooks add.

## Open the repo in Obsidian

Obsidian is a Markdown editor that works on a folder of notes, a vault. Open the configuration repo as a vault. zambil uses the same properties, tags, aliases, links and embeds as Obsidian. It skips the folders that start with `.`, such as `.obsidian` and `.trash`.

To find every note on a hook, search for the `hooks` property in the search of Obsidian:

| Search                   | Finds                                                            |
| ------------------------ | ---------------------------------------------------------------- |
| `[hooks:SessionStart]`   | Each note whose `hooks` holds `SessionStart`.                    |
| `[hooks:/^PreToolUse$/]` | Each note whose `hooks` holds exactly `PreToolUse`.              |
| `[hooks]`                | Each note that names a hook.                                     |
| `[tools:Bash]`           | Each note for the `Bash` tool.                                   |
| `tag:#ops`               | Each note with the tag `ops`, in the frontmatter or in the text. |

Obsidian ignores case in a search, and it also finds part of a name. So `[hooks:PostToolUse]` also finds `PostToolUseFailure`. The exact search with `/^PreToolUse$/` works only for a list, so write `hooks: [PreToolUse]`, not `hooks: PreToolUse`. Obsidian shows a list as a list property. It shows the short form as text.

`[[deploy]]` links to the note `deploy` in any folder. To link with an alias, write `[[deploy|ship]]`. zambil also reads `[[ship]]`, but Obsidian cannot follow that link. `z:ship` in a prompt works with the alias.

These results come from Obsidian 1.15.1 with the sample repo.

## Work on zambil

The repo has four packages. `packages/core` reads a configuration repo, `packages/embed` finds notes with a similar description, `packages/claude-code` connects zambil to Claude Code, and `apps/cli` is the `zambil` command. `docs/notes.md` is the contract for the note format.

Run `pnpm test` to run the tests, and `pnpm run ready` before you push. `AGENTS.md` tells you how to work in the repo.
