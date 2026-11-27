/** One line of a note. Links in a `code` line are plain text, as in Obsidian. */
export type MarkdownLine =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "heading"; text: string; level: number; title: string };

const fencePattern = /^ {0,3}(?<fence>`{3,}|~{3,})/;
const headingPattern = /^ {0,3}(?<marks>#{1,6})[ \t]+(?<title>.*?)(?:[ \t]+#+)?[ \t]*$/;

interface FenceOptions {
  fence: string;
}

function closesFence(text: string, options: FenceOptions): boolean {
  const { fence } = options;
  const match = fencePattern.exec(text)?.groups?.fence;
  const isSameFence = match !== undefined && match[0] === fence[0] && match.length >= fence.length;
  return isSameFence && text.trim() === match;
}

/** Splits the text of a note into lines and marks the fenced code blocks and the ATX headings. */
export function scanLines(content: string): MarkdownLine[] {
  const lines: MarkdownLine[] = [];
  let openFence: string | undefined = undefined;
  for (const text of content.split("\n")) {
    if (openFence !== undefined) {
      lines.push({ kind: "code", text });
      if (closesFence(text, { fence: openFence })) openFence = undefined;
      continue;
    }
    const fence = fencePattern.exec(text)?.groups?.fence;
    if (fence !== undefined) {
      openFence = fence;
      lines.push({ kind: "code", text });
      continue;
    }
    const heading = headingPattern.exec(text)?.groups;
    if (heading === undefined) {
      lines.push({ kind: "text", text });
      continue;
    }
    const level = (heading.marks ?? "").length;
    lines.push({ kind: "heading", text, level, title: heading.title ?? "" });
  }
  return lines;
}
