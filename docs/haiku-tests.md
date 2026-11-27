# Haiku tests

These are short headless Claude Code sessions with the zambil hooks installed. They show how a small, cheap model acts on what zambil adds to its context. They are not automated tests. They are a record of one afternoon of runs, on 2026-11-27.

## Setup

- Claude Code 2.1.332, `claude -p --model haiku` (`claude-haiku-5-5`), `--permission-mode bypassPermissions`, `--max-turns 12`.
- A temporary `HOME`, a fresh clone of `main` at 1876a08, and the setup steps of the root `README.md`. `zambil install` downloaded the model into an empty cache.
- A configuration repo of 10 notes, made for these runs:

  | Note             | Kind   | How it can reach the agent                               |
  | ---------------- | ------ | -------------------------------------------------------- |
  | `preferences`    | note   | `hooks: [SessionStart]`: "uses pnpm, never npm or yarn". |
  | `shell-style`    | note   | `hooks: [PreToolUse]`, `tools: [Bash]`.                  |
  | `for-loops`      | note   | Similarity: "How to write for loops in TypeScript."      |
  | `deploy`         | note   | `z:deploy` or the alias `z:ship`.                        |
  | `billing-module` | note   | Expired on 2026-10-01. `when-expired: check-billing`.    |
  | `auth-module`    | note   | Current until 2027-03-01. `when-expired: check-auth`.    |
  | `check-billing`  | note   | The when-expired note of `billing-module`.               |
  | `check-auth`     | note   | The when-expired note of `auth-module`.                  |
  | `changelog`      | skill  | Similarity: "Write a changelog entry."                   |
  | `disk-report`    | script | Similarity: "Report how much disk space the home uses."  |

- The project folder was empty apart from a `README.md`. So no code was there to verify a note against.

The 25 sessions cost $0.07 together. Most took 2 to 9 seconds. Each prompt below is the prompt as typed. Case 17 ran 6 times, and each other case ran once.

The verdicts:

