# @zambil/cli

The `zambil` command. It reads your configuration repo with `@zambil/core`. `docs/notes.md` in the root of the repo describes the note format.

## Run it

Node 24 runs the TypeScript directly, so the CLI has no build step. Run these commands from the root of the repo, after `pnpm install`:

```sh
node apps/cli/src/main.ts list --repo packages/core/fixtures/sample-repo
node apps/cli/src/main.ts check --repo packages/core/fixtures/sample-repo
node apps/cli/src/main.ts show welcome --repo packages/core/fixtures/sample-repo
```

To put `zambil` on your `PATH`, link `apps/cli/src/main.ts` into a folder on your `PATH`. Run this command from the root of the repo:

```sh
ln -s "$PWD/apps/cli/src/main.ts" ~/.local/bin/zambil
```

Then `zambil list` works in every folder.

The commands are:

- `zambil list` prints one line per note: the name, the kind, the path and the description.
- `zambil check` prints each problem with its path. An error sets the exit code to 1.
- `zambil save <name>` creates or rewrites a note from standard input, or records with `--verified` that its claims still hold. It is the one way to write a note. See "Write a note" in `docs/notes.md`.
- `zambil save-guide` prints what an agent must know before it writes a note.
- `zambil show <name>` prints a note as the agent gets it, with its embeds, links and expiry warnings. `--expired` prints an expired note anyway. `docs/notes.md` describes the text in [Rendering](../../docs/notes.md#rendering).
- `zambil help` prints the commands. `zambil help <command>` or `zambil <command> --help` prints the usage of one command.

Each command takes `--repo <path>`. Without it, zambil reads `ZAMBIL_REPO`, then `$XDG_CONFIG_HOME/zambil/config.json`. If `XDG_CONFIG_HOME` is not set, the file is `~/.config/zambil/config.json`.

The exit codes are:

- 0: the command worked.
- 1: `zambil check` found an error, `zambil save` refused to save the note, or `zambil show` could not resolve the name, the heading or the block.
- 2: the usage is wrong, or zambil cannot find the repo.

## Add a command

Each command lives in its own folder and file, for example `src/show/show-command.ts`.

1. Export a `Command` from that file, named after the file, for example `showCommand`. The type is in `src/command.ts`.
2. Add one line to `src/commands.ts`, in alphabetical order:

   ```ts
   show: async () => (await import("./show/show-command.ts")).showCommand,
   ```

3. Parse the arguments with `parseCommandArgs` and spread `sharedOptions` into your options, so that `--repo` works.
4. Load the repo with `openRepo`. If zambil cannot find or read the repo, `openRepo` returns a message for the user.

Commands read the environment only through `CliConfig`. `src/config.ts` reads `process.env` once at startup. A command that needs standard input calls `options.input.readAll()`.

A command that runs as an agent hook must exit with 0, also when it cannot find the repo. It reports the problem on standard error. Claude Code reads exit code 2 from a hook as a blocking error: it stops the prompt or the tool call.

Do not change the notes in `packages/core/fixtures/sample-repo` for a new command, because the tests of `list` and `check` read every note in it. Write the repo for your test with `writeTestRepo` from `@zambil/core/write-test-repo`.

`zambil help` imports every command file. If a command needs a slow module, for example an embedder, import that module inside `run`, not at the top of the file.
