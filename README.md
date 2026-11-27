# zambil

zambil is a CLI that gives an agent the right notes from your own configuration repo. `vision.md` describes the goal. `docs/notes.md` describes the note format.

The repo has three packages. `packages/core` reads a configuration repo, `packages/embed` finds notes with a similar description, and `apps/cli` is the `zambil` command with `zambil list`, `zambil check`, `zambil index` and `zambil search`. `apps/cli/README.md` tells you how to run it.

To set up, run `pnpm install`. To run the tests, run `pnpm test`. `AGENTS.md` tells you how to work in the repo.
