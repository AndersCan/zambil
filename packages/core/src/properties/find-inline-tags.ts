const codePattern =
  /^(?<fence>`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\k<fence>[^\n]*$|(?![\s\S]))|`[^`\n]*`/gm;
const tagPattern = /(?<=^|\s)#(?<tag>[\p{L}\p{N}_/-]+)/gu;
const digitsOnly = /^\d+$/;

/**
 * Finds the `#tags` in a note's Markdown, as Obsidian does: a tag follows a space or a line start, holds
 * letters, digits, `_`, `-` and `/`, and is not only digits. Tags in code are skipped.
 */
export function findInlineTags(content: string): string[] {
  const prose = content.replace(codePattern, " ");
  const tags: string[] = [];
  for (const match of prose.matchAll(tagPattern)) {
    const tag = match.groups?.tag;
    if (tag !== undefined && !digitsOnly.test(tag)) tags.push(tag);
  }
  return tags;
}
