import { describe, expect, test } from "vite-plus/test";
import { isExpired } from "./is-expired.ts";
import { parseNote } from "../note/parse-note.ts";

function noteExpiring(expires: string) {
  const text = `---\nexpires: ${expires}\nwhen-expired: "[[refresh-today]]"\n---\nToday is 2026-11-27.\n`;
  return parseNote(text, { file: { path: "today.md", name: "today", kind: "note" } }).note;
}

describe("isExpired", () => {
  test("is current before the expiry time and expired from it on", () => {
    const today = noteExpiring("2026-11-28");
    expect([
      isExpired(today, { now: new Date(2026, 10, 27, 23, 59) }),
      isExpired(today, { now: new Date(2026, 10, 28) }),
    ]).toEqual([false, true]);
  });

  test("never expires a note without `expires` and always expires an unreadable one", () => {
    const plain = parseNote("Body", { file: { path: "a.md", name: "a", kind: "note" } }).note;
    const now = new Date(2026, 10, 27);
    expect([isExpired(plain, { now }), isExpired(noteExpiring("someday"), { now })]).toEqual([
      false,
      true,
    ]);
  });

  test("keeps the name of the note that tells how to refresh it", () => {
    expect(noteExpiring("2026-11-28").whenExpired).toBe("refresh-today");
  });
});
