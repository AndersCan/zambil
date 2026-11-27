import { isNever } from "../is-never.ts";
import type { Note } from "../note/note.ts";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** A moment in local time, as Obsidian writes it: `2026-11-28`, or `2026-11-28 09:30` when it is not midnight. */
export function formatMoment(time: Date): string {
  const month = pad(time.getMonth() + 1);
  const day = pad(time.getDate());
  const year = time.getFullYear();
  const date = `${year}-${month}-${day}`;
  const isMidnight = time.getHours() === 0 && time.getMinutes() === 0 && time.getSeconds() === 0;
  if (isMidnight) return date;
  const hours = pad(time.getHours());
  const minutes = pad(time.getMinutes());
  return `${date} ${hours}:${minutes}`;
}

/** Why an expired note counts as expired, as the end of a sentence that starts with its subject. */
export function expiredPhrase(note: Note): string {
  const { expiry } = note;
  switch (expiry.kind) {
    case "at":
      return `expired on ${formatMoment(expiry.time)}`;
    case "unreadable":
      return "counts as expired, because zambil cannot read its `expires` value or its frontmatter";
    case "never":
      return "expired";
    default:
      return isNever(expiry);
  }
}
