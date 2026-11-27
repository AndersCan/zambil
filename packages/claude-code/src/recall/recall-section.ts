import type { ContextBlock, ContextSection } from "../context/fit-context.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { findNote } from "@zambil/core/find-note";
import { findRecalls } from "./find-recalls.ts";
import { isNever } from "@zambil/core/is-never";
import { nameKey } from "@zambil/core/index-names";
import type { Note } from "@zambil/core/note";
import { parseLinkTarget } from "@zambil/core/parse-link-target";
import { quoteArgument } from "@zambil/core/quote-argument";
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

/** The notes that the prompt named, and the `nameKey` of each, so that a hook does not add them twice. */
export interface RecallSection {
  section: ContextSection;
  recalled: Set<string>;
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

function listHint(repo: Pick<ConfigurationRepo, "root">): string {
  const root = quoteArgument(repo.root);
  return `To see the name of every note, run \`zambil list --repo ${root}\`.`;
}

/** Renders each `z:<name>` of the prompt. The prompt stays as typed, and this text goes next to it. */
export function recallSection(
  repo: Pick<ConfigurationRepo, "root" | "names">,
  options: RecallSectionOptions,
): RecallSection {
  const { now, wording } = options;
  const blocks: ContextBlock[] = [];
  const recalled = new Set<string>();
  for (const recall of findRecalls(options.prompt)) {
    const name = parseLinkTarget(`[[${recall.target}]]`);
    const lookup = findNote(repo, { name });
    const note = lookup.kind === "found" ? lookup.note : undefined;
    if (note !== undefined) recalled.add(nameKey(note.name));
    const rendered = renderNote(repo, { target: recall.target, now, wording });
    const intro = introduce(recall, { rendered, note });
    const hint = rendered.status === "unresolved" ? ` ${listHint(repo)}` : "";
    const open = wording.openNote(recall.target);
    blocks.push({ text: `${intro}\n${rendered.text}${hint}`, pointer: `${recall.typed}: ${open}` });
  }
  return { section: { heading, blocks }, recalled };
}
