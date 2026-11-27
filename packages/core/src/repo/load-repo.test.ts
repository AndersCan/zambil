import { describe, expect, test } from "vite-plus/test";
import { fileURLToPath } from "node:url";
import { loadRepo } from "./load-repo.ts";
import { writeTestRepo } from "./write-test-repo.ts";

const sampleRepo = fileURLToPath(new URL("../../fixtures/sample-repo", import.meta.url));

describe("loadRepo", () => {
  test("loads every note of the sample repo and skips hidden folders and skill resources", () => {
    const loaded = loadRepo(sampleRepo);
    const summary = loaded.ok
      ? {
          notes: loaded.value.notes.map((note) => [note.name, note.kind, note.path]),
          problems: loaded.value.problems,
        }
      : loaded.error;
    expect(summary).toEqual({
      notes: [
        ["refresh-today", "note", "cache/refresh-today.md"],
        ["today", "note", "cache/today.md"],
        ["typescript-style", "note", "coding/typescript-style.md"],
        ["backup", "script", "scripts/backup.md"],
        ["welcome", "note", "session/welcome.md"],
        ["release", "skill", "skills/release/SKILL.md"],
      ],
      problems: [],
    });
  });

  test("reads the properties of a note in the sample repo", () => {
    const loaded = loadRepo(sampleRepo);
    const note = loaded.ok
      ? loaded.value.notes.find((candidate) => candidate.name === "typescript-style")
      : undefined;
    expect(note).toEqual({
      kind: "note",
      name: "typescript-style",
      path: "coding/typescript-style.md",
      description: "How to write TypeScript in my projects.",
      aliases: ["ts-style"],
      tags: ["typescript", "style"],
      hooks: ["PreToolUse"],
      tools: ["Edit", "Write"],
      projects: [],
      paths: [],
      triggers: [],
      expiry: { kind: "never" },
      properties: {
        description: "How to write TypeScript in my projects.",
        aliases: ["ts-style"],
        tags: ["typescript"],
        hooks: ["PreToolUse"],
        tools: ["Edit", "Write"],
      },
      content: "\nUse `function` declarations and named exports. #style\n",
    });
  });

  test("skips node_modules and reports a SKILL.md in the repo root", async () => {
    const root = await writeTestRepo({
      "SKILL.md": "Not in a folder.",
      "node_modules/package/README.md": "Not a note.",
      "notes/a.md": "A note.",
    });
    const loaded = loadRepo(root);
    const summary = loaded.ok
      ? { names: loaded.value.notes.map((note) => note.name), problems: loaded.value.problems }
      : loaded.error;
    expect(summary).toEqual({
      names: ["a"],
      problems: [
        {
          severity: "error",
          path: "SKILL.md",
          message:
            "SKILL.md belongs in a skill folder, such as `skills/<name>/SKILL.md`, not in the repo root",
        },
      ],
    });
  });

  test("tells a missing root apart from a file in its place", async () => {
    const root = await writeTestRepo({ "notes.md": "" });
    const roots = ["/no/such/zambil/repo", `${root}/notes.md`];
    const kinds = roots.map((path) => {
      const loaded = loadRepo(path);
      return loaded.ok ? "loaded" : loaded.error.kind;
    });
    expect(kinds).toEqual(["missing-root", "not-a-folder"]);
  });
});
