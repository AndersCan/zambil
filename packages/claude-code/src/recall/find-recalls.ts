import { nameKey } from "@zambil/core/index-names";

/** One `z:<name>` in a prompt: the text as the user typed it, and the link target it names. */
export interface Recall {
  typed: string;
  target: string;
}

const codeOrRecall =
  /(?<code>```[\s\S]*?```|`[^`\n]*`)|(?<=^|[\s([{"'])z:(?:\[\[(?<bracketed>[^\]\n]+)\]\]|(?<plain>[^\s`]+))/g;

const trailingPunctuation = /[.,;:!?)\]}"']+$/;

/**
 * Finds each `z:<name>` in a prompt, once per target. `z:[[name with spaces]]` names a note with spaces,
 * and `z:deploy#Steps` a part of a note. A `z:` inside inline code or a code block is text, and so is one
 * that follows a letter, as in `xyz:abc`. Punctuation at the end of a plain name ends the sentence.
 */
export function findRecalls(prompt: string): Recall[] {
  const recalls: Recall[] = [];
  const seen = new Set<string>();
  for (const match of prompt.matchAll(codeOrRecall)) {
    const groups = match.groups ?? {};
    if (groups.code !== undefined) continue;
    const plain = groups.plain?.replace(trailingPunctuation, "");
    const target = (groups.bracketed ?? plain ?? "").trim();
    const key = nameKey(target);
    if (target === "" || seen.has(key)) continue;
    seen.add(key);
    const typed = groups.bracketed === undefined ? `z:${target}` : `z:[[${target}]]`;
    recalls.push({ typed, target });
  }
  return recalls;
}
