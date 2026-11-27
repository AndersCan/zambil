/** The version that the clone had before the update, such as `0.1.0`. */
export interface ChangesSinceOptions {
  version: string;
}

interface Section {
  heading: string;
  lines: string[];
}

function splitSections(changelog: string): Section[] {
  const sections: Section[] = [];
  for (const line of changelog.split("\n")) {
    if (line.startsWith("## ")) sections.push({ heading: line, lines: [] });
    else sections.at(-1)?.lines.push(line);
  }
  return sections;
}

/**
 * The sections of `CHANGELOG.md` that are newer than the version, newest first, without the empty
 * ones. It stops at the section of the version, so a version that has none gives every section.
 */
export function changesSince(changelog: string, options: ChangesSinceOptions): string[] {
  const kept: string[] = [];
  for (const section of splitSections(changelog)) {
    const [name = ""] = section.heading.slice(3).split(" ");
    if (name === options.version) break;
    const body = section.lines.join("\n").trim();
    if (body !== "") kept.push(`${section.heading}\n\n${body}`);
  }
  return kept;
}
