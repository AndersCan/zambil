import type { Command, CommandRunOptions, ExitCode } from "../command.ts";
import { rm, rmdir } from "node:fs/promises";
import { saveSkillPath, settingsPath } from "./claude-paths.ts";
import { changeSettings } from "./settings-file.ts";
import { dirname } from "node:path";
import { parseCommandArgs } from "../parse-command-args.ts";
import { readOptionalText } from "./text-file.ts";
import { sharedOptions } from "../parse-command-args.ts";
import { uninstallHooks } from "@zambil/claude-code/settings-hooks";
import { wrap } from "@zambil/core/either";

async function removeSkill(options: CommandRunOptions): Promise<void> {
  const { output } = options;
  const path = saveSkillPath(options.config);
  const before = await readOptionalText(path);
  if (before.ok && before.value === undefined) return;
  const removed = await wrap(rm(path, { force: true }));
  if (!removed.ok) {
    output.error(`zambil cannot remove ${path}: ${String(removed.error)}\n`);
    return;
  }
  await wrap(rmdir(dirname(path)));
  output.write(`Removed the zambil-save skill from ${path}.\n`);
}

async function runUninstall(options: CommandRunOptions): Promise<ExitCode> {
  const { output } = options;
  const parsed = parseCommandArgs({ args: options.args, options: sharedOptions });
  if (!parsed.ok) {
    output.error(`${parsed.error}\n${uninstallCommand.usage}\n`);
    return 2;
  }
  const path = settingsPath(options.config);
  const saved = await changeSettings(path, { change: uninstallHooks });
  if (!saved.ok) {
    output.error(`zambil changed nothing in ${path}: ${saved.error}\n`);
    return 1;
  }
  const message =
    saved.value === "changed"
      ? `Removed the zambil hooks from ${path}.`
      : `${path} has no zambil hooks.`;
  output.write(`${message}\n`);
  await removeSkill(options);
  const advice =
    saved.value === "changed" ? " Start a new Claude Code session to stop the hooks." : "";
  output.write(`zambil changed no note.${advice}\n`);
  return 0;
}

/** `zambil uninstall`: removes what `zambil install` added to Claude Code, and nothing else. */
export const uninstallCommand: Command = {
  summary: "Remove the zambil hooks and the zambil-save skill from Claude Code.",
  usage: "Usage: zambil uninstall",
  details:
    "It removes every hook that runs `zambil hook` and keeps every other setting and hook. It never changes a note.",
  run: runUninstall,
};
