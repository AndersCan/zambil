/** The hook that runs. Claude Code requires its name in `hookEventName`. */
export interface FormatHookOutputOptions {
  hookEventName: string;
}

/** The one JSON object on standard output that every context hook in the Claude Code hooks reference reads. */
export function formatHookOutput(
  additionalContext: string,
  options: FormatHookOutputOptions,
): string {
  const hookSpecificOutput = { hookEventName: options.hookEventName, additionalContext };
  const json = JSON.stringify({ hookSpecificOutput });
  return `${json}\n`;
}
