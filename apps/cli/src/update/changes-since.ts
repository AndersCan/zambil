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

function versionParts(version: string): number[] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match === null) return undefined;
  const [, major = "", minor = "", patch = ""] = match;
  return [Number(major), Number(minor), Number(patch)];
}

/** The version to compare with. */
export interface NewerVersionOptions {
  than: string;
}

/** Whether the version is newer than the other one. A text that is not `X.Y.Z` is never newer. */
export function isNewerVersion(version: string, options: NewerVersionOptions): boolean {
  const parts = versionParts(version);
  const others = versionParts(options.than) ?? [0, 0, 0];
  if (parts === undefined) return false;
  for (const [position, part] of parts.entries()) {
    const other = others[position] ?? 0;
    if (part !== other) return part > other;
  }
  return false;
}

/**
 * The sections of `CHANGELOG.md` that are newer than the version, newest first, without the empty
 * ones. `Unreleased` counts as newer than every version.
 */
export function changesSince(changelog: string, options: ChangesSinceOptions): string[] {
  const kept: string[] = [];
  for (const section of splitSections(changelog)) {
    const [name = ""] = section.heading.slice(3).split(" ");
    const isNewer = name === "Unreleased" || isNewerVersion(name, { than: options.version });
    const body = section.lines.join("\n").trim();
    if (isNewer && body !== "") kept.push(`${section.heading}\n\n${body}`);
  }
  return kept;
}
