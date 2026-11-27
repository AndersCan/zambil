import { left, right } from "@zambil/core/either";
import { readOptionalText, replaceText } from "./text-file.ts";
import { asRecord } from "@zambil/core/as-record";
import type { Either } from "@zambil/core/either";
import type { Settings } from "@zambil/claude-code/settings-hooks";

function unsafeParseJson(text: string): unknown {
  return JSON.parse(text);
}

function parseSettings(text: string): Either<string, Settings> {
  let parsed: unknown;
  try {
    parsed = unsafeParseJson(text);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    return left(`it is not valid JSON: ${reason}`);
  }
  const settings = asRecord(parsed);
  if (settings === undefined) return left("it is not a JSON object");
  return right(settings);
}

/** The settings in a file, or empty settings when there is no file yet. */
export async function readSettings(path: string): Promise<Either<string, Settings>> {
  const text = await readOptionalText(path);
  if (!text.ok) return text;
  if (text.value === undefined || text.value.trim() === "") return right({});
  return parseSettings(text.value);
}

/** The settings to write, and the settings that the file holds now. */
export interface SaveSettingsOptions {
  before: Settings;
  after: Settings;
}

/** `changed` when the file got new settings, `unchanged` when it already held them and stayed as it was. */
export type SaveResult = "changed" | "unchanged";

/** Writes the settings only when they differ, so that a second install leaves the file as it is. */
async function saveSettings(
  path: string,
  options: SaveSettingsOptions,
): Promise<Either<string, SaveResult>> {
  const text = `${JSON.stringify(options.after, undefined, 2)}\n`;
  if (text === `${JSON.stringify(options.before, undefined, 2)}\n`) return right("unchanged");
  const written = await replaceText(path, { text });
  if (!written.ok) return written;
  return right("changed");
}

/** The change to make to the settings. It returns why it cannot, to leave the file as it is. */
export interface ChangeSettingsOptions {
  change: (settings: Settings) => Either<string, Settings>;
}

/** Reads the settings file, changes the settings and writes them back when they differ. */
export async function changeSettings(
  path: string,
  options: ChangeSettingsOptions,
): Promise<Either<string, SaveResult>> {
  const before = await readSettings(path);
  if (!before.ok) return before;
  const after = options.change(before.value);
  if (!after.ok) return after;
  return saveSettings(path, { before: before.value, after: after.value });
}
