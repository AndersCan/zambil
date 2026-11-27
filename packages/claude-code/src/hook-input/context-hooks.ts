/** The hooks that run around one tool call or a batch of them. `tools` filters the notes at these hooks. */
export const toolHookNames = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
] as const;

/**
 * Every Claude Code hook that can add text to the context, from the hooks reference at
 * code.claude.com/docs/en/hooks, read on 2026-11-27. Each takes `hookSpecificOutput.additionalContext`.
 */
export const contextHookNames = [
  "SessionStart",
  "UserPromptSubmit",
  "UserPromptExpansion",
  "PostModelSwitch",
  ...toolHookNames,
  "SubagentStart",
  "SubagentStop",
  "Stop",
] as const;

export type ToolHookName = (typeof toolHookNames)[number];

export type ContextHookName = (typeof contextHookNames)[number];
