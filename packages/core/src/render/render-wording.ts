/** A skill to offer. `path` is the full path of its `SKILL.md`. */
export interface SkillOffer {
  name: string;
  path: string;
}

/**
 * The words that depend on the agent tool. Each returns one whole sentence about a link target such as
 * `deploy#Steps`, or about a skill. An adapter passes its own, so that the core names no tool.
 */
export interface RenderWording {
  openNote: (target: string) => string;
  openExpired: (target: string) => string;
  loadSkill: (skill: SkillOffer) => string;
}
