# zambil - Vision

## What it is

A zambil is a magic bag that you can pull anything out of. zambil is a CLI
that feeds an agent the right notes at the right time. You keep your notes,
skills, instructions and scripts in your own private configuration repo.
zambil reads that repo and adds the matching notes to the agent's context. A
note matches at a hook that it names. A note that you name in a prompt also
matches. So does a note that is similar to what you ask.

zambil stores notes, not memories. A note is a Markdown file that you wrote
and can read.

## Who it is for

A person who uses Claude Code and wants their own setup in every session. They
want to write a note once and see it show up at the right time. They do not
want to copy text into prompts. They want to read and organize their notes in a
normal editor, and Obsidian in particular.

Claude Code comes first. Other agent tools must be able to use zambil too.

## Goal

A note in a configuration repo reaches the agent's context in three ways. It
comes in at the hook that the note names. It comes in after the user types
`z:<name>`. It comes in as a similar note to the prompt. Each way is fast
enough to run on every prompt.

## Visions

What the maintainer wants zambil to be, in order. Each one is worked toward in
small, visible steps.

1. **Hooks inject notes.** A note names the hooks where it applies. Examples
   are session start, subagent start, and the moment before a given tool runs.
   At each hook, zambil adds the matching notes to the context.
2. **`z:<name>` recalls a note.** `z:<name>` works anywhere in a prompt. The
   prompt stays as typed, and a hook adds the note's content next to it. For
   an unknown name, the agent gets a clear warning.
3. **Similar notes are found.** An embedder (a model that turns text into
   vectors, so that similar meanings are close) matches the prompt against
   note descriptions. A question about iterating can find a note about for
   loops. `zambil search <text>` runs the same match from the CLI.
4. **Skills and scripts are offered, not forced.** A skill can match by name
   or by similarity. Then the agent is told that the user opted in, and how to
   load the skill. A hook cannot load a skill itself. For a script, the agent
   is told what it does, where it is and how to run it.
5. **Notes can be a cache.** A note can expire. Example: a note holds today's
   date and expires tomorrow, so the agent knows the day without work. A note
   can name a "when expired" note that tells how to rebuild it. A command
   saves the refreshed content.
6. **The repo opens in Obsidian.** A user opens their configuration repo in
   Obsidian and gets its features. They search for every note on a given hook,
   see the options, and follow links.

## Invariants (not ranked)

Not trade-offs. Nothing is traded against them.

**Names are unique.** The filename is the note's name. No two notes share a
name, an alias or a mix of both, in any folder. This is a stated exception to
the Obsidian rule below. Obsidian allows the same name in two folders.

**Expired content is never shown as current.** An expired note is left out of
search, hook injection and similarity matches. A link, an embed or a
`z:<name>` that points to it gives a warning in place of the content. The
agent can read it anyway or skip it. A note can have a "when expired" note.
Then the warning links to it.

**Nothing runs because it matched.** A match adds text to the context. It
never runs a script. Script source is not added to the context.

**The user's content stays in the user's repo.** zambil holds no notes. It
reads the configuration repo that the user points it at.

**It works on the user's machine.** The embedder runs locally with ONNX.
zambil installs or downloads its model. It does not depend on files that only
exist in a development image.

## Decision principles

Ranked for trade-offs, highest first. For a design review, use these.

1. **Fast enough for every prompt.** zambil runs on each prompt, so any time
   it adds must be worth it. Clearly better results are worth a few more
   milliseconds. Measure both the time and the value before you set a number.
   Indexing can be slow: it embeds the notes ahead of time.
   _If this conflicts with match quality, measure both. Unless the better
   result is clear, speed wins._
   Example: there is no fixed limit such as 200 ms. If loading the model on
   each prompt is too slow, use a smaller model or keep it running in the
   background. A reranker (a second model that reorders matches) stays out
   unless it earns its time.
2. **If Obsidian supports it, zambil supports it.** Built-in Obsidian features
   work by default: properties, tags, aliases, `[[links]]`, heading links and
   `![[embeds]]`. Each exception needs a good reason, and unique names are
   one. Community plugins are decided one at a time.
   _If this conflicts with a simpler format of zambil's own, Obsidian wins._
   Humans can then review what they saved in a tool they know.
3. **Neutral core, thin adapters.** The core does not depend on one agent
   tool. A thin adapter connects it to Claude Code. For now, notes use Claude
   Code's hook names.
   _If this conflicts with a Claude Code feature, the adapter gets it._
4. **Plain properties before smart ones.** A note's properties say when it
   applies: `description`, `hooks`, `tools`, `expires`. Search matches the
   description. A second description for the LLM can come later.
   _If this conflicts with match quality, a test decides._ A new property
   comes only after the plain description fails that test.

## How notes connect

- `[[name]]` brings in only the linked note's name and description. The agent
  can then open the note.
- `![[name]]` includes the full content of the note, with the same expiry rules.
- A note that points to an expired note gets the expiry warning, not the old
  content.

## Hooks

zambil reads the hook names that Claude Code defines and applies the notes that
name them. Not every hook can add text to the agent's context. The Claude Code
hooks reference (code.claude.com/docs/en/hooks, read November 2026) lists
these hooks that can:

- `SessionStart`, `UserPromptSubmit`, `UserPromptExpansion`, `PostModelSwitch`
- `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`
- `SubagentStart`, `SubagentStop`, `Stop`

`UserPromptSubmit` gets the prompt text but cannot change it. So `z:<name>`
adds content next to the prompt. zambil warns about a note that names a hook
that cannot add context. The list changes with Claude Code. zambil reads it
from the current documentation, not from this file.

## Direction of travel / success

- A user writes a note and opens the repo in Obsidian. The note shows up in
  the next session where it applies.
- `z:<name>` and similarity matches feel instant, and the time they take is
  measured.
- A test on prose picks the embedder. Example: "iterating" finds a note about
  for loops. A code embedder is not chosen without this test.
- A second agent tool can use the core with no change to the core.

## Relationship to the others

zambil stands alone. It drives the user's private configuration repo and
depends on no other repo.

## Open questions

- Who writes notes? Is it only the user, or also the agent on request? The agent
  refreshing an expired cache note is the one case that is decided.

## What we will not do

**No memory store.** zambil does not record what the agent learns on its own.
It serves notes.

**No shared names.** Two notes with the same name are an error, not a choice.

**No content in this repo.** User notes, skills and scripts live in the user's
configuration repo.
