import type { ContextBlock, ContextSection } from "../context/fit-context.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { findNote } from "@zambil/core/find-note";
import { findRecalls } from "./find-recalls.ts";
import { isNever } from "@zambil/core/is-never";
import { listNotes } from "../context/claude-code-wording.ts";
import { nameKey } from "@zambil/core/index-names";
import type { Note } from "@zambil/core/note";
import { parseLinkTarget } from "@zambil/core/parse-link-target";
import type { Recall } from "./find-recalls.ts";
import type { RenderedNote } from "@zambil/core/render-note";
import { renderNote } from "@zambil/core/render-note";
import type { RenderWording } from "@zambil/core/render-wording";

/** The prompt as typed, the clock, and the wording for Claude Code. */
export interface RecallSectionOptions {
  prompt: string;
  now: Date;
  wording: RenderWording;
}

const heading =
  "zambil reads notes from the user's configuration repo. The user named these notes with z:<name> in the prompt:";

interface IntroOptions {
  rendered: RenderedNote;
  note: Note | undefined;
}

function introduce(recall: Recall, options: IntroOptions): string {
  const typed = `The user typed ${recall.typed} in the prompt`;
  switch (options.rendered.status) {
    case "shown":
      if (options.note?.kind === "skill") {
        return `${typed}, so the user opted in to the skill "${options.note.name}".`;
      }
      return `${typed}. This is the note that it names:`;
    case "expired":
      return `${typed}. The note that it names expired:`;
    case "unresolved":
      return `${typed}.`;
    default:
      return isNever(options.rendered.status);
  }
}

interface HintOptions {
  note: Note | undefined;
  wording: RenderWording;
  root: string;
}

/** A note that resolves but has no such heading or block points to the note, not to the list of names. */
function unresolvedHint(rendered: RenderedNote, options: HintOptions): string {
  if (rendered.status !== "unresolved") return "";
  const { note } = options;
  const hint =
    note === undefined ? listNotes({ root: options.root }) : options.wording.openNote(note.name);
  return ` ${hint}`;
}

/**
 * The key of a recall that shows a whole note is the note's own, so that a hook does not add the note
 * again. A part of a note, an expired note or a warning keeps the hook note.
 */
function recallKey(recall: Recall, options: IntroOptions): string {
  const isWholeNote = options.rendered.status === "shown" && !recall.target.includes("#");
  if (isWholeNote && options.note !== undefined) return nameKey(options.note.name);
  return `z:${nameKey(recall.target)}`;
}

/** Renders each `z:<name>` of the prompt. The prompt stays as typed, and this text goes next to it. */
export function recallSection(
  repo: Pick<ConfigurationRepo, "root" | "names">,
  options: RecallSectionOptions,
): ContextSection {
  const { now, wording } = options;
  const blocks: ContextBlock[] = [];
  for (const recall of findRecalls(options.prompt)) {
    const name = parseLinkTarget(`[[${recall.target}]]`);
    const lookup = findNote(repo, { name });
    const note = lookup.kind === "found" ? lookup.note : undefined;
    const rendered = renderNote(repo, { target: recall.target, now, wording });
    const intro = introduce(recall, { rendered, note });
    const hint = unresolvedHint(rendered, { note, wording, root: repo.root });
    const key = recallKey(recall, { rendered, note });
    const open = wording.openNote(recall.target);
    const pointer = `${recall.typed}: ${open}`;
    blocks.push({ key, text: `${intro}\n${rendered.text}${hint}`, pointer });
  }
  return { heading, blocks };
}
