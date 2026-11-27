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

  test("expires a cache note whose frontmatter does not parse or whose `expires` has the wrong shape", () => {
    const file = { path: "today.md", name: "today", kind: "note" } as const;
    const broken = [
      "---\ndescription: Today: the date\nexpires: 2026-11-28\n---\n",
      "---\nexpires: 2026-11-28\ntags: [a\n---\n",
      "---\nexpires:\n  - 2026-11-28\n---\n",
      "---\nexpires: {date: 2026-11-28}\n---\n",
      '---\n"expires": 2026-11-28\nfoo: [\n---\n',
      "---\n{expires: 2026-11-28, foo: [}\n---\n",
    ];
    const now = new Date(2026, 10, 27);
    const expired = broken.map((text) => isExpired(parseNote(text, { file }).note, { now }));
    expect(expired).toEqual([true, true, true, true, true, true]);
  });

  test("keeps the name of the note that tells how to refresh it", () => {
    expect(noteExpiring("2026-11-28").whenExpired).toBe("refresh-today");
  });
});
