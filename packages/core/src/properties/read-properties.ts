import { isNever } from "../is-never.ts";
import { parseLinkTarget } from "./parse-link-target.ts";

/** The properties that zambil reads, after the lenient forms that Obsidian accepts are normalized. */
export interface KnownProperties {
  name: string | undefined;
  description: string | undefined;
  aliases: string[];
  tags: string[];
  hooks: string[];
  tools: string[];
  projects: string[];
  paths: string[];
  triggers: string[];
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

const unquotedLinkMessage = '`when-expired` must be text; put a link in quotes: "[[name]]"';

type TextReading = { kind: "text"; text: string } | { kind: "absent" } | { kind: "invalid" };

function readScalar(property: unknown): TextReading {
  if (property === undefined || property === null) return { kind: "absent" };
  const isScalar = typeof property === "number" || typeof property === "boolean";
  if (typeof property !== "string" && !isScalar) return { kind: "invalid" };
  const text = String(property).trim();
  if (text === "") return { kind: "absent" };
  return { kind: "text", text };
}

function splitText(text: string, separator: RegExp): string[] {
  const parts: string[] = [];
  for (const part of text.split(separator)) {
    const trimmed = part.trim();
    if (trimmed !== "") parts.push(trimmed);
  }
  return parts;
}

/** What splits a single text into items. Without a separator, a single text is one item. */
interface ReadListOptions {
  separator?: RegExp;
}

function readList(property: unknown, options: ReadListOptions): string[] | undefined {
  if (typeof property === "string" && options.separator !== undefined) {
    return splitText(property, options.separator);
  }
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
 * aliases split on commas, tags on commas and spaces. A trigger is a prompt, so it keeps its commas. A property with the wrong shape is left out and
 * gets a problem message.
 */
export function readProperties(properties: Record<string, unknown>): PropertyReading {
  const problems: string[] = [];

  function list(key: string, options: ReadListOptions): string[] {
    const texts = readList(properties[key], options);
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
        problems.push(key === "when-expired" ? unquotedLinkMessage : `\`${key}\` must be text`);
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
    aliases: list("aliases", { separator: /,/ }),
    tags: list("tags", { separator: /[,\s]+/ }).map((tag) => tag.replace(/^#/, "")),
    hooks: list("hooks", { separator: /,/ }),
    tools: list("tools", { separator: /,/ }),
    projects: list("projects", { separator: /,/ }),
    paths: list("paths", { separator: /,/ }),
    triggers: list("triggers", {}),
    expires: text("expires"),
    whenExpired: whenExpired === undefined ? undefined : parseLinkTarget(whenExpired),
    script: text("script"),
    runWith: text("run-with"),
  };
  return { known, problems };
}
