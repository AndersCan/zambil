/**
 * The hook that runs, which Claude Code requires in `hookEventName`, and a message for the user. Claude
 * Code shows `systemMessage` to the user and keeps it out of the context of the agent.
 */
export interface FormatHookOutputOptions {
  hookEventName: string;
  systemMessage?: string;
}

/** The one JSON object on standard output that every context hook in the Claude Code hooks reference reads. */
export function formatHookOutput(
  additionalContext: string,
  options: FormatHookOutputOptions,
): string {
  const hookSpecificOutput = { hookEventName: options.hookEventName, additionalContext };
  const output: Record<string, unknown> = { hookSpecificOutput };
  if (options.systemMessage !== undefined) output.systemMessage = options.systemMessage;
  const json = JSON.stringify(output);
  return `${json}\n`;
}

/** A hook output with only a message for the user, and nothing for the context. */
export function formatSystemMessage(systemMessage: string): string {
  const json = JSON.stringify({ systemMessage });
  return `${json}\n`;
}
