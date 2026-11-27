import type { Command } from "./command.ts";

/**
 * Every command, one line each, sorted by name. Each loads on demand, so that a command with heavy
 * imports does not slow the others down.
 */
export const commands: Record<string, () => Promise<Command>> = {
  check: async () => (await import("./check/check-command.ts")).checkCommand,
  list: async () => (await import("./list/list-command.ts")).listCommand,
  save: async () => (await import("./save/save-command.ts")).saveCommand,
  "save-guide": async () => (await import("./save-guide/save-guide-command.ts")).saveGuideCommand,
  show: async () => (await import("./show/show-command.ts")).showCommand,
};
