import { describe, expect, test } from "vite-plus/test";
import { findNote } from "./find-note.ts";
import { indexNames } from "./index-names.ts";
import type { NoteFile } from "../note/note-file.ts";
import { parseNote } from "../note/parse-note.ts";

interface NoteOptions {
  text?: string;
}

function note(path: string, options: NoteOptions = {}) {
  const fileName = path.split("/").at(-1) ?? path;
  const isSkill = fileName === "SKILL.md";
  const name = isSkill ? (path.split("/").at(-2) ?? path) : fileName.replace(/\.md$/, "");
  const file: NoteFile = { path, name, kind: isSkill ? "skill" : "note" };
  return parseNote(options.text ?? "", { file }).note;
}

describe("indexNames", () => {
  test("reports a name that two folders share, naming both files", () => {
    const indexed = indexNames([note("ops/deploy.md"), note("skills/deploy/SKILL.md")]);
    expect(indexed.problems).toEqual([
      {
        severity: "error",
        path: "ops/deploy.md",
        message: 'the name "deploy" is used by 2 notes: ops/deploy.md, skills/deploy/SKILL.md',
      },
    ]);
  });

  test("reports an alias that matches another name in any case", () => {
    const indexed = indexNames([
      note("Deploy.md"),
      note("ship.md", { text: "---\naliases: [deploy, ship]\n---\n" }),
    ]);
    expect(indexed.problems).toEqual([
      {
        severity: "error",
        path: "Deploy.md",
        message: 'the name "Deploy" is used by 2 notes: Deploy.md, ship.md (alias)',
      },
    ]);
  });

  test("finds a note by name or alias, and tells a missing name from an ambiguous one", () => {
    const deploy = note("ops/deploy.md", { text: "---\naliases: ship\n---\n" });
    const indexed = indexNames([deploy, note("a/same.md"), note("b/same.md")]);
    expect([
      findNote(indexed, { name: "SHIP" }),
      findNote(indexed, { name: "unknown" }),
      findNote(indexed, { name: "same" }).kind,
    ]).toEqual([
      { kind: "found", note: deploy },
      { kind: "missing", name: "unknown" },
      "ambiguous",
    ]);
  });
});
