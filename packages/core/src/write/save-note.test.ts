import { describe, expect, test } from "vite-plus/test";
import { mkdir, readFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { loadRepo } from "../repo/load-repo.ts";
import { saveNote } from "./save-note.ts";
import type { SaveRequest } from "./save-note.ts";
import { writeTestRepo } from "../repo/write-test-repo.ts";

const now = new Date(2026, 10, 27);

const deploy = [
  "---",
  "description: How to deploy the web app.",
  "# kept as it is",
  "aliases:",
  "- ship",
  "hooks: [SessionStart]",
  "owner: ada",
  "expires: 2026-12-01",
  'when-expired: "[[check-deploy]]"',
  "---",
  "",
  "Run `make deploy`.",
  "",
].join("\n");

const files = {
  "ops/deploy.md": deploy,
  "ops/check-deploy.md":
    "---\ndescription: How to check the deploy note.\n---\n\nRead the Makefile.\n",
  "skills/release/SKILL.md": "---\ndescription: Release a package.\n---\n\nSteps.\n",
};

interface SaveOptions {
  root?: string;
}

async function save(request: SaveRequest, options: SaveOptions = {}) {
  const folder = options.root ?? (await writeTestRepo(files));
  const repo = loadRepo(folder);
  if (!repo.ok) throw new Error(repo.error.message);
  const result = saveNote(request, { repo: repo.value, now });
  const summary = result.ok
    ? { saved: result.value.note.path, mode: result.value.mode, warnings: result.value.warnings }
    : { refused: result.error };
  return { root: folder, summary };
}

interface ReadOptions {
  path: string;
}

function read(root: string, options: ReadOptions): Promise<string> {
  return readFile(join(root, options.path), "utf8");
}

describe("saveNote", () => {
  test("creates a note in a new folder with the expiry that the writer chose", async () => {
    const text =
      "---\ndescription: The test commands.\ntags: [testing]\n---\n\n\nRun `pnpm test`.\n\n";
    const request: SaveRequest = {
      mode: "create",
      name: "testing",
      folder: "coding/node",
      text,
      expiry: { kind: "expires", text: "2027-01-15" },
      whenExpired: "[[check-deploy]]",
    };
    const { root, summary } = await save(request);
    expect({ summary, text: await read(root, { path: "coding/node/testing.md" }) }).toEqual({
      summary: { saved: "coding/node/testing.md", mode: "create", warnings: [] },
      text: [
        "---",
        "description: The test commands.",
        "tags: [testing]",
        "expires: 2027-01-15",
        'when-expired: "[[check-deploy]]"',
        "---",
        "",
        "Run `pnpm test`.",
        "",
      ].join("\n"),
    });
  });

  test("creates a note without frontmatter when it has no properties and no expiry", async () => {
    const request: SaveRequest = {
      mode: "create",
      name: "tabs",
      text: "I indent with two spaces.",
      expiry: { kind: "none" },
    };
    const { root, summary } = await save(request);
    expect({ summary, text: await read(root, { path: "tabs.md" }) }).toEqual({
      summary: { saved: "tabs.md", mode: "create", warnings: [] },
      text: "I indent with two spaces.\n",
    });
  });

  test("rewrites the content and the named properties, and keeps every other line", async () => {
    const request: SaveRequest = {
      mode: "rewrite",
      name: "Deploy",
      text: "---\ndescription: >-\n  How to deploy\n  the web app.\n---\nRun `pnpm deploy`.\n",
      expiry: { kind: "expires", text: "2027-02-01T09:30" },
    };
    const { root, summary } = await save(request);
    expect({ summary, text: await read(root, { path: "ops/deploy.md" }) }).toEqual({
      summary: { saved: "ops/deploy.md", mode: "rewrite", warnings: [] },
      text: [
        "---",
        "description: >-",
        "  How to deploy",
        "  the web app.",
        "# kept as it is",
        "aliases:",
        "- ship",
        "hooks: [SessionStart]",
        "owner: ada",
        "expires: 2027-02-01T09:30",
        'when-expired: "[[check-deploy]]"',
        "---",
        "",
        "Run `pnpm deploy`.",
        "",
      ].join("\n"),
    });
  });

  test("keeps the content of a rewrite without text, and removes expires and when-expired for none", async () => {
    const request: SaveRequest = {
      mode: "rewrite",
      name: "deploy",
      text: "",
      expiry: { kind: "none" },
    };
    const { root, summary } = await save(request);
    const expected = deploy.replace('expires: 2026-12-01\nwhen-expired: "[[check-deploy]]"\n', "");
    expect({ summary, text: await read(root, { path: "ops/deploy.md" }) }).toEqual({
      summary: { saved: "ops/deploy.md", mode: "rewrite", warnings: [] },
      text: expected,
    });
  });

  test("sets properties that Obsidian writes as block lists, in a create and a rewrite", async () => {
    const root = await writeTestRepo({ "ops.md": "---\ntags:\n  - old\nowner: ada\n---\nText.\n" });
    const none = { kind: "none" } as const;
    const text = "---\ntags:\n  - ops\naliases:\n  - first\n---\nText.\n";
    const created = await save({ mode: "create", name: "first", text, expiry: none }, { root });
    const newTags = "---\ntags:\n  - new\n---\n";
    const rewritten = await save(
      { mode: "rewrite", name: "ops", text: newTags, expiry: none },
      { root },
    );
    expect({
      summaries: [created.summary, rewritten.summary],
      first: await read(root, { path: "first.md" }),
      ops: await read(root, { path: "ops.md" }),
    }).toEqual({
      summaries: [
        { saved: "first.md", mode: "create", warnings: [] },
        { saved: "ops.md", mode: "rewrite", warnings: [] },
      ],
      first: "---\ntags:\n  - ops\naliases:\n  - first\n---\n\nText.\n",
      ops: "---\ntags:\n  - new\nowner: ada\n---\nText.\n",
    });
  });

  test("verifies a note whose alias another note already shares", async () => {
    const root = await writeTestRepo({
      "a.md": "---\naliases: [same]\n---\nA.\n",
      "b.md": "---\naliases: [same]\n---\nB.\n",
    });
    const { summary } = await save({ mode: "verify", name: "a", expires: "2027-01-01" }, { root });
    expect(summary).toEqual({ saved: "a.md", mode: "verify", warnings: [] });
  });

  test("records a verified note with a new expires date and the same content", async () => {
    const request: SaveRequest = { mode: "verify", name: "deploy", expires: "2027-03-01" };
    const { root, summary } = await save(request);
    expect({ summary, text: await read(root, { path: "ops/deploy.md" }) }).toEqual({
      summary: { saved: "ops/deploy.md", mode: "verify", warnings: [] },
      text: deploy.replace("expires: 2026-12-01", "expires: 2027-03-01"),
    });
  });

  test("refuses a verify that keeps the expires date, because it changes nothing", async () => {
    const results = await Promise.all([
      save({ mode: "verify", name: "deploy", expires: "2026-12-01" }),
      save({ mode: "verify", name: "deploy", expires: "2026-12-01T00:00" }),
    ]);
    const refusal = {
      refused: {
        reason: "invalid",
        message:
          "ops/deploy.md already expires on 2026-12-01, so a verify with that date changes nothing. Give the date when its claims are likely to change next.",
      },
    };
    expect(results.map((result) => result.summary)).toEqual([refusal, refusal]);
  });

  test("rewrites a skill in its SKILL.md", async () => {
    const request: SaveRequest = {
      mode: "rewrite",
      name: "release",
      text: "New steps.",
      expiry: { kind: "none" },
    };
    const { root, summary } = await save(request);
    expect({ summary, text: await read(root, { path: "skills/release/SKILL.md" }) }).toEqual({
      summary: { saved: "skills/release/SKILL.md", mode: "rewrite", warnings: [] },
      text: "---\ndescription: Release a package.\n---\n\nNew steps.\n",
    });
  });

  test("refuses a create or a rewrite that picked the wrong mode", async () => {
    const write = { text: "Text.", expiry: { kind: "none" } } as const;
    const results = await Promise.all([
      save({ mode: "create", name: "DEPLOY", ...write }),
      save({ mode: "create", name: "ship", ...write }),
      save({ mode: "rewrite", name: "deploy", ...write, whenExpired: "check-deploy" }),
      save({ mode: "rewrite", name: "missing", ...write }),
      save({ mode: "verify", name: "missing", expires: "2027-01-01" }),
    ]);
    expect(results.map((result) => result.summary)).toEqual([
      {
        refused: {
          reason: "taken",
          message: 'The name "DEPLOY" is already used by ops/deploy.md.',
        },
      },
      {
        refused: {
          reason: "invalid",
          message:
            '"ship" is an alias of ops/deploy.md. Pick another name, or rewrite that note by its name, "deploy".',
        },
      },
      {
        refused: { reason: "invalid", message: "A note without expires has no when-expired note." },
      },
      { refused: { reason: "missing", message: 'No note has the name "missing".' } },
      { refused: { reason: "missing", message: 'No note has the name "missing".' } },
    ]);
  });

  test("refuses a new folder that zambil would not read or that leaves the repo", async () => {
    const root = await writeTestRepo(files);
    await mkdir(join(root, "../outside"), { recursive: true });
    await symlink(join(root, "../outside"), join(root, "linked"));
    const folders = [
      "../outside",
      "/tmp",
      ".obsidian",
      "a/node_modules",
      "skills/release",
      "linked/deeper",
    ];
    const results = await Promise.all(
      folders.map((folder) =>
        save(
          { mode: "create", name: "new", folder, text: "Text.", expiry: { kind: "none" } },
          { root },
        ),
      ),
    );
    expect(results.map((result) => result.summary)).toEqual([
      { refused: { reason: "invalid", message: "The folder ../outside is outside the repo." } },
      { refused: { reason: "invalid", message: "The folder /tmp is outside the repo." } },
      {
        refused: {
          reason: "invalid",
          message:
            "zambil does not read notes in .obsidian, because a part starts with . or is node_modules.",
        },
      },
      {
        refused: {
          reason: "invalid",
          message:
            "zambil does not read notes in a/node_modules, because a part starts with . or is node_modules.",
        },
      },
      {
        refused: {
          reason: "invalid",
          message:
            "skills/release is a skill folder, and its other files are not notes; pick another folder.",
        },
      },
      {
        refused: {
          reason: "invalid",
          message: "linked is a symbolic link, and zambil writes only inside the repo.",
        },
      },
    ]);
  });

  test("refuses an expiry that is not a future date, a missing when-expired note and expiry in the text", async () => {
    const write = { mode: "rewrite", name: "deploy", text: "Text." } as const;
    const results = await Promise.all([
      save({ ...write, expiry: { kind: "expires", text: "2026-11-27" } }),
      save({ ...write, expiry: { kind: "expires", text: "next week" } }),
      save({ ...write, expiry: { kind: "expires", text: "2027-01-01" }, whenExpired: "nowhere" }),
      save({ ...write, text: "---\nexpires: 2027-01-01\n---\nText.", expiry: { kind: "none" } }),
      save({ mode: "verify", name: "deploy", expires: "2026-01-01" }),
    ]);
    const messages = results.map((result) => result.summary);
    expect(messages).toEqual([
      {
        refused: {
          reason: "invalid",
          message: "The expires date 2026-11-27 is not in the future.",
        },
      },
      {
        refused: {
          reason: "invalid",
          message: '"next week" is not a date. Write 2026-11-28 or 2026-11-28T09:30.',
        },
      },
      {
        refused: {
          reason: "invalid",
          message: 'No note has the name "nowhere" for when-expired. Save that note first.',
        },
      },
      {
        refused: {
          reason: "invalid",
          message: "Set expires with its option, not in the frontmatter of the text.",
        },
      },
      {
        refused: {
          reason: "invalid",
          message: "The expires date 2026-01-01 is not in the future.",
        },
      },
    ]);
  });

  test("refuses names that are not unique, not linkable or not notes, and an empty note", async () => {
    const none = { kind: "none" } as const;
    const results = await Promise.all([
      save({ mode: "rewrite", name: "ship", text: "Text.", expiry: none }),
      save({
        mode: "rewrite",
        name: "check-deploy",
        text: "---\naliases: [Ship]\n---\n",
        expiry: none,
      }),
      save({ mode: "create", name: "a#b", text: "Text.", expiry: none }),
      save({ mode: "create", name: "skill", text: "Text.", expiry: none }),
      save({ mode: "create", name: "open", text: "---\ndescription: Open.\nText.", expiry: none }),
      save({
        mode: "create",
        name: "empty",
        text: "---\ndescription: Empty.\n---\n\n",
        expiry: none,
      }),
    ]);
    expect(results.map((result) => result.summary)).toEqual([
      {
        refused: {
          reason: "invalid",
          message: '"ship" is an alias of ops/deploy.md. Use its name, "deploy".',
        },
      },
      {
        refused: {
          reason: "invalid",
          message:
            'The alias "Ship" in the text is already used by ops/deploy.md. Pick another alias.',
        },
      },
      {
        refused: {
          reason: "invalid",
          message:
            'The name "a#b" has a character that a filename or an Obsidian link cannot have: \\ / : * " < > ? # ^ [ ] | or a control character.',
        },
      },
      {
        refused: {
          reason: "invalid",
          message: "A SKILL.md file makes a skill folder. zambil does not create skills.",
        },
      },
      {
        refused: {
          reason: "invalid",
          message: "The frontmatter of the new text has no closing --- line.",
        },
      },
      { refused: { reason: "invalid", message: "The note has no text." } },
    ]);
  });

  test("leaves a note with broken frontmatter as it is", async () => {
    const broken = "---\ndescription: [unclosed\n---\nText.\n";
    const root = await writeTestRepo({ "broken.md": broken });
    const { summary } = await save(
      { mode: "verify", name: "broken", expires: "2027-01-01" },
      { root },
    );
    expect({ summary, text: await read(root, { path: "broken.md" }) }).toEqual({
      summary: {
        refused: {
          reason: "invalid",
          message:
            "The frontmatter of broken.md does not parse, so zambil cannot keep its properties. Fix it by hand first.",
        },
      },
      text: broken,
    });
  });
});

describe("saveNote and the errors that zambil check reports across notes", () => {
  test("refuses a missing script file and an alias that the when-expired note of another note uses", async () => {
    const root = await writeTestRepo({
      "a.md": '---\nexpires: 2026-12-01\nwhen-expired: "[[old-b]]"\n---\nA.\n',
      "b.md": "---\naliases: [old-b]\n---\nB.\n",
    });
    const none = { kind: "none" } as const;
    const script = "---\nscript: missing.sh\n---\nRun it.\n";
    const results = await Promise.all([
      save({ mode: "create", name: "runner", text: script, expiry: none }, { root }),
      save(
        { mode: "rewrite", name: "b", text: "---\naliases: [new-b]\n---\n", expiry: none },
        { root },
      ),
    ]);
    expect(results.map((result) => result.summary)).toEqual([
      {
        refused: {
          reason: "invalid",
          message:
            "The repo would get an error: runner.md: `script` points to missing.sh, but no file is there.",
        },
      },
      {
        refused: {
          reason: "invalid",
          message:
            'The repo would get an error: a.md: `when-expired` names "old-b", but no note has that name.',
        },
      },
    ]);
  });

  test("creates a note whose when-expired note is the note itself", async () => {
    const root = await writeTestRepo({});
    const request: SaveRequest = {
      mode: "create",
      name: "today",
      text: "Today is 2026-11-27.",
      expiry: { kind: "expires", text: "2026-11-28" },
      whenExpired: "today",
    };
    const { summary } = await save(request, { root });
    expect(summary).toEqual({ saved: "today.md", mode: "create", warnings: [] });
  });
});

describe("saveNote with frontmatter that it cannot edit line by line", () => {
  test("refuses and leaves the note as it is", async () => {
    const flow = "---\n{description: Deploy., expires: 2026-12-01}\n---\nText.\n";
    const root = await writeTestRepo({ "flow.md": flow });
    const { summary } = await save(
      { mode: "verify", name: "flow", expires: "2027-01-01" },
      { root },
    );
    expect({ summary, text: await read(root, { path: "flow.md" }) }).toEqual({
      summary: {
        refused: {
          reason: "invalid",
          message:
            "zambil cannot change the frontmatter of flow.md line by line without changing other properties. Edit it by hand.",
        },
      },
      text: flow,
    });
  });
});
