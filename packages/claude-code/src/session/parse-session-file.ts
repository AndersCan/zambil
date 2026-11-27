import { left, right } from "@zambil/core/either";
import { asRecord } from "@zambil/core/as-record";
import type { Either } from "@zambil/core/either";
import type { ShownNotes } from "./shown-notes.ts";

/** The shown notes in a session file. Text that has not the shape of one gives no notes, so the agent gets them again. */
export function parseSessionFile(text: string): ShownNotes {
  const parsed = parseJson(text);
  const notes = parsed.ok ? asRecord(asRecord(parsed.value)?.notes) : undefined;
  const shown: ShownNotes = {};
  for (const [key, version] of Object.entries(notes ?? {})) {
    if (typeof version === "string") shown[key] = version;
  }
  return shown;
}

function parseJson(text: string): Either<unknown, unknown> {
  try {
    return right(unsafeParseJson(text));
  } catch (error: unknown) {
    return left(error);
  }
}

function unsafeParseJson(text: string): unknown {
  return JSON.parse(text);
}

/** The text of a session file for these notes. */
export function formatSessionFile(shown: ShownNotes): string {
  return `${JSON.stringify({ notes: shown })}\n`;
}
