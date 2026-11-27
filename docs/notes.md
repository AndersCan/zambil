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
| `expires`      | date or date-time | The claims of the note hold until this moment. See [Expiry](#expiry).                                                        |
| `when-expired` | link or name      | The note that tells how to update this note or verify its claims, for example `"[[refresh-today]]"`.                         |
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

A note that makes claims goes out of date. For example, a note says how a module works, but the code changes after that. The note is then false and confuses the agent. So a note can have an `expires` date and a `when-expired` note. The `when-expired` note tells how to update the note or verify its claims. It helps before the date too, because a note can become false early. If the claims still hold, the result is a new `expires` date with the same content. See [Write a note](#write-a-note).

A cache is one use of `expires`. For example, a note holds the date of today and expires tomorrow, so the agent knows the day without work.

zambil never gives a note a new `expires` date on its own, before or after the date. An expiry warning can offer an update. The agent saves it only when the user asks.

zambil reads these forms:

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

## Write a note

Writing a note is a deliberate act. zambil, a hook or a background process never writes a note on its own. A note changes only when the user edits it, or when the user asks the agent to run `zambil save`. Most often, the agent writes the first version and rewrites it when the user asks. Then the user fine-tunes it by hand in Obsidian. `zambil save-guide` prints these rules for the agent.

`zambil save <name>` has three modes:

| Mode    | Command                                          | What it does                                                    |
| ------- | ------------------------------------------------ | --------------------------------------------------------------- |
| create  | `zambil save <name>`                             | Writes a new note. Its name and its aliases must be free.       |
| rewrite | `zambil save <name> --rewrite`                   | Changes an existing note. zambil finds it by its name.          |
| verify  | `zambil save <name> --verified --expires <date>` | Sets a new `expires` date. The rest of the note stays the same. |

The text of the note comes on standard input. It is Markdown, with optional frontmatter. Each property in that frontmatter replaces the same property of the note. The other properties stay line for line, with their comments and their format. The content of the text replaces the old content. In a rewrite, text without content keeps the old content.

A create and a rewrite need a choice about expiry:

- `--expires <date>` sets a date in the future, in a form from [Expiry](#expiry).
- `--no-expires` removes `expires` and `when-expired`, for a note that makes no claims that go out of date.

`--when-expired <name>` links the note that tells how to update this note or verify its claims. That note must exist, or it must be the note itself. If a saved note expires and has no `when-expired` note, zambil prints a reminder. Set `expires` and `when-expired` with these options, not in the frontmatter of the text, so that zambil can check them. `--folder <path>` puts a new note in a folder of the repo. The default is the root.

zambil refuses to save, and changes no file, in these cases:

- A create uses a name or an alias that another note uses. A rewrite or a verify uses a name that no note has, or an alias in place of the name.
- The new note has a name that a filename or an Obsidian link cannot have, a name that starts with `.`, or the name `SKILL`.
- The folder of a new note is outside the repo, starts with `.`, is in `node_modules`, is a symbolic link, or is in a skill folder. zambil does not read notes in these folders.
- The new text gives the note an alias that another note uses.
- The `expires` date is not a date, or it is not in the future. The `when-expired` note does not exist.
- The frontmatter of the note does not parse. Or zambil cannot change it line by line without changes to other properties.
- The saved note has an error that the old note did not have. Or the repo gets an error from `zambil check` that it did not have, for example a missing script file, or a `when-expired` name of another note that no longer resolves.

A refusal exits with 1. A wrong usage, such as no choice about expiry, exits with 2.

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

## Rendering

`renderNote` turns a note into the text that an agent gets. `zambil show <name>` prints the same text. The name can also point to a part of a note, the same way as in a link: `deploy#Steps` is the section under the heading `Steps`, and `deploy#^intro` is the block with the id `intro`.

Each note is a block between two tags, for example `<note name="deploy" path="ops/deploy.md">` and `</note>`. A skill uses `<skill>`, and a script note uses `<script>`. The block starts with the description of the note.

Links and embeds work as in Obsidian:

- `[[name]]` stays in the text as written. The block ends with a `Links:` list. Each item gives the name and the description of the linked note, and how to open it. The content of the linked note is not added.
- `![[name]]` puts the block of the note in place of the embed. The embeds in that note are filled in too.
- `![[name#Heading]]` adds the section from that heading to the next heading of the same or a higher level. `![[name#A#B]]` adds the heading `B` under the heading `A`. zambil compares headings without regard to case.
- `![[name#^id]]` adds the block that ends with `^id`: a paragraph, or a list item with the items under it. An `^id` alone on a line points to the block above it.
- `[[#Heading]]` and `![[#Heading]]` point to the note that holds them.
- A link in a code block or in inline code is plain text.

An embed gets a warning in its place when no note has the name, when more than one note has it, or when the note has no such heading or block. It also gets a warning when it embeds itself, directly or through other notes. A link with one of these problems gets the same warning in the `Links:` list.

Expired notes follow the rules in [Expiry](#expiry):

- An expired note gets a warning in place of its content, in an embed and in `zambil show`. The warning names the `when-expired` note, if the note has one. It says that the agent can skip the note, or read it anyway with `zambil show <name> --expired`. It says that the agent can offer an update, but saves a change only when the user asks for it.
- `--expired`, or the option `expired: "show"`, reads only the named note anyway. An expired note that it embeds still gets the warning.
- A link to an expired note gives its description with a warning.
- A current note that has `when-expired` names that note as the way to verify its claims, because a note can be wrong before its date. If the `when-expired` note expired too, it gets the expiry warning.

Skills and scripts are offers:

- A skill gives its name, its description and how to load it. The text of its `SKILL.md` is not added.
- A script note gives its description, the full path of the script, the command that runs it, and the text of the note. zambil never reads the script.

The core names no agent tool. The caller passes a `RenderWording` with three functions: how to open a note, how to read an expired note anyway, and how to load a skill. `zambil show` passes wording that runs `zambil show`. An adapter for an agent tool passes its own wording.

`zambil show` exits with 1 when the name, the heading or the block does not resolve. For an expired note it exits with 0, because the warning is the answer.

## The core library

Later features import from `@zambil/core`. Each export is one file. A new export gets its own line in this list, in alphabetical order:

- `@zambil/core/as-record`. `asRecord` reads untyped input, such as parsed JSON, as an object.
- `@zambil/core/check-repo`. `checkRepo` returns every problem, with the checks that the loader skips.
- `@zambil/core/configuration-repo`. The `ConfigurationRepo` and `NameIndex` types.
- `@zambil/core/either`. The `Either` type for expected failures.
- `@zambil/core/find-note`. `findNote` looks up a name or alias. The result is found, missing or ambiguous.
- `@zambil/core/index-names`. `nameKey` returns the form in which two names are the same.
- `@zambil/core/is-expired`. `isExpired` tells whether a note is expired at a given moment.
- `@zambil/core/is-never`. `isNever` is the `default` of an exhaustive `switch`.
- `@zambil/core/load-repo`. `loadRepo` reads every note, with its problems and every duplicate name.
- `@zambil/core/locate-repo`. `locateRepo` finds the repo from the flag, the environment and the configuration file. `UserEnvironment.cacheHome` is `XDG_CACHE_HOME`, for files that zambil can rebuild.
- `@zambil/core/note`. The `Note` type and its kinds.
- `@zambil/core/note-file`. The `NoteFile` type: a note file before it is read.
- `@zambil/core/note-problem`. The `NoteProblem` type.
- `@zambil/core/parse-frontmatter`. `parseFrontmatter` reads frontmatter YAML the same way as the loader.
- `@zambil/core/parse-link-target`. `parseLinkTarget` returns the note name in a link such as `[[folder/name#heading]]`, or in a plain name.
- `@zambil/core/parse-note`. `parseNote` reads one note from its text.
- `@zambil/core/render-note`. `renderNote` turns a note into the text an agent gets. See [Rendering](#rendering).
- `@zambil/core/resolve-note`. `resolveNote` looks up a name and returns `expired`, with the `when-expired` note, for an expired note.
- `@zambil/core/save-note`. `saveNote` creates, rewrites or verifies one note. Only `zambil save` calls it, so that a note is always written on purpose.
- `@zambil/core/split-frontmatter`. `splitFrontmatter` splits the frontmatter from the text, for a feature that rewrites a note.
- `@zambil/core/write-test-repo`. `writeTestRepo` writes a repo into a temporary folder for a test.

The loader is synchronous. The CLI runs on every prompt, and synchronous reads of many small files are about seven times faster than parallel promises. `loadRepo` reads each note once and keeps its text in `note.content`, the Markdown after the frontmatter. It does not check script files or `when-expired` names, because `checkRepo` does that.
