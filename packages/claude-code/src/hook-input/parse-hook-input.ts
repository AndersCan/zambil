import { left, right } from "@zambil/core/either";
import { asRecord } from "@zambil/core/as-record";
import { bundledHookList } from "../hook-list/load-hook-list.ts";
import type { Either } from "@zambil/core/either";
import type { ToolHookName } from "./context-hooks.ts";
import { toolHookNames } from "./context-hooks.ts";

/**
 * What zambil reads from the JSON that Claude Code sends to a context hook. A `plain` hook carries
 * neither a prompt nor a tool name that zambil reads. `source` is why a `SessionStart` runs, such as
 * `startup` or `compact`.
 */
export type HookInput =
  | { kind: "plain"; hookEventName: string; source?: string }
  | { kind: "prompt"; hookEventName: "UserPromptSubmit"; prompt: string }
  | { kind: "tool"; hookEventName: ToolHookName; toolNames: string[] };

/**
 * The context window that a hook adds to: the session, and the subagent when the hook runs in one. A
 * subagent starts with a context of its own, so it has its own `agentId`.
 */
export interface HookSession {
  sessionId: string;
  agentId?: string;
}

/** The input to answer, its session, and the folder where the agent works (`cwd`), when the payload names them. */
export interface HookAnswerRequest {
  kind: "answer";
  input: HookInput;
  session?: HookSession;
  folder?: string;
}

/** `ignore`: the hook cannot add context, or adding it now would loop. zambil then prints nothing. */
export type HookRequest = HookAnswerRequest | { kind: "ignore" };

function unsafeParseJson(text: string): unknown {
  return JSON.parse(text);
}

function parseJson(text: string): Either<string, unknown> {
  try {
    return right(unsafeParseJson(text));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return left(`the input is not JSON: ${message}`);
  }
}

function isToolHookName(value: unknown): value is ToolHookName {
  return toolHookNames.includes(value as ToolHookName);
}

function batchToolNames(record: Record<string, unknown>): Either<string, string[]> {
  const calls = record.tool_calls;
  if (!Array.isArray(calls)) return left("PostToolBatch input has no tool_calls list");
  const names: string[] = [];
  for (const call of calls) {
    const name = asRecord(call)?.tool_name;
    if (typeof name === "string") names.push(name);
  }
  return right(names);
}

interface ToolInputOptions {
  hookEventName: ToolHookName;
}

function parseToolInput(
  record: Record<string, unknown>,
  options: ToolInputOptions,
): Either<string, HookRequest> {
  const { hookEventName } = options;
  if (hookEventName === "PostToolBatch") {
    const names = batchToolNames(record);
    if (!names.ok) return names;
    return right({
      kind: "answer",
      input: { kind: "tool", hookEventName, toolNames: names.value },
    });
  }
  const name = record.tool_name;
  if (typeof name !== "string") return left(`${hookEventName} input has no tool_name`);
  return right({ kind: "answer", input: { kind: "tool", hookEventName, toolNames: [name] } });
}

interface ReadRequestOptions {
  hookEventName: string;
}

function readRequest(
  record: Record<string, unknown>,
  options: ReadRequestOptions,
): Either<string, HookRequest> {
  const { hookEventName } = options;
  if (isToolHookName(hookEventName)) return parseToolInput(record, { hookEventName });
  if (hookEventName === "UserPromptSubmit") {
    const { prompt } = record;
    if (typeof prompt !== "string") return left("UserPromptSubmit input has no prompt");
    return right({ kind: "answer", input: { kind: "prompt", hookEventName, prompt } });
  }
  const isRepeatedStop = record.stop_hook_active === true;
  if (isRepeatedStop) return right({ kind: "ignore" });
  const input: HookInput = { kind: "plain", hookEventName };
  if (typeof record.source === "string") input.source = record.source;
  return right({ kind: "answer", input });
}

function readSession(record: Record<string, unknown>): HookSession | undefined {
  const { session_id: sessionId, agent_id: agentId } = record;
  if (typeof sessionId !== "string" || sessionId === "") return undefined;
  const session: HookSession = { sessionId };
  if (typeof agentId === "string" && agentId !== "") session.agentId = agentId;
  return session;
}

/** The hooks that can add context, from `loadHookList`. */
export interface ParseHookInputOptions {
  contextHooks: string[];
}

/**
 * Reads the JSON that Claude Code sends on standard input. A hook that cannot add context is `ignore`,
 * and so is a `Stop` or `SubagentStop` that runs because an earlier stop hook made Claude continue.
 * Without options, the context hooks are those of the bundled hook list.
 */
export function parseHookInput(
  text: string,
  options: ParseHookInputOptions = { contextHooks: bundledHookList.contextHooks },
): Either<string, HookRequest> {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  const record = asRecord(parsed.value);
  if (record === undefined) return left("the input is not a JSON object");
  const hookEventName = record.hook_event_name;
  if (typeof hookEventName !== "string") return left("the input has no hook_event_name");
  if (!options.contextHooks.includes(hookEventName)) return right({ kind: "ignore" });
  const request = readRequest(record, { hookEventName });
  if (!request.ok || request.value.kind === "ignore") return request;
  const answer: HookAnswerRequest = { ...request.value };
  const session = readSession(record);
  if (session !== undefined) answer.session = session;
  if (typeof record.cwd === "string" && record.cwd !== "") answer.folder = record.cwd;
  return right(answer);
}
