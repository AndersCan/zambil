import { describe, expect, test } from "vite-plus/test";
import { parseHooksReference } from "./parse-hooks-reference.ts";

/** Lines in the shape of the hooks reference on 2026-11-27, cut down to five events. */
const page = [
  "# Hooks reference",
  "",
  "| Event | When it fires |",
  "| :- | :- |",
  "| `SessionStart` | When a session begins or resumes |",
  "| `Setup` | When you start Claude Code with `--init-only` |",
  "| `UserPromptSubmit` | When a prompt is submitted |",
  "| `SubagentStop` | When a subagent finishes |",
  "| `PreModelSwitch` | Before Claude Code applies a model switch. Can block the switch |",
  "",
  "## Hook input and output",
  "",
  "#### Add context for Claude",
  "",
  "The `additionalContext` field passes a string from your hook into Claude's context window.",
  "",
  "## Hook events",
  "",
  "### SessionStart",
  "",
  "| `additionalContext` | String added to Claude's context at the start of the conversation |",
  "",
  "### Setup",
  "",
  "Setup hooks can't block. On every exit code, Claude Code discards a Setup hook's fields, such as `hookSpecificOutput.additionalContext`.",
  "",
  "### UserPromptSubmit",
  "",
  "A hook that reaches its timeout is canceled and its output, including any `additionalContext`, is discarded.",
  "",
  '    "additionalContext": "My additional context here",',
  "",
  "### SubagentStop",
  "",
  "SubagentStop hooks use the same decision control format as Stop hooks, including `hookSpecificOutput.additionalContext`, for non-error feedback.",
  "",
  "### PreModelSwitch",
  "",
  "`PreModelSwitch` accepts `allow`, `deny`, and `ask`. It doesn't accept `defer`, `updatedInput`, or `additionalContext`.",
  "",
  "## Prompt-based hooks",
  "",
  "### Setup",
  "",
  "| `additionalContext` | A later section that is not about one event |",
].join("\n");

describe("parseHooksReference", () => {
  test("lists every event of the table and the events whose section says they add context", () => {
    expect(parseHooksReference(page, { readOn: "2026-11-27" })).toEqual({
      ok: true,
      value: {
        source: "https://code.claude.com/docs/en/hooks.md",
        readOn: "2026-11-27",
        hooks: ["SessionStart", "Setup", "UserPromptSubmit", "SubagentStop", "PreModelSwitch"],
        contextHooks: ["SessionStart", "UserPromptSubmit", "SubagentStop"],
      },
    });
  });

  test("refuses a page that does not have the shape it knows", () => {
    const withoutTable = page.replace("| Event |", "| Name |");
    const withoutPrompt = page.replace('"additionalContext": "My', '"reason": "My');
    const results = [
      parseHooksReference(withoutTable, { readOn: "2026-11-27" }),
      parseHooksReference(withoutPrompt, { readOn: "2026-11-27" }),
    ];
    expect(results).toEqual([
      { ok: false, error: "the page has no table of hook events" },
      { ok: false, error: "the page does not say that UserPromptSubmit can add context" },
    ]);
  });
});
