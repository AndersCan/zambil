# @zambil/cli

The `zambil` command. It reads your configuration repo with `@zambil/core`. `docs/notes.md` in the root of the repo describes the note format.

## Run it

Node 24 runs the TypeScript directly, so the CLI has no build step. Run these commands from the root of the repo, after `pnpm install`:

```sh
node apps/cli/src/main.ts list --repo packages/core/fixtures/sample-repo
node apps/cli/src/main.ts check --repo packages/core/fixtures/sample-repo
node apps/cli/src/main.ts show welcome --repo packages/core/fixtures/sample-repo
node apps/cli/src/main.ts index --repo packages/embed/fixtures/prose-repo
node apps/cli/src/main.ts search "my branch is behind main" --repo packages/embed/fixtures/prose-repo
```

To put `zambil` on your `PATH`, link `apps/cli/src/main.ts` into a folder on your `PATH`. Run this command from the root of the repo:

```sh
mkdir -p ~/.local/bin && ln -sf "$PWD/apps/cli/src/main.ts" ~/.local/bin/zambil
```

Then `zambil list` works in every folder. If it does not, add `~/.local/bin` to your `PATH`. The root `README.md` describes the full setup with Claude Code.

The commands are:

- `zambil hook` is the command that a Claude Code hook runs. It reads the hook JSON on standard input and prints the notes that apply. At `UserPromptSubmit`, these include the notes that are similar to the prompt, after `zambil index` or `zambil install` downloaded the model. It always exits with 0. Run `zambil install` to set up the hooks. `packages/claude-code/README.md` describes them.
- `zambil list` prints one line per note: the name, the kind, the path and the description.
- `zambil check` prints each problem with its path. It also warns about a hook name that zambil never answers. An error sets the exit code to 1.
- `zambil doctor` checks the whole setup and changes nothing. It checks Node, `zambil` on the `PATH`, the user configuration file, the notes folder, the problems that `zambil check` finds, the Claude Code hooks, the `zambil-save` skill, and the model and the index for similar notes. It compares the hooks and the skill with what `zambil install` writes now. For each problem, it prints the command that fixes it.
- `zambil save <name>` creates or rewrites a note from standard input, or records with `--verified` that its claims still hold. It is the one way to write a note. See "Write a note" in `docs/notes.md`.
- `zambil save-guide` prints what an agent must know before it writes a note.
- `zambil show <name>` prints a note as the agent gets it, with its embeds, links and expiry warnings. `--expired` prints an expired note anyway. `docs/notes.md` describes the text in [Rendering](../../docs/notes.md#rendering).
- `zambil init [folder]` sets up zambil in one run. It uses the folder, or the repo that zambil already knows, or `~/zambil-notes`. In a new folder, or a folder with only hidden entries such as `.obsidian`, it writes the starter note `zambil-welcome.md`, which names `SessionStart`. A folder with files stays as it is. Then it saves the folder in the user configuration file, does what `zambil install` does, and checks the notes. It never asks a question, and a second run changes nothing.
- `zambil install` adds the zambil hooks and the `zambil-save` skill to Claude Code, and keeps the rest of `settings.json`. It also refreshes the hook list from the Claude Code docs and indexes the notes. `--offline` skips these two steps. With `--repo`, it also saves the repo in the user configuration file. It prints the problems that `zambil check` finds. It never changes a note, and a second run changes nothing. `packages/claude-code/README.md` describes what it writes.
- `zambil index` embeds the description of each note ahead of time, so that search is fast. The first run downloads the model, about 23 MB, to `$XDG_CACHE_HOME/zambil`, or `~/.cache/zambil`. It never changes a note.
- `zambil search <text>` prints at most 3 notes whose description is similar to the text, best first, with a score. It leaves out expired notes. `packages/embed/README.md` says how the model and the score threshold were chosen.
- `zambil uninstall` removes the zambil hooks and the `zambil-save` skill from Claude Code, and nothing else.
- `zambil help` prints the commands. `zambil help <command>` or `zambil <command> --help` prints the usage and the options of one command. `zambil --version` prints the version.

Each command takes `--repo <path>`. Without it, zambil reads `ZAMBIL_REPO`, then `$XDG_CONFIG_HOME/zambil/config.json`. If `XDG_CONFIG_HOME` is not set, the file is `~/.config/zambil/config.json`.

The exit codes are:

- 0: the command worked.
- 1: the command ran and found a problem. `zambil check` found an error, `zambil doctor` found something to fix, or `zambil save` refused to save the note. `zambil show` cannot resolve the name, the heading or the block. `zambil index` or `zambil search` cannot get the model. `zambil install`, `zambil init` or `zambil uninstall` cannot read or write `settings.json` of Claude Code or the user configuration file. `zambil install` or `zambil init` found an error in the notes. The hooks are installed in that case.
- 2: the usage is wrong, zambil cannot find the repo, or `zambil install` or `zambil init` cannot find `zambil` on the `PATH`.

`zambil hook` is the exception: it exits with 0 in each of these cases.

## Add a command

Each command lives in its own folder and file, for example `src/show/show-command.ts`.

1. Export a `Command` from that file, named after the file, for example `showCommand`. The type is in `src/command.ts`.
2. Add one line to `src/commands.ts`, in alphabetical order:

   ```ts
   show: async () => (await import("./show/show-command.ts")).showCommand,
   ```

3. Parse the arguments with `parseCommandArgs` and spread `sharedOptions` into your options, so that `--repo` works. List each option in the `options` of the `Command`, so that `--help` explains it. If only the agent or a hook runs the command, set `audience: "agent"`. Then `zambil help` lists it apart from the user commands.
4. Load the repo with `openRepo`. If zambil cannot find or read the repo, `openRepo` returns a message for the user.

Commands read the environment only through `CliConfig`. `src/config.ts` reads `process.env` once at startup. A command that needs standard input calls `options.input.readAll()`.

A command that runs as an agent hook must exit with 0, also when it cannot find the repo. It reports the problem on standard error. Claude Code reads exit code 2 from a hook as a blocking error: it stops the prompt or the tool call.

Do not change the notes in `packages/core/fixtures/sample-repo` for a new command, because the tests of `list` and `check` read every note in it. Write the repo for your test with `writeTestRepo` from `@zambil/core/write-test-repo`.

`zambil help` imports every command file. If a command needs a slow module, for example an embedder, import that module inside `run`, not at the top of the file.
