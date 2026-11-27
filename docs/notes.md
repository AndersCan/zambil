# Notes

A note is a Markdown file in your configuration repo. zambil reads the notes and adds the matching ones to the context of an agent. This file is the contract for the note format. The code in `packages/core` follows it, and each later feature follows it too.

## The configuration repo

The configuration repo is a folder of notes that you own. You can open it as a vault in Obsidian. zambil looks for it in this order:

1. The `--repo <path>` flag of a command.
2. The `ZAMBIL_REPO` environment variable.
3. The `repo` key in the user configuration file, `$XDG_CONFIG_HOME/zambil/config.json`. If `XDG_CONFIG_HOME` is not set, the file is `~/.config/zambil/config.json`.

The user configuration file is JSON:

```json
{ "repo": "~/notes" }
```

A path can start with `~/`. A relative path in the flag or the environment variable is relative to the working folder. A relative path in the configuration file is relative to the folder of that file. zambil does not use the working folder as the repo, because an agent runs zambil from the folder of its project.

## Which files are notes

Each file that ends in `.md` is a note, in every folder of the repo. zambil skips these files and folders:

- Each file or folder whose name starts with `.`, for example `.obsidian`, `.trash` and `.git`.
- Each `node_modules` folder.
- Each file in a skill folder other than its `SKILL.md`. See [Skills](#skills).
- Symbolic links.

## Names

The filename without `.md` is the name of the note. `ops/deploy.md` has the name `deploy`. The folder is not part of the name. A skill takes the name of its folder.

The `aliases` property gives a note more names. A `[[link]]` or a `z:<name>` can use the name or any alias.

Names are unique in the whole repo. No two notes can share a name, an alias, or a name and an alias, in any folder. Obsidian allows the same name in two folders, but zambil does not. zambil compares names without regard to case, because Obsidian resolves links that way. `Deploy` and `deploy` are the same name.

A duplicate name is an error. The message names every file that uses the name, for example:

```text
ops/deploy.md: error: the name "deploy" is used by 2 notes: ops/deploy.md, skills/deploy/SKILL.md
```

zambil still loads both notes. A lookup of that name is ambiguous and returns both notes, so that a later feature can warn the agent.

Obsidian cannot link to a name that has `#`, `^`, `[`, `]` or `|`. zambil gives a warning for such a name or alias.

## Frontmatter

Frontmatter holds the properties of a note. It is YAML between two `---` lines, and the first `---` line is the first line of the file. Without the closing `---` line, the file has no frontmatter. This is the same rule as in Obsidian.

```markdown
---
description: How to deploy the web app.
aliases: [ship]
tags: [ops]
hooks: [SessionStart]
---

The text of the note.
```

zambil reads the YAML with the YAML 1.2 core schema. Dates stay text, so `expires` keeps the local time that Obsidian writes. If the YAML does not parse, the note gets an error and loads without properties. If that frontmatter has an `expires` line, the note counts as expired.

## Properties

zambil reads the properties in the table. The `properties` field of the note holds every raw frontmatter value, the known ones too. zambil does not use the other properties.

| Property       | Value             | Meaning                                                                                                                      |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `description`  | text              | What the note is for. Similarity search matches the prompt against this text.                                                |
| `aliases`      | list of text      | More names for the note.                                                                                                     |
| `tags`         | list of text      | Obsidian tags. zambil also reads the `#tags` in the text of the note.                                                        |
| `hooks`        | list of text      | The hooks where the note applies, with the hook names of Claude Code, for example `SessionStart` or `PreToolUse`.            |
| `tools`        | list of text      | The tools that a tool hook applies to, for example `Bash` or `Edit`.                                                         |
| `expires`      | date or date-time | The note is current until this moment. See [Expiry](#expiry).                                                                |
| `when-expired` | link or name      | The note that tells how to refresh this note, for example `"[[refresh-today]]"`.                                             |
| `script`       | path              | Makes the note a script note. The path of the script, relative to the folder of the note. See [Scripts](#scripts).           |
| `run-with`     | text              | The program that runs the script, for example `bash`, `node` or `uv run`. Without it, the agent runs the script file itself. |
| `name`         | text              | Only in a `SKILL.md`. Claude Code reads it. It must be the name of the skill folder.                                         |

zambil accepts the same short forms as Obsidian:

- A single text counts as a list. In `aliases`, `hooks` and `tools`, commas separate the items. In `tags`, commas and spaces separate the items.
- A leading `#` on a tag is removed.
- An empty value, such as `description:` with nothing after it, is the same as no property.
- A number or `true` and `false` becomes text.

A property with the wrong shape, for example a list in `description`, gets an error. zambil then ignores that property and reads the others.

zambil does not check the hook names against Claude Code. The Claude Code adapter does that, because the core does not depend on one agent tool.

## Note kinds

zambil knows three kinds of note. The place of the file and the `script` property set the kind.

| Kind     | How you make one                 | What the agent gets                                      |
| -------- | -------------------------------- | -------------------------------------------------------- |
| `note`   | Any other Markdown file.         | The text of the note.                                    |
| `skill`  | A `SKILL.md` file in a folder.   | The name, the description, and how to load the skill.    |
| `script` | A note with a `script` property. | The description, where the script is, and how to run it. |

### Skills

A skill is a folder that holds a `SKILL.md` file, the same layout as a Claude Code skill. The name of the skill is the name of its folder, so `skills/release/SKILL.md` has the name `release`. This keeps the rule that the filename is the name: for a skill, the folder name is the filename that counts.

```text
skills/
  release/
    SKILL.md        the skill, with the name "release"
    reference.md    part of the skill, not a note
    publish.sh      part of the skill
```

The other files in a skill folder belong to the skill. They are not notes, so two skills can each have a `reference.md`. zambil does not look in the subfolders of a skill folder.

A skill has these rules:

- If `SKILL.md` has a `name` property, it must be the name of the folder. Claude Code reads `name`, so a different value is an error.
- A skill needs a `description`. The agent reads it to decide if it loads the skill. Without one, zambil gives a warning.
- A skill cannot have a `script` property. Describe the scripts of a skill in its `SKILL.md`.
- A `SKILL.md` in the root of the repo is an error, because it has no skill folder.

### Scripts

A script note describes a script. The `script` property makes a note a script note.

```markdown
---
description: Back up the notes to a tar file.
script: backup.sh
run-with: bash
---

Give the folder for the tar file as the first argument.
```

The path in `script` is relative to the folder of the note, and it must stay inside the repo. zambil stores it relative to the repo root, in `note.script.path`. The text of the note tells the agent what the script does and which arguments it takes.

zambil never reads the script, and the source of the script never goes into the context. A link or an embed resolves only to a note. zambil never reads a file that is not a note, so `![[backup.sh]]` does not add the script. `zambil check` makes sure that a file is at the path, with `stat` only. A match adds the text of the note to the context. It never runs the script.

## Expiry

A note with `expires` is a cache. For example, a note holds the date of today and expires tomorrow. zambil reads these forms:

| Value                  | Meaning                                             |
| ---------------------- | --------------------------------------------------- |
| `2026-11-28`           | Midnight at the start of that day, local time.      |
| `2026-11-28T09:30`     | That time, local time. Seconds are optional.        |
| `2026-11-28T09:30:00Z` | That moment. An offset such as `+02:00` also works. |

A note is expired from its `expires` moment on. Obsidian writes dates and times without a time zone, so zambil reads them as local time.

If zambil cannot read the value, the note gets an error, and it counts as expired. These cases also count as expired:

- The frontmatter has an `expires` line, but the YAML does not parse.
- `expires` is a list or a mapping, not text.

Expired content is never shown as current.

Each feature that shows notes follows these rules:

1. Search, hook injection and similarity matches leave out each note for which `isExpired` is true. The feature checks `isExpired` with the current time each time it runs a query or a hook, never when it builds an index.
2. A link, an embed or a `z:<name>` resolves the name with `resolveNote`, not with `findNote`. For an expired note, `resolveNote` returns `expired`, never `found`. The feature then shows a warning in place of the content.
3. If the expired note has `when-expired`, `resolveNote` also returns the lookup of that note, and the warning links to it.

If the `when-expired` note does not exist, `zambil check` gives an error.

## Problems

zambil reports two kinds of problem. An error makes `zambil check` exit with 1. A warning does not change the exit code.

| Problem                                                           | Kind    |
| ----------------------------------------------------------------- | ------- |
| Two notes share a name or an alias.                               | error   |
| The frontmatter is not valid YAML, or not a list of properties.   | error   |
| A property has the wrong shape.                                   | error   |
| `expires` is not a date.                                          | error   |
| `when-expired` names a note that does not exist.                  | error   |
| `script` points outside the repo, or to a missing file.           | error   |
| A skill has a `name` that is not its folder name, or a `script`.  | error   |
| A `SKILL.md` is in the root of the repo.                          | error   |
| A note cannot be read.                                            | error   |
| A skill has no `description`.                                     | warning |
| `when-expired` without `expires`, or `run-with` without `script`. | warning |
| Obsidian cannot link to a name or an alias.                       | warning |
| A folder cannot be read.                                          | warning |

## The core library

Later features import from `@zambil/core`. Each export is one file:

| Import                            | What it gives                                                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@zambil/core/locate-repo`        | `locateRepo`: finds the repo from the flag, the environment and the configuration file. `UserEnvironment.cacheHome` is `XDG_CACHE_HOME`, for files that zambil can rebuild. |
| `@zambil/core/load-repo`          | `loadRepo`: reads every note, with its problems and every duplicate name.                                                                                                   |
| `@zambil/core/configuration-repo` | The `ConfigurationRepo` and `NameIndex` types.                                                                                                                              |
| `@zambil/core/find-note`          | `findNote`: looks up a name or alias. The result is found, missing or ambiguous.                                                                                            |
| `@zambil/core/resolve-note`       | `resolveNote`: looks up a name and returns `expired`, with the `when-expired` note, for an expired note.                                                                    |
| `@zambil/core/parse-link-target`  | `parseLinkTarget`: the note name in a link such as `[[folder/name#heading]]`, or in a plain name.                                                                           |
| `@zambil/core/index-names`        | `nameKey`: the form in which two names are the same.                                                                                                                        |
| `@zambil/core/check-repo`         | `checkRepo`: every problem, with the checks that the loader skips.                                                                                                          |
| `@zambil/core/is-expired`         | `isExpired`: tells whether a note is expired at a given moment.                                                                                                             |
| `@zambil/core/note`               | The `Note` type and its kinds.                                                                                                                                              |
| `@zambil/core/note-problem`       | The `NoteProblem` type.                                                                                                                                                     |
| `@zambil/core/parse-note`         | `parseNote`: reads one note from its text.                                                                                                                                  |
| `@zambil/core/split-frontmatter`  | `splitFrontmatter`: splits the frontmatter from the text, for a feature that rewrites a note.                                                                               |
| `@zambil/core/parse-frontmatter`  | `parseFrontmatter`: reads frontmatter YAML the same way as the loader.                                                                                                      |
| `@zambil/core/either`             | The `Either` type for expected failures.                                                                                                                                    |
| `@zambil/core/is-never`           | `isNever`: the `default` of an exhaustive `switch`.                                                                                                                         |
| `@zambil/core/as-record`          | `asRecord`: reads untyped input, such as parsed JSON, as an object.                                                                                                         |
| `@zambil/core/note-file`          | The `NoteFile` type: a note file before it is read.                                                                                                                         |
| `@zambil/core/write-test-repo`    | `writeTestRepo`: writes a repo into a temporary folder for a test.                                                                                                          |

The loader is synchronous. The CLI runs on every prompt, and synchronous reads of many small files are about seven times faster than parallel promises. `loadRepo` reads each note once and keeps its text in `note.content`, the Markdown after the frontmatter. It does not check script files or `when-expired` names, because `checkRepo` does that.
