import { describe, expect, test } from "vite-plus/test";
import { hookPayload, preToolUse } from "./hook-payloads.ts";
import { parseHookInput } from "./parse-hook-input.ts";

describe("parseHookInput", () => {
  test("reads the prompt, the tool names and the plain hooks from real payload shapes", () => {
    const batch = hookPayload("PostToolBatch", {
      tool_calls: [
        {
          tool_name: "Bash",
          tool_input: { command: "echo hi" },
          tool_use_id: "a",
          tool_response: "hi",
        },
        {
          tool_name: "Read",
          tool_input: { file_path: "/a" },
          tool_use_id: "b",
          tool_response: "1\t",
        },
      ],
    });
    const parsed = [
      parseHookInput(hookPayload("SessionStart", { source: "startup" })),
      parseHookInput(hookPayload("UserPromptSubmit", { prompt: "Use z:deploy" })),
      parseHookInput(preToolUse("Bash")),
      parseHookInput(batch),
      parseHookInput(hookPayload("SubagentStart", { agent_id: "a1", agent_type: "Explore" })),
      parseHookInput(hookPayload("Stop", { stop_hook_active: false, last_assistant_message: "" })),
    ];
    expect(parsed).toEqual([
      {
        ok: true,
        value: {
          kind: "answer",
          input: { kind: "plain", hookEventName: "SessionStart", source: "startup" },
        },
      },
      {
        ok: true,
        value: {
          kind: "answer",
          input: { kind: "prompt", hookEventName: "UserPromptSubmit", prompt: "Use z:deploy" },
        },
      },
      {
        ok: true,
        value: {
          kind: "answer",
          input: { kind: "tool", hookEventName: "PreToolUse", toolNames: ["Bash"] },
        },
      },
      {
        ok: true,
        value: {
          kind: "answer",
          input: { kind: "tool", hookEventName: "PostToolBatch", toolNames: ["Bash", "Read"] },
        },
      },
      {
        ok: true,
        value: { kind: "answer", input: { kind: "plain", hookEventName: "SubagentStart" } },
      },
      { ok: true, value: { kind: "answer", input: { kind: "plain", hookEventName: "Stop" } } },
    ]);
  });

  test("ignores a hook that cannot add context, and a stop that an earlier stop hook caused", () => {
    const parsed = [
      parseHookInput(hookPayload("Notification", { message: "Claude needs your permission" })),
      parseHookInput(hookPayload("SessionEnd", { reason: "other" })),
      parseHookInput(hookPayload("Stop", { stop_hook_active: true })),
      parseHookInput(
        hookPayload("SubagentStop", { stop_hook_active: true, agent_type: "Explore" }),
      ),
    ];
    const ignore = { ok: true, value: { kind: "ignore" } };
    expect(parsed).toEqual([ignore, ignore, ignore, ignore]);
  });

  test("describes input that is not a hook payload", () => {
    const parsed = [
      parseHookInput(""),
      parseHookInput("[1]"),
      parseHookInput('{"prompt":"hi"}'),
      parseHookInput(hookPayload("UserPromptSubmit", {})),
      parseHookInput(hookPayload("PreToolUse", { tool_input: {} })),
      parseHookInput(hookPayload("PostToolBatch", {})),
    ];
    expect(parsed).toEqual([
      { ok: false, error: "the input is not JSON: Unexpected end of JSON input" },
      { ok: false, error: "the input is not a JSON object" },
      { ok: false, error: "the input has no hook_event_name" },
      { ok: false, error: "UserPromptSubmit input has no prompt" },
      { ok: false, error: "PreToolUse input has no tool_name" },
      { ok: false, error: "PostToolBatch input has no tool_calls list" },
    ]);
  });
});
