import { isNever } from "../is-never.ts";

/** The properties that zambil reads, after the lenient forms that Obsidian accepts are normalized. */
export interface KnownProperties {
  name: string | undefined;
  description: string | undefined;
  aliases: string[];
  tags: string[];
  hooks: string[];
  tools: string[];
  expires: string | undefined;
  whenExpired: string | undefined;
  script: string | undefined;
  runWith: string | undefined;
}

/** The properties that zambil reads, and a message for each property that has the wrong shape. */
export interface PropertyReading {
  known: KnownProperties;
  problems: string[];
}

type TextReading = { kind: "text"; text: string } | { kind: "absent" } | { kind: "invalid" };

const linkPattern = /^\[\[(?<target>[^\]|#^]*)[^\]]*\]\]$/;

function readScalar(property: unknown): TextReading {
  if (property === undefined || property === null) return { kind: "absent" };
  const isScalar = typeof property === "number" || typeof property === "boolean";
  if (typeof property !== "string" && !isScalar) return { kind: "invalid" };
  const text = String(property).trim();
  if (text === "") return { kind: "absent" };
  return { kind: "text", text };
}

function linkTarget(text: string): string {
  const target = linkPattern.exec(text)?.groups?.target ?? text;
  const name = target.split("/").at(-1) ?? target;
  return name.replace(/\.md$/i, "").trim();
}

function splitText(text: string, separator: RegExp): string[] {
  const parts: string[] = [];
  for (const part of text.split(separator)) {
    const trimmed = part.trim();
    if (trimmed !== "") parts.push(trimmed);
  }
  return parts;
}

interface ReadListOptions {
  separator: RegExp;
}

function readList(property: unknown, options: ReadListOptions): string[] | undefined {
  if (typeof property === "string") return splitText(property, options.separator);
  const entries: unknown[] = Array.isArray(property) ? property : [property];
  const texts: string[] = [];
  for (const entry of entries) {
    const reading = readScalar(entry);
    switch (reading.kind) {
      case "invalid":
        return undefined;
      case "text":
        texts.push(reading.text);
        break;
      case "absent":
        break;
      default:
        return isNever(reading);
    }
  }
  return texts;
}

/**
 * Reads the known properties from parsed frontmatter. A single text counts as a list, as in Obsidian:
 * aliases split on commas, tags on commas and spaces. A property with the wrong shape is left out and
 * gets a problem message.
 */
export function readProperties(properties: Record<string, unknown>): PropertyReading {
  const problems: string[] = [];

  function list(key: string, separator: RegExp): string[] {
    const texts = readList(properties[key], { separator });
    if (texts !== undefined) return texts;
    problems.push(`\`${key}\` must be text or a list of text`);
    return [];
  }

  function text(key: string): string | undefined {
    const reading = readScalar(properties[key]);
    switch (reading.kind) {
      case "text":
        return reading.text;
      case "invalid":
        problems.push(`\`${key}\` must be text`);
        return undefined;
      case "absent":
        return undefined;
      default:
        return isNever(reading);
    }
  }

  const whenExpired = text("when-expired");
  const known: KnownProperties = {
    name: text("name"),
    description: text("description"),
    aliases: list("aliases", /,/),
    tags: list("tags", /[,\s]+/).map((tag) => tag.replace(/^#/, "")),
    hooks: list("hooks", /,/),
    tools: list("tools", /,/),
    expires: text("expires"),
    whenExpired: whenExpired === undefined ? undefined : linkTarget(whenExpired),
    script: text("script"),
    runWith: text("run-with"),
  };
  return { known, problems };
}
