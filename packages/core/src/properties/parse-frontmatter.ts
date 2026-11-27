import { CORE_SCHEMA, loadAll } from "js-yaml";
import { left, right } from "../either.ts";
import { asRecord } from "../as-record.ts";
import type { Either } from "../either.ts";

function unsafeLoadYaml(yaml: string): unknown[] {
  return loadAll(yaml, { schema: CORE_SCHEMA });
}

function describeYamlError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? message;
}

/**
 * Reads frontmatter YAML into its properties. The core schema keeps dates as text, so `expires` keeps
 * the local time that Obsidian writes. An empty block has no properties.
 */
export function parseFrontmatter(yaml: string): Either<string, Record<string, unknown>> {
  let documents: unknown[];
  try {
    documents = unsafeLoadYaml(yaml);
  } catch (error: unknown) {
    return left(`the frontmatter is not valid YAML: ${describeYamlError(error)}`);
  }
  const [document] = documents;
  if (documents.length === 0 || document === null) return right({});
  const properties = asRecord(document);
  if (properties === undefined || documents.length > 1) {
    return left("the frontmatter is not a list of properties");
  }
  return right(properties);
}
