/** The YAML between the opening and closing `---` lines, and the Markdown after it. */
export interface SplitNote {
  frontmatter?: string;
  content: string;
}

const frontmatterPattern = /^---[ \t]*\r?\n(?<yaml>(?:.*\r?\n)*?)---[ \t]*(?:\r?\n|$)/;

/**
 * Splits a note the way Obsidian does: frontmatter starts on the first line with `---` and ends at the
 * next `---` line. Without the closing line, the whole text is content.
 */
export function splitFrontmatter(text: string): SplitNote {
  const withoutBom = text.startsWith("﻿") ? text.slice(1) : text;
  const match = frontmatterPattern.exec(withoutBom);
  if (match === null) return { content: withoutBom };
  return { frontmatter: match.groups?.yaml ?? "", content: withoutBom.slice(match[0].length) };
}
