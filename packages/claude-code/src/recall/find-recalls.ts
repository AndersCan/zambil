import { nameKey } from "@zambil/core/index-names";

/** One `z:<name>` in a prompt: the text as the user typed it, and the link target it names. */
export interface Recall {
  typed: string;
  target: string;
}

const codeOrRecall =
  /(?<code>```[\s\S]*?```|`[^`\n]*`)|(?<![\p{L}\p{N}/:@])z:(?:\[\[(?<bracketed>[^\]\n]+)\]\]|(?!\[\[)(?<plain>[^\s`,]+))/gu;

const trailingPunctuation = /[.;:!?)\]}"'*_]+$/;

const possessive = /['’]s$/;

function plainTarget(text: string): string {
  return text
    .replace(trailingPunctuation, "")
    .replace(possessive, "")
    .replace(trailingPunctuation, "");
}

/**
 * Finds each `z:<name>` in a prompt, once per target. `z:[[name with spaces]]` names a note with spaces,
 * and `z:deploy#Steps` a part of a note. A `z:` inside inline code or a code block is text, and so is one
 * that follows a letter, a digit or a `/`, as in `xyz:abc`. A comma ends a plain name, and so does the
 * punctuation or the possessive `'s` at its end.
 */
export function findRecalls(prompt: string): Recall[] {
  const recalls: Recall[] = [];
  const seen = new Set<string>();
  for (const match of prompt.matchAll(codeOrRecall)) {
    const groups = match.groups ?? {};
    if (groups.code !== undefined) continue;
    const plain = groups.plain === undefined ? "" : plainTarget(groups.plain);
    const target = (groups.bracketed ?? plain).trim();
    const key = nameKey(target);
    if (target === "" || seen.has(key)) continue;
    seen.add(key);
    const typed = groups.bracketed === undefined ? `z:${target}` : `z:[[${target}]]`;
    recalls.push({ typed, target });
  }
  return recalls;
}