- Used: the agent acted on the note that zambil added.
- Good: the agent did the right thing with a warning, an offer or a write request.
- No match: zambil added nothing, and nothing was expected.
- False match: zambil added a note that does not fit the prompt.
- Partly: the result was right, but the agent took wrong steps first.
- Open: see [Flaky or open results](#flaky-or-open-results).

## Results

| #   | Prompt (short)                                           | What zambil added                         | What Haiku did                                                                                                                         | Verdict     |
| --- | -------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Which command adds lodash?                               | `preferences` at `SessionStart`           | Answered `pnpm add lodash`.                                                                                                            | Used        |
| 2   | Iterating over users in TypeScript, with the index       | `for-loops` (similar)                     | Wrote `for (const [index, user] of users.entries())`, as the note says.                                                                | Used        |
| 3   | How do I deploy? Follow `z:ship`                         | `deploy` through the alias                | Gave `make ship ENV=prod` and the warning about `make deploy`.                                                                         | Used        |
| 4   | Do what `z:deplyo` says                                  | Warning: no note has the name             | Ran `zambil list`, guessed `deploy`, read the file, and asked before a production deploy.                                              | Good        |
| 5   | What is 17 \* 23?                                        | Nothing                                   | Answered 391.                                                                                                                          | No match    |
| 6   | Two-line sourdough recipe                                | Nothing                                   | Answered.                                                                                                                              | No match    |
| 7   | Write a changelog entry for ACME-17                      | Offer of the `changelog` skill (similar)  | Read the `SKILL.md` and used its format.                                                                                               | Used        |
| 8   | How much disk space does my home folder use?             | Offer of the `disk-report` script         | Ran the script with the given command. The task needed it. zambil did not run it.                                                      | Used        |
| 9   | Explain taxes, see `z:billing-module` (expired)          | Expiry warning, and `check-billing`       | Tried to verify, then read the note with `--expired`. Said it can be out of date. Offered to save an update on request. Saved nothing. | Good        |
| 10  | How does the billing module compute taxes? (no `z:`)     | `check-billing` (similar), not the note   | The expired note stayed out. The when-expired note matched on its own, and Haiku looked for the code.                                  | Open        |
| 11  | Where does auth store sessions? See `z:auth-module`      | The note, "can be wrong", `check-auth`    | Tried to verify against the code, then answered and said that the code was not there to compare with.                                  | Good        |
| 12  | Write a bash script `hello.sh` and run it                | `shell-style` (similar and at PreToolUse) | The script starts with `set -euo pipefail` and quotes paths.                                                                           | Used        |
| 13  | Convert a JavaScript function to TypeScript              | `for-loops` (similar)                     | Ignored the note and converted the function.                                                                                           | False match |
| 14  | Write a note that we always use pnpm                     | Nothing                                   | Loaded `zambil-save`, ran the guide and the list. Saw that `preferences` says it already, and asked before a duplicate.                | Good        |
| 15  | Save a note about the payments service configuration     | Nothing                                   | Saved the when-expired note first, then the note with an expiry in six months and `--when-expired`.                                    | Good        |
| 16  | "I checked the code, `z:auth-module` is right." TTL?     | The note                                  | Answered. Did not record a verify, because the user did not ask for one.                                                               | Good        |
| 17a | "...the note is still correct. Record that." (3 runs)    | The note                                  | Ran `--verified --expires 2027-03-01`, the old date. Nothing changed, and Haiku said the note was updated.                             | Bug, fixed  |
| 17b | Same prompt, after the fix (3 runs)                      | The note                                  | Ran `--verified` with a later date: 2027-06-01 twice, 2027-05-27 once. The note changed.                                               | Good        |
| 18  | `z:billing-module` is out of date: 19%, new file. Update | Expiry warning                            | First forgot the expiry choice, then tried the old date, then stopped and asked the user for a date. Saved nothing.                    | Partly      |
| 19  | Remember that the staging database listens on port 5433  | Nothing                                   | Wrote to the Claude Code auto memory, not to zambil.                                                                                   | Open        |
| 20  | Run `ls`, quote what a hook added                        | `shell-style` at PreToolUse               | Quoted the note word for word. So the Bash tool hook reaches the agent.                                                                | Used        |

## What the runs show

- An injected note was used each time that it fit the task: at `SessionStart`, at `PreToolUse`, with `z:<name>`, and as a similar note.
- Haiku ignored the one false match (13). The prompt hook added about 300 characters for it.
- Skills and scripts were offers. Haiku loaded the skill with the Read tool and ran the script only for a task that needed it.
- Haiku never wrote a note that nobody asked for. It did not verify the note in 16, and it did not save the update that the warning offered in 9.
- When asked to write a note with claims (15), Haiku followed the guide: a when-expired note first, then an expiry date and the link.
- A note that is current but has a when-expired note made Haiku try to verify it (11). If the code is not in the project, this costs a few tool calls.

## The bug that the runs found

In case 17a, all 3 runs gave `zambil save auth-module --verified --expires 2027-03-01`. That is the date that the note already had. `zambil save` printed "Verified api/auth-module.md. It now expires on 2027-03-01." and wrote the same file. Haiku then told the user that the note was updated.

The fix:

- `zambil save --verified` refuses a date that is the same moment as the old `expires`. The message says that the verify changes nothing. It asks for the next date on which the claims are likely to change.
- `zambil save-guide` says "give it a new expires date: the date when its claims are likely to change next" for `--verified`. Before, it said "it sets the new expires date".

After the fix, 3 of 3 runs picked a later date (17b). The first 2 runs used a guide that said "a later expires date". The last run used the final wording.

The example in `zambil save-guide` also uses the date 2027-03-01. So in 17a, Haiku can have copied the example and not the old date. In its answers, Haiku said that it kept the date that the note already had. The fix refuses a copy of the example only when the note has that same date.

## Flaky or open results

- Case 10: the expired note is left out, as designed. But its when-expired note `check-billing` has a similar description, so it matched. The agent then learned the old file path from it. This does not break the rule "expired content is never shown as current", because `check-billing` is a current note. A when-expired note with a description such as "How to verify the billing module note" will often match prompts about that topic. Since issue #22, item 4, a when-expired note that names no hook is not a similar note, so this case no longer matches.
- Case 18: Haiku made two wrong `zambil save` calls before it asked for a date. zambil refused both and changed no file. The messages were clear. A first try without the expiry choice is a small cost, and it did not lead to a wrong save.
- Case 19: "Remember" went to the auto memory of Claude Code, not to zambil. The `zambil-save` skill matches "write, save, change or verify a note". Whether "remember" must go to zambil is a choice for the user, not a bug.
- In 15, Haiku picked an expiry date on its own and said that the user can change it. In 18, it asked the user for the date. Both are within the guide.
- The runs shared one project folder. Run 12 wrote `hello.sh` there, and later runs saw it. It did not change their result.
- Each case ran once, except 17. So a result in the table can be different on a second run.
