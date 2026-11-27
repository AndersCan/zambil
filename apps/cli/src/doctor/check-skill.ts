import type { CheckResult } from "./check-result.ts";
import type { CliConfig } from "../config.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { readOptionalText } from "../install/text-file.ts";
import { saveSkillPath } from "../install/claude-paths.ts";
import { saveSkillText } from "@zambil/claude-code/save-skill";
import { zambilCommand } from "./zambil-command.ts";

/** The repo that the skill must name, when it is known, and the `--repo` flag for the fix command. */
export interface CheckSkillOptions {
  config: CliConfig;
  repo: ConfigurationRepo | undefined;
  repoFlag: string | undefined;
}

/** Whether the zambil-save skill is installed and matches what install writes now. */
export async function checkSkill(options: CheckSkillOptions): Promise<CheckResult> {
  const { repo } = options;
  const path = saveSkillPath(options.config);
  const install = zambilCommand("install", options);
  const text = await readOptionalText(path);
  if (!text.ok) return { level: "fail", text: `zambil ${text.error}.` };
  if (text.value === undefined) {
    const missing = `The zambil-save skill is not installed: ${path} does not exist. The agent cannot save a note.`;
    return { level: "fail", text: missing, fixes: [install] };
  }
  if (repo === undefined) {
    return {
      level: "skip",
      text: `The zambil-save skill is in ${path}. zambil cannot compare it without the notes folder.`,
    };
  }
  if (text.value === saveSkillText({ repoRoot: repo.root })) {
    return { level: "ok", text: `The zambil-save skill in ${path} is up to date.` };
  }
  const why = text.value.includes(repo.root)
    ? "It comes from an older zambil."
    : `It names another notes folder than ${repo.root}.`;
  return {
    level: "fail",
    text: `The zambil-save skill in ${path} differs from what zambil install writes now.`,
    details: [why],
    fixes: [install],
  };
}
