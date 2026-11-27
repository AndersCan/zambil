import type { Command } from "./command.ts";

/**
 * Every command, one line each, sorted by name. Each loads on demand, so that a command with heavy
 * imports does not slow the others down.
 */
export const commands: Record<string, () => Promise<Command>> = {
  check: async () => (await import("./check/check-command.ts")).checkCommand,
  doctor: async () => (await import("./doctor/doctor-command.ts")).doctorCommand,
  hook: async () => (await import("./hook/hook-command.ts")).hookCommand,
  index: async () => (await import("./index/index-command.ts")).indexCommand,
  init: async () => (await import("./init/init-command.ts")).initCommand,
  install: async () => (await import("./install/install-command.ts")).installCommand,
  list: async () => (await import("./list/list-command.ts")).listCommand,
  save: async () => (await import("./save/save-command.ts")).saveCommand,
  "save-guide": async () => (await import("./save-guide/save-guide-command.ts")).saveGuideCommand,
  search: async () => (await import("./search/search-command.ts")).searchCommand,
  show: async () => (await import("./show/show-command.ts")).showCommand,
  uninstall: async () => (await import("./install/uninstall-command.ts")).uninstallCommand,
  update: async () => (await import("./update/update-command.ts")).updateCommand,
};
