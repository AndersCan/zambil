/** The fields that Claude Code 2.1.332 sent with every hook in a recorded session. */
const commonFields = {
  session_id: "cb2b4f53-402c-410e-beaf-baa0b2af3da0",
  transcript_path: "/home/ada/.claude/projects/-home-ada-shop/cb2b4f53.jsonl",
  cwd: "/home/ada/shop",
  prompt_id: "240455de-a235-4fcf-a7c4-732b73376928",
  permission_mode: "default",
};

/** The fields that each hook adds, as Claude Code sent them. */
export type PayloadFields = Record<string, unknown>;

/** A hook payload as JSON text, in the shape of a recorded Claude Code session, for tests. */
export function hookPayload(hookEventName: string, fields: PayloadFields): string {
  return JSON.stringify({ ...commonFields, hook_event_name: hookEventName, ...fields });
}

/** A `PreToolUse` payload for one tool, for tests. */
export function preToolUse(toolName: string): string {
  const effort = { level: "medium" };
  const fields = { effort, tool_name: toolName, tool_input: {}, tool_use_id: "toolu_01" };
  return hookPayload("PreToolUse", fields);
}
