# zambil

zambil has four packages: `packages/core` reads a configuration repo of notes, `packages/embed` is the similarity search, `packages/claude-code` connects zambil to Claude Code hooks, and `apps/cli` is the `zambil` command. `docs/notes.md` is the contract for the note format. This file tells you how to set up, test and change the repo. It is written for a task that has no other context.

`vision.md` says what zambil is for and how to make trade-offs. Read it before you make a design decision. If a section of it is still empty, the maintainer did not decide that part yet.

## Set up

You need Node 24 or later. The repo pins pnpm 11.22.0 in `package.json`. If your pnpm has a different version, pnpm downloads the pinned version for you.

1. Run `pnpm install` in the root of the repo.
2. Run `pnpm test` to make sure that the setup works. The tests of `packages/embed` download a 23 MB model from huggingface.co, so they need a network connection.

The install also points git at the hooks in `.vite-hooks/`. The pre-commit hook formats and lints the files that you stage.

## Commands

Run each command from the root of the repo.

| Command          | What it does                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm test`      | Runs every `*.test.ts` file in all packages and in `scripts/`. It is the test command for landing a PR. |
| `pnpm run check` | Checks the format, lints, and typechecks the whole repo.                                                |
| `pnpm run fix`   | Formats the files and fixes the lint findings that have a fix.                                          |
| `pnpm run ready` | Runs `check` and then `test`. CI runs the same steps.                                                   |

The tools come from Vite+ (`vp`), one CLI for format (Oxfmt), lint (Oxlint), typecheck and tests (Vitest). Import test functions from `vite-plus/test`, not from `vitest`. The Vite+ docs are in `node_modules/vite-plus/docs` after the install.

## Layout

The repo is a pnpm workspace (one repo with many packages).

- `apps/<name>/` holds a program that runs, for example a web app or a CLI.
- `packages/<name>/` holds a library that apps import.
- `scripts/` holds tests and scripts for the repo itself.

Each package has its own `package.json`. Its name is `@zambil/<name>`, and the name must be different from all other names in `apps/` and `packages/`. It has `"private": true` and `"type": "module"`. Put each test next to its code: `parse-order.test.ts` beside `parse-order.ts`. The root `pnpm test` finds it. You do not add a test script to the package.

Each folder in `apps/` and `packages/` is its own Vitest project. A package can need its own test configuration, for example a DOM environment or a setup file. Then put a `vite.config.ts` in the folder of that package. The root `pnpm test` uses it for the tests in that folder. Only the `test` part of that file is used. A lint rule for one folder goes in the root `vite.config.ts`, as an entry in `lint.overrides` with `files: ["packages/<name>/**"]`.

If a package needs a different TypeScript configuration, for example JSX or browser types, add a `tsconfig.json` to the package with `"extends": "../../tsconfig.json"`. Do not change the root `tsconfig.json` for one package.

Write TypeScript only. Import local files with the `.ts` extension. Node runs `.ts` files directly, so a script does not need a build step.

To use one package in another:

1. In the library, list each file that other packages can import in `exports`, for example `"exports": { "./parse-order": "./src/parse-order.ts" }`. Do not add an `index.ts` that re-exports other files.
2. In the package that imports it, add `"@zambil/<name>": "workspace:*"` to `dependencies`.
3. Run `pnpm install`.

## Dependencies

All versions live in the `catalog` in `pnpm-workspace.yaml`. To add a dependency:

1. Add the name and version to the `catalog` in `pnpm-workspace.yaml`. This is a shared file, but a new catalog line is an expected change.
2. In the `package.json` of your package, write the version as `"catalog:"`.
3. Run `pnpm install`, and commit `pnpm-lock.yaml`.

If `pnpm install` stops with `ERR_PNPM_IGNORED_BUILDS`, the dependency has a build script. Add `<name>: true` under `allowBuilds` in `pnpm-workspace.yaml` to run the script, or `<name>: false` to skip it. Do not run `pnpm approve-builds`, because it asks questions on the screen.

If a dependency saves less than about a day of work, write the code yourself.

## Work in parallel with other tasks

Many tasks can change this repo at the same time, each in its own PR. Each task owns a folder, for example `packages/orders/`. Change only the files in your folder.

These files are shared by all tasks:

- `package.json` and `pnpm-lock.yaml` in the root
- `pnpm-workspace.yaml`
- `vite.config.ts` and `tsconfig.json` in the root
- `.github/workflows/ci.yml`
- `AGENTS.md`

If you must change a shared file, keep the change small and say so in the PR. A new package always changes `pnpm-lock.yaml`. This is true for a package with no dependencies too. Commit that change.

If a rebase stops on a conflict in these files, do not edit `pnpm-lock.yaml` by hand:

1. If `pnpm-workspace.yaml` has a conflict in the `catalog`, keep the lines from both sides. Then run `git add pnpm-workspace.yaml`.
2. Run `git checkout origin/main -- pnpm-lock.yaml` to take the lockfile from the default branch.
3. Run `pnpm install`. pnpm adds the dependencies of your branch to the lockfile again.
4. Run `git add pnpm-lock.yaml` and continue the rebase.

## Before you push

If your change is one that a user of zambil sees, add one line for it under `## Unreleased` in `CHANGELOG.md`. `docs/releases.md` tells how a release is made.

Run `pnpm run ready`. CI runs `pnpm run check` and `pnpm test` on each pull request and on each push to `main`. If CI fails, the PR does not land.

CI also runs `node scripts/install-smoke.ts` on Linux and macOS. It runs `install.sh` from your working tree in a temporary home folder, and installs the code of your last commit. Run it after you change `install.sh`. It downloads about 120 MB the first time.

If you rename a script in `package.json`, update this file too. If this file names a `pnpm` script that does not exist, `scripts/documented-scripts.test.ts` fails.
