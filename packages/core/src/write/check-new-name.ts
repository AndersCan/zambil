import { left, right } from "../either.ts";
import type { Either } from "../either.ts";
import { nameKey } from "../repo/index-names.ts";

const forbiddenCharacters = /[\\/:*"<>?#^[\]|]/;

/**
 * Makes sure that a name can be the filename of a new note that Obsidian can link to. A `SKILL` note is
 * refused, because that file makes its folder a skill.
 */
export function checkNewName(name: string): Either<string, string> {
  if (name.trim() === "") return left("The note needs a name.");
  if (name.trim() !== name) return left(`The name "${name}" starts or ends with a space.`);
  if (name.startsWith(".")) {
    return left(`zambil skips a file whose name starts with ".", such as "${name}".`);
  }
  if (/\.md$/i.test(name)) {
    const withoutExtension = name.slice(0, -".md".length);
    return left(`Give the name without ".md": "${withoutExtension}".`);
  }
  if (forbiddenCharacters.test(name)) {
    return left(
      `The name "${name}" has a character that a filename or an Obsidian link cannot have: \\ / : * " < > ? # ^ [ ] |`,
    );
  }
  if (nameKey(name) === "skill") {
    return left("A SKILL.md file makes a skill folder. zambil does not create skills.");
  }
  return right(name);
}
