import { describe, expect, test } from "vite-plus/test";
import type { NoteFile } from "./note-file.ts";
import { parseNote } from "./parse-note.ts";

const noteFile: NoteFile = { path: "ops/deploy.md", name: "deploy", kind: "note" };
const skillFile: NoteFile = { path: "skills/release/SKILL.md", name: "release", kind: "skill" };

describe("parseNote", () => {
  test("reads a plain note with its properties and inline tags", () => {
    const text =
      "---\ndescription: Deploy steps.\naliases: ship\ntags: [ops]\nhooks: [SessionStart]\n---\nRun it. #ops #prod\n";
    expect(parseNote(text, { file: noteFile })).toEqual({
      note: {
        kind: "note",
        name: "deploy",
        path: "ops/deploy.md",
        description: "Deploy steps.",
        aliases: ["ship"],
        tags: ["ops", "prod"],
        hooks: ["SessionStart"],
        tools: [],
        projects: [],
        paths: [],
        triggers: [],
        expiry: { kind: "never" },
        properties: {
          description: "Deploy steps.",
          aliases: "ship",
          tags: ["ops"],
          hooks: ["SessionStart"],
        },
      },
      problems: [],
    });
  });

  test("makes a note with `script` a script note, with the path relative to the repo root", () => {
    const text = "---\nscript: ../bin/backup.sh\nrun-with: bash\n---\nBacks up.\n";
    const parsed = parseNote(text, { file: noteFile });
    expect({ kind: parsed.note.kind, note: parsed.note, problems: parsed.problems }).toMatchObject({
      kind: "script",
      note: { script: { path: "bin/backup.sh", runWith: "bash" } },
      problems: [],
    });
  });

  test("keeps a note plain when its script points outside the repo", () => {
    const parsed = parseNote("---\nscript: ../../secret.sh\n---\n", { file: noteFile });
    expect({ kind: parsed.note.kind, problems: parsed.problems }).toEqual({
      kind: "note",
      problems: [
        {
          severity: "error",
          path: "ops/deploy.md",
          message:
            '`script` is "../../secret.sh", but it must be a path inside the repo, relative to the folder of the note',
        },
      ],
    });
  });

  test("names a skill after its folder and reports what a skill cannot have", () => {
    const parsed = parseNote("---\nname: ship\nscript: run.sh\n---\n", { file: skillFile });
    expect({ kind: parsed.note.kind, name: parsed.note.name, problems: parsed.problems }).toEqual({
      kind: "skill",
      name: "release",
      problems: [
        {
          severity: "error",
          path: "skills/release/SKILL.md",
          message: '`name` is "ship", but a skill takes its folder name: "release"',
        },
        {
          severity: "error",
          path: "skills/release/SKILL.md",
          message: "a skill cannot have `script`; describe its scripts in SKILL.md",
        },
        {
          severity: "warning",
          path: "skills/release/SKILL.md",
          message: "a skill needs a `description`, so that the agent knows when to load it",
        },
      ],
    });
  });

  test("keeps the note and reports broken frontmatter and an unreadable expiry", () => {
    const broken = parseNote("---\ntags: [a\n---\nBody\n", { file: noteFile });
    const unreadable = parseNote("---\nexpires: soon\n---\n", { file: noteFile });
    expect({
      broken: {
        name: broken.note.name,
        severity: broken.problems.map((problem) => problem.severity),
      },
      unreadable: { expiry: unreadable.note.expiry, problems: unreadable.problems },
    }).toEqual({
      broken: { name: "deploy", severity: ["error"] },
      unreadable: {
        expiry: { kind: "unreadable", text: "soon" },
        problems: [
          {
            severity: "error",
            path: "ops/deploy.md",
            message:
              '`expires` is not a date: "soon"; write 2026-11-28 or 2026-11-28T09:30. The note counts as expired',
          },
        ],
      },
    });
  });

  test("warns about properties that do nothing and names that Obsidian cannot link", () => {
    const parsed = parseNote(
      "---\nwhen-expired: '[[refresh]]'\nrun-with: node\naliases: [a|b]\npaths: [git/shop, ~/git/blog, '~']\nprojects: [~/git/shop]\n---\n",
      {
        file: noteFile,
      },
    );
    expect(parsed.problems.map((problem) => problem.message)).toEqual([
      "`when-expired` has no effect without `expires`",
      '`paths` holds "git/shop", but each path must be a full path or start with ~/. The path matches no folder, so the note applies only through its other paths or projects',
      '`projects` holds "~/git/shop", but a project is the name of a repo or a folder, so it matches no project. Put a path in `paths`',
      'Obsidian cannot link to "a|b": it has #, ^, [, ] or |',
      "`run-with` has no effect without `script`",
    ]);
  });
});
