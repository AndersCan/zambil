import type { Expiry } from "../note/note.ts";

const localPattern =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})(?:[T ](?<hour>\d{2}):(?<minute>\d{2})(?::(?<second>\d{2})(?:\.\d+)?)?)?$/;
const zonedPattern =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

function readLocal(text: string): Date | undefined {
  const parts = localPattern.exec(text)?.groups;
  if (parts === undefined) return undefined;
  const month = Number(parts.month) - 1;
  const day = Number(parts.day);
  const hour = Number(parts.hour ?? "0");
  const minute = Number(parts.minute ?? "0");
  const time = new Date(Number(parts.year), month, day, hour, minute, Number(parts.second ?? "0"));
  const isRealDate = time.getMonth() === month && time.getDate() === day;
  const isRealTime = hour < 24 && minute < 60 && Number(parts.second ?? "0") < 60;
  return isRealDate && isRealTime ? time : undefined;
}

/**
 * Reads an `expires` value. A date or a date and time without a zone is local time, as Obsidian
 * writes it: `2026-11-28` expires at local midnight. A time with `Z` or an offset is that moment.
 */
export function parseExpires(text: string | undefined): Expiry {
  if (text === undefined) return { kind: "never" };
  const local = readLocal(text);
  if (local !== undefined) return { kind: "at", time: local };
  const hasRealDay = readLocal(text.slice(0, "2026-11-28".length)) !== undefined;
  const zoned = zonedPattern.test(text) && hasRealDay ? new Date(text) : undefined;
  if (zoned === undefined || Number.isNaN(zoned.getTime())) return { kind: "unreadable", text };
  return { kind: "at", time: zoned };
}
