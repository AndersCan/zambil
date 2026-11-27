# zambil

zambil has no product code yet. This file tells you how to set up, test and change the repo. It is written for a task that has no other context.

## Set up

You need Node 24 or later. The repo pins pnpm 11.22.0 in `package.json`. If your pnpm has a different version, pnpm downloads the pinned version for you.

1. Run `pnpm install` in the root of the repo.
2. Run `pnpm test` to make sure that the setup works.

The install also points git at the hooks in `.vite-hooks/`. The pre-commit hook formats and lints the files that you stage.

## Commands

Run each command from the root of the repo.

| Command          | What it does                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm test`      | Runs every `*.test.ts` file in the repo, in all packages. This is the test command for landing a PR. |
| `pnpm run check` | Checks the format, lints, and typechecks the whole repo.                                             |
| `pnpm run ready` | Runs `check` and then `test`. CI runs the same steps.                                                |
| `vp check --fix` | Formats the files and fixes the lint findings that have a fix.                                       |

The tools come from Vite+ (`vp`), one CLI for format (Oxfmt), lint (Oxlint), typecheck and tests (Vitest). Import test functions from `vite-plus/test`, not from `vitest`. The Vite+ docs are in `node_modules/vite-plus/docs` after the install.

## Layout

The repo is a pnpm workspace (one repo with many packages).

- `apps/<name>/` holds a program that runs, for example a web app or a CLI.
- `packages/<name>/` holds a library that apps import.
- `scripts/` holds tests and scripts for the repo itself.

Each package has its own `package.json`. Its name is `@zambil/<name>`. It has `"private": true` and `"type": "module"`. Put each test next to its code: `parse-order.test.ts` beside `parse-order.ts`. The root `pnpm test` finds it. You do not add a test script to the package.

Write TypeScript only. Import local files with the `.ts` extension. Node runs `.ts` files directly, so a script does not need a build step.

## Dependencies

All versions live in the `catalog` in `pnpm-workspace.yaml`. To add a dependency:

1. Add the name and version to the `catalog` in `pnpm-workspace.yaml`.
2. In the `package.json` of your package, write the version as `"catalog:"`.
3. Run `pnpm install`, and commit `pnpm-lock.yaml`.

If a dependency saves less than about a day of work, write the code yourself.

## Work in parallel with other tasks

Many tasks can change this repo at the same time, each in its own PR. Each task owns a folder, for example `packages/orders/`. Change only the files in your folder.

These files are shared by all tasks:

- `package.json` and `pnpm-lock.yaml` in the root
- `pnpm-workspace.yaml`
- `vite.config.ts` and `tsconfig.json`
- `.github/workflows/ci.yml`
- `AGENTS.md`

If you must change a shared file, keep the change small and say so in the PR.

If a rebase stops on a conflict in `pnpm-lock.yaml`, do not edit the file by hand:

1. Run `git checkout origin/main -- pnpm-lock.yaml` to take the version from the default branch.
2. Run `pnpm install`. pnpm adds the dependencies of your branch to the lockfile again.
3. Run `git add pnpm-lock.yaml` and continue the rebase.

## Before you push

Run `pnpm run ready`. CI runs `pnpm run check` and `pnpm test` on each pull request and on each push to `main`. If CI fails, the PR does not land.

If you rename a script in `package.json`, update this file too. If this file names a `pnpm` script that does not exist, `scripts/documented-scripts.test.ts` fails.
