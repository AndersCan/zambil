import { quoteArgument } from "@zambil/core/quote-argument";
import type { RenderWording } from "@zambil/core/render-wording";

/** The full path of the repo when the user named it with `--repo`, so that each printed command reads the same repo. */
export interface ShowWordingOptions {
  repo: string | undefined;
}

/** Tells the agent to open notes with `zambil show` and to read the `SKILL.md` of a skill. */
export function showWording(options: ShowWordingOptions): RenderWording {
  const repoFlag = options.repo === undefined ? "" : ` --repo ${quoteArgument(options.repo)}`;

  function command(target: string): string {
    const quoted = quoteArgument(target);
    return `zambil show ${quoted}${repoFlag}`;
  }

  return {
    openNote: (target) => `To read it, run \`${command(target)}\`.`,
    openExpired: (target) => `To read it anyway, run \`${command(target)} --expired\`.`,
    loadSkill: (skill) => `To use it, read ${skill.path} and follow it.`,
  };
}
