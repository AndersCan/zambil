import { quoteArgument } from "../quote-argument.ts";
import type { RenderWording } from "@zambil/core/render-note";

/** The `--repo` flag that the user gave, so that each printed command reads the same repo. */
export interface ShowWordingOptions {
  repo: string | undefined;
}

/** Tells the agent to open notes with `zambil show`, the one way the CLI offers. */
export function showWording(options: ShowWordingOptions): RenderWording {
  const repoFlag = options.repo === undefined ? "" : ` --repo ${quoteArgument(options.repo)}`;

  function command(target: string): string {
    const quoted = quoteArgument(target);
    return `zambil show ${quoted}${repoFlag}`;
  }

  return {
    openNote: (target) => `To read it, run \`${command(target)}\`.`,
    openExpired: (target) => `To read it anyway, run \`${command(target)} --expired\`.`,
    loadSkill: (name) => `To use it, load the skill ${JSON.stringify(name)}.`,
  };
}
