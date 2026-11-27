import type { ContextBlock, ContextSection } from "../context/fit-context.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { findNote } from "@zambil/core/find-note";
import { findRecalls } from "../recall/find-recalls.ts";
import { isNever } from "@zambil/core/is-never";
import { nameKey } from "@zambil/core/index-names";
import type { Note } from "@zambil/core/note";
import { parseLinkTarget } from "@zambil/core/parse-link-target";
import { renderNote } from "@zambil/core/render-note";
import type { RenderWording } from "@zambil/core/render-wording";

/** The notes that matched the prompt, best first, the prompt as typed, the clock and the wording. */
export interface SimilarSectionOptions {
  notes: Note[];
  prompt: string;
  now: Date;
  wording: RenderWording;
}

type SectionRepo = Pick<ConfigurationRepo, "root" | "names">;

const heading =
  "zambil reads notes from the user's configuration repo. The description of each of these notes is similar to the prompt. The user did not name them, so use one only if it fits the task:";

interface RecalledOptions {
  prompt: string;
}

/** Each note that the prompt names with `z:<name>`, also in part, so that a match does not add it again. */
function recalledNotes(repo: SectionRepo, options: RecalledOptions): Set<string> {
  const keys = new Set<string>();
  for (const recall of findRecalls(options.prompt)) {
    const lookup = findNote(repo, { name: parseLinkTarget(`[[${recall.target}]]`) });
    if (lookup.kind === "found") keys.add(nameKey(lookup.note.name));
  }
  return keys;
}

function introduce(note: Note): string {
  switch (note.kind) {
    case "note":
      return "";
    case "skill":
      return `The skill "${note.name}" matched the prompt. The user did not opt in to it, so load it only if it fits the task.\n`;
    case "script":
      return `The script "${note.name}" matched the prompt. zambil did not run it. Run it only if the task needs it.\n`;
    default:
      return isNever(note);
  }
}

/**
 * The notes whose description is similar to the prompt, as blocks for the context. A skill is offered
 * as a match, not as an opt-in, and a script is offered, never run. A note that the prompt names is
 * left out, and `fitContext` leaves out a note that a hook already added.
 */
export function similarSection(repo: SectionRepo, options: SimilarSectionOptions): ContextSection {
  const { now, wording } = options;
  const recalled = recalledNotes(repo, options);
  const blocks: ContextBlock[] = [];
  for (const note of options.notes) {
    const key = nameKey(note.name);
    if (recalled.has(key)) continue;
    const rendered = renderNote(repo, { target: note.name, now, wording });
    if (rendered.status !== "shown") continue;
    const description = note.description?.replaceAll(/\s*\n\s*/g, " ") ?? "";
    const open = wording.openNote(note.name);
    const pointer = `[[${note.name}]]: ${description} ${open}`;
    const intro = introduce(note);
    blocks.push({ key, text: `${intro}${rendered.text}`, pointer });
  }
  return { heading, blocks };
}
