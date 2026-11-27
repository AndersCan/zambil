/** One note for the context: its full text, and one line that tells how to read it if the text does not fit. */
export interface ContextBlock {
  text: string;
  pointer: string;
}

/** Blocks under one heading. A heading with no block that fits is left out. */
export interface ContextSection {
  heading: string;
  blocks: ContextBlock[];
}

/**
 * Claude Code saves a hook text over 10,000 characters to a file and shows only a preview, so zambil
 * stays below it. Full notes take up to `full`, and the list of the notes that did not fit up to `total`.
 */
export interface ContextBudget {
  full: number;
  total: number;
}

/** Leaves room for the list of notes that did not fit. */
export const defaultBudget: ContextBudget = { full: 8000, total: 9500 };

/** How many characters the text can use. */
export interface FitContextOptions {
  budget: ContextBudget;
}

const paragraphBreak = 2;

const leftOutLead = "These notes match too, but zambil left them out to keep the context short:";

interface LeftOutOptions extends FitContextOptions {
  used: number;
}

function leftOutList(pointers: string[], options: LeftOutOptions): string {
  if (pointers.length === 0) return "";
  const lines = [leftOutLead];
  let used = options.used + leftOutLead.length;
  let listed = 0;
  for (const pointer of pointers) {
    const cost = pointer.length + 3;
    if (used + cost > options.budget.total - 100) break;
    lines.push(`- ${pointer}`);
    used += cost;
    listed += 1;
  }
  const unlisted = pointers.length - listed;
  if (unlisted > 0) lines.push(`- ${unlisted} more notes are not listed.`);
  return lines.join("\n");
}

/**
 * Joins the sections into one text for the context, in order, so that the first blocks win the room.
 * A block that does not fit becomes its pointer in a list at the end. No block gives an empty text.
 */
export function fitContext(sections: ContextSection[], options: FitContextOptions): string {
  const parts: string[] = [];
  const pointers: string[] = [];
  let used = 0;
  for (const section of sections) {
    let hasHeading = false;
    for (const block of section.blocks) {
      const headingCost = hasHeading ? 0 : section.heading.length + paragraphBreak;
      const cost = block.text.length + paragraphBreak + headingCost;
      if (used + cost > options.budget.full) {
        pointers.push(block.pointer);
        continue;
      }
      if (!hasHeading) parts.push(section.heading);
      hasHeading = true;
      parts.push(block.text);
      used += cost;
    }
  }
  const leftOut = leftOutList(pointers, { ...options, used });
  if (leftOut !== "") parts.push(leftOut);
  return parts.join("\n\n");
}
