import type { CliConfig } from "../config.ts";
import { join } from "node:path";
import { saveSkillName } from "@zambil/claude-code/save-skill";

/** The Claude Code folder: `CLAUDE_CONFIG_DIR`, or `~/.claude`, the same as Claude Code reads. */
function claudeFolder(config: CliConfig): string {
  return config.claudeConfigFolder ?? join(config.environment.home, ".claude");
}

/** The user settings of Claude Code, where the hooks go. */
export function settingsPath(config: CliConfig): string {
  return join(claudeFolder(config), "settings.json");
}

/** The `SKILL.md` of the skill that tells the agent how to write a note. */
export function saveSkillPath(config: CliConfig): string {
  return join(claudeFolder(config), "skills", saveSkillName, "SKILL.md");
}
