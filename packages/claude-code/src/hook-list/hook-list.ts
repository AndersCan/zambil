/** The page that the hook list comes from, in its Markdown form. */
export const hooksReferenceUrl = "https://code.claude.com/docs/en/hooks.md";

/**
 * The Claude Code hooks, as the hooks reference lists them on the day `readOn`. `contextHooks` are the
 * hooks that can add text to the context of the agent, a subset of `hooks`.
 */
export interface HookList {
  source: string;
  readOn: string;
  hooks: string[];
  contextHooks: string[];
}
