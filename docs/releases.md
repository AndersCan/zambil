# Make a release

A release is a git tag of the form `vX.Y.Z`, for example `v0.1.0`, on a commit of `main`. The install command installs the release with the highest version. Until the first tag exists, it installs the newest commit of `main`. Only the maintainer makes a release.

The version comes from `apps/cli/package.json`. `zambil --version` prints it. If the clone is not at the tag of that version, it also prints the commit.

## Before the release

1. Pick the version. Raise the first number for a change that breaks notes or the setup, the second for a new feature, and the third for fixes only.
2. In `CHANGELOG.md`, rename `## Unreleased` to the version and the date, for example `## 0.1.0 - 2026-11-28`. Above it, add an empty `## Unreleased` section.
3. Set `"version"` in `apps/cli/package.json` to the same version, for example `"0.1.0"`. If `CHANGELOG.md` has no section for that version, `scripts/changelog.test.ts` fails.
4. Merge these two changes into `main` with a pull request. Wait until CI passes on `main`.

## Tag and publish

Run these commands in a clone of `AndersCan/zambil` that is on the newest commit of `main`:

```sh
git switch main && git pull --ff-only
git tag -a v0.1.0 -m "zambil 0.1.0"
git push origin v0.1.0
gh release create v0.1.0 --title "zambil 0.1.0" --notes "See the 0.1.0 section of CHANGELOG.md."
```

The tag is enough for the install command. The GitHub release gives users a page that they can watch.

## After the release

1. In a new terminal, run the install command with an empty home folder: `HOME=$(mktemp -d) sh -c 'curl -fsSL https://raw.githubusercontent.com/AndersCan/zambil/main/install.sh | sh'`.
2. Make sure that it prints `Downloading zambil v0.1.0`.
3. Run `zambil --version` from that install. It prints `zambil 0.1.0` with no commit.

A clone that follows `main` stays on `main`. From the next update on, the install command prints the command that moves it to the newest release.
