# @zambil/cli

The `zambil` command. It reads your configuration repo with `@zambil/core`. `docs/notes.md` in the root of the repo describes the note format.

## Run it

Node 24 runs the TypeScript directly, so the CLI has no build step. Run these commands from the root of the repo, after `pnpm install`:

```sh
node apps/cli/src/main.ts list --repo packages/core/fixtures/sample-repo
node apps/cli/src/main.ts check --repo packages/core/fixtures/sample-repo
```

To put `zambil` on your `PATH`, link `apps/cli/src/main.ts` into a folder on your `PATH`. Run this command from the root of the repo:

```sh
ln -s "$PWD/apps/cli/src/main.ts" ~/.local/bin/zambil
```

Then `zambil list` works in every folder.

| Command        | What it does                                                                    |
| -------------- | ------------------------------------------------------------------------------- |
| `zambil list`  | Prints one line per note: the name, the kind, the path and the description.     |
| `zambil check` | Prints each problem with its path. An error sets the exit code to 1.            |
| `zambil help`  | Prints the commands. `zambil <command> --help` prints the usage of one command. |

Each command takes `--repo <path>`. Without it, zambil reads `ZAMBIL_REPO`, then `~/.config/zambil/config.json`.

The exit codes are:

- 0: the command worked.
- 1: `zambil check` found an error.
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

Commands read the environment only through `CliConfig`. `src/config.ts` reads `process.env` once at startup.

`zambil help` imports every command file. If a command needs a slow module, for example an embedder, import that module inside `run`, not at the top of the file.
