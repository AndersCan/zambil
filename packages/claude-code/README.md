# @zambil/claude-code

The Claude Code adapter of zambil. Claude Code runs `zambil hook` at each hook, and the adapter adds the notes that apply to the context of the agent. `docs/notes.md` in the root of the repo describes the note format.

## What the hook adds

`zambil hook` reads the JSON that Claude Code sends to a hook on standard input. It prints one JSON object with the text to add, in the shape that the [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) requires:

```json
{ "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "..." } }
```

It adds three kinds of note:

1. Each current note whose `hooks` property names the hook that runs. At a tool hook, a note with a `tools` property applies only to those tools. A note without `tools` applies to every tool. Names compare exactly, so write `PreToolUse` and `Bash` as Claude Code writes them.
2. At `UserPromptSubmit`, each note that the user names with `z:<name>` in the prompt. See [Name a note in a prompt](#name-a-note-in-a-prompt).
3. At `UserPromptSubmit`, each current note whose description is similar to the prompt. See [Similar notes](#similar-notes).

Only some hooks can add context. zambil reads which ones from the hooks reference. See [The hook list](#the-hook-list). On 2026-11-27, the list was:

| Hook                                                     | What zambil reads                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `SessionStart`, `UserPromptExpansion`, `PostModelSwitch` | The hook name.                                                                                          |
| `SubagentStart`, `SubagentStop`, `Stop`                  | The hook name and `stop_hook_active`.                                                                   |
| `UserPromptSubmit`                                       | The hook name and `prompt`.                                                                             |
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure`        | The hook name and `tool_name`.                                                                          |
| `PostToolBatch`                                          | The hook name and each `tool_name` in `tool_calls`. If one tool in the batch matches, the note applies. |

At every other hook, `zambil hook` prints nothing. A new context hook in the hook list gets the notes that name it, the same as `SessionStart`.

A note at `Stop` or `SubagentStop` makes Claude continue the turn once, so that it can act on the note. When `stop_hook_active` is true, an earlier stop hook already made Claude continue. Then zambil prints nothing, so a note on `Stop` never makes a loop.

## Name a note in a prompt

Type `z:<name>` anywhere in a prompt, for example `Ship it the way z:deploy says`. The prompt stays as you typed it. The hook adds the note next to it.

- `z:deploy` names the note `deploy` by its name or an alias, in any case.
- `z:[[on call rota]]` names a note that has spaces in its name.
- `z:deploy#Steps` and `z:[[deploy#Steps]]` name the section under the heading `Steps`. `z:deploy#^intro` names a block.
- A comma ends a plain name. Punctuation, Markdown emphasis or a possessive `'s` at the end of a plain name is not part of it: `z:deploy.`, `**z:deploy**` and `z:deploy's` name `deploy`.
- A `z:` in inline code or in a code block is text. A `z:` after a letter, a digit or a `/`, as in `xyz:abc`, is text too. So is `z:[[` without its closing `]]`.

If no note has the name, or more than one note has it, the agent gets a warning. The warning tells it how to list the names. If the note has no such heading or block, the warning tells it how to open the note. A name that you type twice is added once. A note that the prompt names in full and that also names `UserPromptSubmit` is added once.

## Similar notes

At `UserPromptSubmit`, the hook finds the notes whose `description` is similar to the prompt, with the model of `packages/embed`. It adds at most 3 notes that score 0.38 or more, best first. A question about iterating finds a note about for loops. `packages/embed/README.md` says how the model and the threshold were chosen.

Run `zambil install` or `zambil index` once before you use the hook. Each downloads the model, about 23 MB, and embeds the descriptions ahead of time. Run it again after you change many descriptions.

The similar notes come after the notes that the prompt names and the notes of the hook. A note comes only once. A note that the prompt names with `z:<name>`, also in part, is not added again as a similar note. Neither is a note that the hook already added. A note that names `SessionStart` is not added either, because it is in the context for the whole session.

The hook never blocks or slows a prompt for long:

- If the model is not in the cache, the hook adds no similar notes. It does not download the model. It prints a message on standard error that tells you to run `zambil index`. With the model in the cache, the hook needs no network.
- If the index is missing or stale, the hook embeds at most 10 of the descriptions that are not in the index. It leaves out the other notes. It prints on standard error how many descriptions it left out. The hook never writes the index or a note.
- If the embedder cannot load or fails, the hook prints a message on standard error and still adds the other notes.
- A slash command, such as `/compact`, and a prompt with no letter get no search. The hook does not load the model for them.
- A very long prompt is cut: the model reads its first 256 tokens. A short reply such as "yes" or "continue" scores under the threshold.

## Skills, scripts and expired notes

A skill is offered, not loaded. For a skill that you name with `z:<name>`, the agent is told that you opted in to it. For a skill that is similar to the prompt, the agent is told that the skill matched. It is not told that you opted in. In both cases, it is also told to read the `SKILL.md` with the Read tool, because a hook cannot load a skill.

A script note gives what the script does, the full path of the script and the command that runs it. For a script that is similar to the prompt, the agent is told that zambil did not run it. zambil never runs the script, and the source of the script never goes into the context.

An expired note is left out at a hook. For an expired note that you name with `z:<name>`, the agent gets the expiry warning in place of the content. A current note that has a `when-expired` note names it as the way to verify its claims. zambil and its hooks never write a note. An expiry warning can offer an update. The agent saves the update only on your request.

## How much text one hook adds

Claude Code saves a hook text over 10,000 characters to a file and gives the agent only a preview. So zambil keeps each text under 9,500 characters. Full notes use up to 8,000 characters, in order: first the notes that the prompt names, then the notes of the hook, then the similar notes. Each note that does not fit is one line at the end that tells the agent how to read it with `zambil show`. When no note applies, the hook prints nothing and adds nothing.

## The hook list

The hook list names every Claude Code hook, and the hooks that can add context. zambil reads it from the Markdown form of the hooks reference at https://code.claude.com/docs/en/hooks.md. It reads two parts of the page:

- The table of hook events at the top of the page. Each row is a hook.
- The section of each hook. If a sentence in it names `additionalContext` and does not say that the hook ignores it, the hook can add context. `Setup` and `PreModelSwitch` name it only to say that they ignore it.

`zambil install` reads the page and keeps the list in `$XDG_CACHE_HOME/zambil/claude-code-hooks.json`, or in `~/.cache/zambil/claude-code-hooks.json`. `zambil hook` and `zambil check` read that file. If the file is missing or invalid, they use the list that ships with zambil, `src/hook-list/bundled-hook-list.json`. A hook never uses the network.

If the page does not have the shape that zambil knows, the refresh fails and keeps the old list. The page must have the table of hook events, and it must say that `UserPromptSubmit` can add context.

To update the bundled list, run `zambil install` and copy the file:

```sh
cp ~/.cache/zambil/claude-code-hooks.json packages/claude-code/src/hook-list/bundled-hook-list.json
```

`zambil check` gives a warning for each hook name in `hooks` that zambil never answers: a hook that cannot add context, or a name that is not in the list. Names compare exactly, so for `sessionstart` the warning says to write `SessionStart`.

## Install the hooks

Run `zambil install`. The root `README.md` tells you how to put `zambil` on your `PATH` first. `zambil install` does these steps:

1. It refreshes the hook list. See [The hook list](#the-hook-list).
2. It adds one hook handler to the Claude Code settings for `UserPromptSubmit`, for `SessionStart`, and for each other context hook that a note names. `SessionStart` is always there, for the warning in [The hook never blocks a session](#the-hook-never-blocks-a-session). The file is `$CLAUDE_CONFIG_DIR/settings.json`, or `~/.claude/settings.json`. A handler that is already there keeps its place, its other fields such as `timeout`, and gets the new command. A zambil handler at a hook that no note names any more goes away. The other keys and handlers stay as they are.
3. It writes the `zambil-save` skill, `skills/zambil-save/SKILL.md` in the same folder. If the user asks for a note, the skill tells the agent to run `zambil save-guide` and `zambil save`.
4. It indexes the descriptions with `@zambil/embed`, the same as `zambil index`. The first run downloads the model.

`--offline` skips steps 1 and 4. If step 1 or 4 fails, `zambil install` prints why and does the other steps. If the settings file is not valid JSON, or its `hooks` value has the wrong shape, it changes nothing and exits with 1. If `zambil` is not on the `PATH`, it prints the command that links it and exits with 2. With `--repo`, it also saves the repo in the user configuration file. At the end, it prints the problems that `zambil check` finds, and it exits with 1 if one is an error.

Each handler runs this command, with full paths:

```sh
PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/24.1.0/bin${PATH:+:$PATH} NODE_COMPILE_CACHE=/home/ada/.cache/zambil/node-compile-cache /home/ada/.local/bin/zambil hook --repo /home/ada/notes
```

`zambil` starts with `#!/usr/bin/env node`, and Claude Code can start without `node` on its `PATH`, for example when a version manager adds `node` only in the profile of your shell. So the command puts two folders first on the `PATH`: the folder of the `node` that your shell finds, and the folder of the file that it links to. The first one stays valid when Homebrew, asdf, Volta or the shims of mise change the version. If the folder itself is a link that lives only as long as one shell, as with fnm, zambil uses only the second one. The folders of nvm and of `mise activate` hold one version, so they go stale when you remove that version. Then the `PATH` of Claude Code still applies. Run `zambil install` again after you change the version of Node.

`NODE_COMPILE_CACHE` lets Node keep the compiled code between runs. It must be set before Node starts. With the full path of `zambil`, the hook does not depend on the `PATH` of Claude Code to find `zambil`. The full path of the repo makes it work from every project folder. `--repo` comes after `hook`, because `zambil --repo <path> hook` is a usage error that exits with 2, and Claude Code then blocks the event. The handler has no `matcher`, because zambil filters by the `tools` of each note. Its `timeout` is 10 seconds.

zambil knows its handlers by the words `zambil hook` in the command. `zambil uninstall` removes each such handler and the `zambil-save` skill. If zambil emptied an event or the `hooks` object, it removes that too. It keeps an event that was empty before.

To make sure that the hook finds your notes, run the command of a handler with a `SessionStart` payload. It must print a JSON object with your `SessionStart` notes. If no note names `SessionStart`, it prints nothing:

```sh
echo '{"hook_event_name":"SessionStart","source":"startup"}' | zambil hook --repo ~/notes
```

If it prints a message that starts with `zambil hook:`, fix that problem first.

## The hook never blocks a session

Claude Code reads exit code 2 from a hook as a blocking error. `zambil hook` always exits with 0. Bad input, a wrong option, or a repo that zambil cannot find or read prints a message on standard error and adds nothing. Claude Code does not show that message in the session. To see it, start Claude Code with `claude --debug=hooks`, or run the command in [Install the hooks](#install-the-hooks). A note with a problem still loads, and the other notes still apply. If Node itself fails, it exits with 1, and Claude Code reads that as an error that does not block.

At `SessionStart`, the hook also checks the setup and warns the user in one short line. Claude Code shows the `systemMessage` field to the user and keeps it out of the context. The hook warns in these cases:

- zambil cannot find or read the notes folder, for example after you moved it.
- A note names a hook that has no zambil handler in the user settings, for example after a new note. If the user settings have no zambil handler at all, the hook runs from other settings, such as those of a project, and this case gives no warning.
- zambil cannot read the user settings of Claude Code.
- A note has a description, but the model for similar notes is missing.

The warning ends with `Run zambil doctor to see the fix.` It comes when a session starts, resumes or clears, and not after `compact`. The check reads the settings file and the sizes of the two model files, so it adds a few milliseconds to `SessionStart` only. If the check itself fails, the hook gives no warning and adds its notes as before. An install from before this warning has no `SessionStart` handler, so run `zambil install` once.

## Speed

Each event starts a new Node process that loads the whole repo. Measured in the development container (aarch64), with 20 runs each:

| Case                                      | Without `NODE_COMPILE_CACHE` | With it      |
| ----------------------------------------- | ---------------------------- | ------------ |
| `node -e 0`, for comparison               | 10 ms                        | not measured |
| Sample repo, `UserPromptSubmit` with `z:` | 67 ms                        | 27 ms        |
| 1,000 notes, `PreToolUse`                 | 86 ms                        | 46 ms        |
| A hook that cannot add context            | not measured                 | 22 ms        |

The table above was measured before the similarity search. At `UserPromptSubmit`, the search loads the model in each new process. `packages/embed/measurements.md` times the whole hook from a cold start, with `NODE_COMPILE_CACHE`. On the prose repo of 20 notes, the search adds about 70 ms to a short prompt. It adds about 100 ms to a prompt of 300 words. A slash command and a prompt with no letter add nothing, because the hook does not load the model for them. `packages/embed/README.md` says why zambil has no background process that keeps the model loaded.

## Code

- `src/answer-hook.ts`: `answerHook` turns a parsed hook input, a loaded repo and the similar notes into the standard output. `promptSections` lists the parts of the `UserPromptSubmit` text.
- `src/similar/`: `findSimilarNotes` searches with the embedder and never downloads, and `similarSection` adds the matches.
- `src/hook-input/`: the tool hook names, and `parseHookInput`, which reads the JSON from Claude Code.
- `src/hook-list/`: the hook list. `parseHooksReference` reads the page, `refreshHookList` keeps the list in the cache, `loadHookList` reads it, and `checkHookNames` gives the warnings of `zambil check`.
- `src/install/`: the changes to the Claude Code settings, the hook command and the `zambil-save` skill, for `zambil install` and `zambil uninstall`.
- `src/hook-notes/`: the notes that name the hook that runs.
- `src/recall/`: `z:<name>` in a prompt.
- `src/context/`: the wording for Claude Code, the size budget and the JSON output.

The tests use payloads in the shape that Claude Code 2.1.332 sent in a recorded session, in `src/hook-input/hook-payloads.ts`.
