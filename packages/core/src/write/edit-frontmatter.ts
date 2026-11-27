/** A top-level property and its YAML lines, or the lines between properties, such as a comment. */
export interface YamlBlock {
  key?: string;
  text: string;
}

/** One change to a top-level property: replace or add its YAML lines, or remove them. */
export type PropertyEdit =
  | { kind: "set"; key: string; text: string }
  | { kind: "remove"; key: string };

const keyLine = /^(?<key>"[^"]*"|'[^']*'|[^\s#'"-][^:]*?)[ \t]*:(?:[ \t]|\r?\n|$)/;

function keyOf(line: string): string | undefined {
  const key = keyLine.exec(line)?.groups?.key;
  if (key === undefined) return undefined;
  const isQuoted = key.startsWith('"') || key.startsWith("'");
  return isQuoted ? key.slice(1, -1) : key;
}

/**
 * Splits frontmatter YAML into one block per top-level property. A property starts at a line with a
 * key in the first column. The indented lines and `- item` lines after it belong to it.
 */
export function splitYamlBlocks(yaml: string): YamlBlock[] {
  const blocks: YamlBlock[] = [];
  const lines = yaml.split(/(?<=\n)/);
  for (const line of lines) {
    if (line === "") continue;
    const key = keyOf(line);
    const last = blocks.at(-1);
    const isContinuation = /^[\s-]/.test(line) && last?.key !== undefined;
    if (key === undefined && isContinuation) {
      last.text += line;
      continue;
    }
    blocks.push(key === undefined ? { text: line } : { key, text: line });
  }
  return blocks;
}

function withLineEnd(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

/** The changes to apply, in order. */
export interface EditFrontmatterOptions {
  edits: PropertyEdit[];
}

/**
 * Applies each edit to frontmatter YAML line by line. Every other line stays as it was, so that the
 * user's own formatting survives. A new property goes at the end.
 */
export function editFrontmatter(yaml: string, options: EditFrontmatterOptions): string {
  const blocks = splitYamlBlocks(yaml);
  for (const edit of options.edits) {
    const position = blocks.findIndex((block) => block.key === edit.key);
    const replacement = edit.kind === "set" ? [{ key: edit.key, text: edit.text }] : [];
    if (position === -1) blocks.push(...replacement);
    else blocks.splice(position, 1, ...replacement);
  }
  const texts = blocks.map((block) => withLineEnd(block.text));
  return texts.join("");
}
