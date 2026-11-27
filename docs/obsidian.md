# zambil and Obsidian

Obsidian is a Markdown editor that works on a folder of notes, a vault. The notes folder of zambil can be a vault, or a folder in a vault. The root [`README.md`](../README.md#use-an-obsidian-vault-that-you-have) tells you how to connect a vault that you already use.

## Find the notes for a hook

To find every note on a hook, search for the `hooks` property in the search of Obsidian:

| Search                   | Finds                                                            |
| ------------------------ | ---------------------------------------------------------------- |
| `[hooks:SessionStart]`   | Each note whose `hooks` holds `SessionStart`.                    |
| `[hooks:/^PreToolUse$/]` | Each note whose `hooks` holds exactly `PreToolUse`.              |
| `[hooks]`                | Each note that names a hook.                                     |
| `[tools:Bash]`           | Each note for the `Bash` tool.                                   |
| `tag:#ops`               | Each note with the tag `ops`, in the frontmatter or in the text. |

Obsidian ignores case in a search, and it also finds part of a name. So `[hooks:PostToolUse]` also finds `PostToolUseFailure`. The exact search with `/^PreToolUse$/` works only for a list, so write `hooks: [PreToolUse]`, not `hooks: PreToolUse`. Obsidian shows a list as a list property. It shows the short form as text.

These results come from Obsidian 1.15.1 with the sample repo in `packages/core/fixtures/sample-repo`.

## Links and names

`docs/notes.md` describes how zambil reads links, aliases and names in [Names](notes.md#names). Two differences from Obsidian matter most. zambil needs a unique name for each note in the whole folder. A `[[link]]` that uses an alias works in zambil, but Obsidian cannot follow it, so write `[[deploy|ship]]`.
