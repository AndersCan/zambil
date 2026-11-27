import type { RenderWording, SkillOffer } from "@zambil/core/render-wording";
import { dirname } from "node:path";
import { quoteArgument } from "@zambil/core/quote-argument";

/** The full path of the repo, so that each printed command reads the repo that the hook read. */
export interface ClaudeCodeWordingOptions {
  root: string;
}

/** The sentence that tells Claude how to find a note by its name, in a repo of any size. */
export function listNotes(options: ClaudeCodeWordingOptions): string {
  const root = quoteArgument(options.root);
  return `To find a note by a part of its name, run \`zambil list <part of the name> --repo ${root}\`.`;
}

/**
 * Tells Claude to open notes with `zambil show` in Bash, and to load a skill by reading its `SKILL.md`,
 * because a hook cannot load a skill and the skill is not in a folder that Claude Code scans.
 */
export function claudeCodeWording(options: ClaudeCodeWordingOptions): RenderWording {
  const repoFlag = `--repo ${quoteArgument(options.root)}`;

  function command(target: string): string {
    const quoted = quoteArgument(target);
    return `zambil show ${quoted} ${repoFlag}`;
  }

  function loadSkill(skill: SkillOffer): string {
    const folder = dirname(skill.path);
    return `To use it, read ${skill.path} with the Read tool and follow it. Paths in it are relative to ${folder}.`;
  }

  return {
    openNote: (target) => `To read [[${target}]], run \`${command(target)}\`.`,
    openExpired: (target) => `To read [[${target}]] anyway, run \`${command(target)} --expired\`.`,
    loadSkill,
  };
}
