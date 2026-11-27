/**
 * The hooks that run around one tool call or a batch of them, with `tool_name` in their input. `tools`
 * filters the notes at these hooks. Which hooks can add context comes from the hook list.
 */
export const toolHookNames = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PostToolBatch",
] as const;

export type ToolHookName = (typeof toolHookNames)[number];
