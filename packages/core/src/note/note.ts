/** How zambil treats a note: plain text, a skill the agent can load, or a script the agent can run. */
export type NoteKind = "note" | "skill" | "script";

/** When a note stops being current. An unreadable `expires` value counts as expired. */
export type Expiry =
  | { kind: "never" }
  | { kind: "at"; time: Date }
  | { kind: "unreadable"; text: string };

/** Where a script note's script is, relative to the repo root, and the program that runs it. */
export interface Script {
  path: string;
  runWith?: string;
}

interface NoteFields {
  name: string;
  path: string;
  description?: string;
  aliases: string[];
  tags: string[];
  hooks: string[];
  tools: string[];
  expiry: Expiry;
  whenExpired?: string;
  properties: Record<string, unknown>;
  content: string;
}

/** A plain note: text that zambil adds to the context. */
export interface PlainNote extends NoteFields {
  kind: "note";
}

/** A `SKILL.md` file. Its name is the name of its folder. */
export interface SkillNote extends NoteFields {
  kind: "skill";
}

/** A note with a `script` property. zambil never reads the script itself. */
export interface ScriptNote extends NoteFields {
  kind: "script";
  script: Script;
}

/** One Markdown note of a configuration repo. `path` is relative to the repo root and uses `/`. */
export type Note = PlainNote | SkillNote | ScriptNote;
