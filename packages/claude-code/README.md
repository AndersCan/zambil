# @zambil/claude-code

The Claude Code adapter of zambil. Claude Code runs `zambil hook` at each hook, and the adapter adds the notes that apply to the context of the agent. `docs/notes.md` in the root of the repo describes the note format.

## What the hook adds

`zambil hook` reads the JSON that Claude Code sends to a hook on standard input. It prints one JSON object with the text to add, in the shape that the [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) requires:

```json
{ "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "..." } }
```

It adds two kinds of note:

1. Each current note whose `hooks` property names the hook that runs. At a tool hook, a note with a `tools` property applies only to those tools. A note without `tools` applies to every tool. Names compare exactly, so write `PreToolUse` and `Bash` as Claude Code writes them.
2. At `UserPromptSubmit`, each note that the user names with `z:<name>` in the prompt. See [Name a note in a prompt](#name-a-note-in-a-prompt).

Only these hooks can add context. The list comes from the hooks reference, read on 2026-11-27, and lives in `src/hook-input/context-hooks.ts`:

| Hook                                                     | What zambil reads                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `SessionStart`, `UserPromptExpansion`, `PostModelSwitch` | The hook name.                                                                                          |
| `SubagentStart`, `SubagentStop`, `Stop`                  | The hook name and `stop_hook_active`.                                                                   |
| `UserPromptSubmit`                                       | The hook name and `prompt`.                                                                             |
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure`        | The hook name and `tool_name`.                                                                          |
| `PostToolBatch`                                          | The hook name and each `tool_name` in `tool_calls`. If one tool in the batch matches, the note applies. |

At every other hook, `zambil hook` prints nothing.

A note at `Stop` or `SubagentStop` makes Claude continue the turn once, so that it can act on the note. When `stop_hook_active` is true, an earlier stop hook already made Claude continue. Then zambil prints nothing, so a note on `Stop` never makes a loop.

## Name a note in a prompt

Type `z:<name>` anywhere in a prompt, for example `Ship it the way z:deploy says`. The prompt stays as you typed it. The hook adds the note next to it.

- `z:deploy` names the note `deploy` by its name or an alias, in any case.
- `z:[[on call rota]]` names a note that has spaces in its name.
- `z:deploy#Steps` and `z:[[deploy#Steps]]` name the section under the heading `Steps`. `z:deploy#^intro` names a block.
- A comma ends a plain name. Punctuation, Markdown emphasis or a possessive `'s` at the end of a plain name is not part of it: `z:deploy.`, `**z:deploy**` and `z:deploy's` name `deploy`.
- A `z:` in inline code or in a code block is text. A `z:` after a letter, a digit or a `/`, as in `xyz:abc`, is text too. So is `z:[[` without its closing `]]`.

If no note has the name, or more than one note has it, the agent gets a warning. The warning tells it how to list the names. If the note has no such heading or block, the warning tells it how to open the note. A name that you type twice is added once. A note that the prompt names in full and that also names `UserPromptSubmit` is added once.

## Skills, scripts and expired notes

A skill is offered, not loaded. For a skill that you name with `z:<name>`, the agent is told that you opted in to it. It is also told to read the `SKILL.md` with the Read tool, because a hook cannot load a skill.

A script note gives what the script does, the full path of the script and the command that runs it. zambil never runs the script, and the source of the script never goes into the context.

An expired note is left out at a hook. For an expired note that you name with `z:<name>`, the agent gets the expiry warning in place of the content. A current note that has a `when-expired` note names it as the way to verify its claims. zambil and its hooks never write a note. An expiry warning can offer an update. The agent saves the update only on your request.

## How much text one hook adds

Claude Code saves a hook text over 10,000 characters to a file and gives the agent only a preview. So zambil keeps each text under 9,500 characters. Full notes use up to 8,000 characters, in order: first the notes that the prompt names, then the notes of the hook. Each note that does not fit is one line at the end that tells the agent how to read it with `zambil show`. When no note applies, the hook prints nothing and adds nothing.

## Configure the hooks by hand

A later version of zambil installs the hooks for you. Until then, do these steps:

1. Put `zambil` on your `PATH`, as `apps/cli/README.md` tells you. The agent also runs `zambil show` to open a linked note.
2. Tell zambil where your configuration repo is, with `ZAMBIL_REPO` or `~/.config/zambil/config.json`. See `docs/notes.md`. You can also write `zambil hook --repo <path>`. Put `--repo` after `hook`, because `zambil --repo <path> hook` is a usage error that exits with 2, and Claude Code then blocks the event.
3. Add a `hooks` entry to `~/.claude/settings.json` for each hook that your notes name:

   ```json
   {
     "hooks": {
       "SessionStart": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "NODE_COMPILE_CACHE=\"$HOME/.cache/zambil/node-compile-cache\" zambil hook",
               "timeout": 10
             }
           ]
         }
       ],
       "UserPromptSubmit": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "NODE_COMPILE_CACHE=\"$HOME/.cache/zambil/node-compile-cache\" zambil hook",
               "timeout": 10
             }
           ]
         }
       ],
       "PreToolUse": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "NODE_COMPILE_CACHE=\"$HOME/.cache/zambil/node-compile-cache\" zambil hook",
               "timeout": 10
             }
           ]
         }
       ]
     }
   }
   ```

4. Make sure that the hook finds your notes. Run this command in a terminal. It must print a JSON object with your `SessionStart` notes, or nothing if no note names `SessionStart`:

   ```sh
   echo '{"hook_event_name":"SessionStart","source":"startup"}' | zambil hook
   ```

   If it prints a message that starts with `zambil hook:`, fix that problem first.

5. Start a new Claude Code session. Claude Code reads the hooks at the start of a session.

`NODE_COMPILE_CACHE` lets Node keep the compiled code between runs. It must be set before Node starts. Leave out `matcher`: zambil filters by the `tools` of each note. A hook that you add costs one run of `zambil hook` per event, so add only the hooks that your notes name.

## The hook never blocks a session

Claude Code reads exit code 2 from a hook as a blocking error. `zambil hook` always exits with 0. Bad input, a wrong option, or a repo that zambil cannot find or read prints a message on standard error and adds nothing. Claude Code does not show that message in the session. To see it, start Claude Code with `claude --debug=hooks`, or run the command in step 4. A note with a problem still loads, and the other notes still apply. If Node itself fails, it exits with 1, and Claude Code reads that as an error that does not block.

## Speed

Each event starts a new Node process that loads the whole repo. Measured in the development container (aarch64), with 20 runs each:

| Case                                      | Without `NODE_COMPILE_CACHE` | With it      |
| ----------------------------------------- | ---------------------------- | ------------ |
| `node -e 0`, for comparison               | 10 ms                        | not measured |
| Sample repo, `UserPromptSubmit` with `z:` | 67 ms                        | 27 ms        |
| 1,000 notes, `PreToolUse`                 | 86 ms                        | 46 ms        |
| A hook that cannot add context            | not measured                 | 22 ms        |

## Code

- `src/answer-hook.ts`: `answerHook` turns a parsed hook input and a loaded repo into the standard output. `promptSections` lists the parts of the `UserPromptSubmit` text. Similar notes from the embedder will be one more part after the hook notes.
- `src/hook-input/`: the hook names, and `parseHookInput`, which reads the JSON from Claude Code.
- `src/hook-notes/`: the notes that name the hook that runs.
- `src/recall/`: `z:<name>` in a prompt.
- `src/context/`: the wording for Claude Code, the size budget and the JSON output.

The tests use payloads in the shape that Claude Code 2.1.332 sent in a recorded session, in `src/hook-input/hook-payloads.ts`.
