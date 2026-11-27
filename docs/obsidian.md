# zambil and Obsidian

Obsidian is a Markdown editor that works on a folder of notes, a vault. The notes folder of zambil opens as a vault. zambil uses the same properties, tags, aliases, links and embeds as Obsidian. It skips the folders that start with `.`, such as `.obsidian` and `.trash`. The root [`README.md`](../README.md#use-an-obsidian-vault-that-you-have) tells you how to connect a vault that you already use.

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

## Links

`[[deploy]]` links to the note `deploy` in any folder. To link with an alias, write `[[deploy|ship]]`. zambil also reads `[[ship]]`, but Obsidian cannot follow that link. `z:ship` in a prompt works with the alias.

zambil needs a unique name for each note in the whole folder, in any case. Obsidian allows the same name in two folders. `docs/notes.md` describes the names in [Names](notes.md#names).
