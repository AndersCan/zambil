import { chmod, mkdir, mkdtemp } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import { findSimilarNotes, readPrompt, searchableNotes } from "./find-similar-notes.ts";
import { join } from "node:path";
import { loadRepo } from "@zambil/core/load-repo";
import { searchModel } from "@zambil/embed/search-model";
import { tmpdir } from "node:os";
import { writeTestRepo } from "@zambil/core/write-test-repo";

describe("readPrompt", () => {
  test("matches text and paths, and skips a slash command and a prompt without a letter", () => {
    const prompts = [
      "iterating",
      "  /compact keep the plan",
      "/review:pr",
      "/work/app/loop.ts: how do I iterate here?",
      "?!",
      "42",
      "",
      "écrire une boucle",
    ];
    expect(prompts.map((prompt) => readPrompt(prompt))).toEqual([
      "text",
      "command",
      "command",
      "text",
      "no-text",
      "no-text",
      "no-text",
      "text",
    ]);
  });
});

describe("findSimilarNotes", () => {
  test("loads nothing for a skipped prompt, and turns a thrown error into an error value", async () => {
    const root = await writeTestRepo({ "for-loops.md": "---\ndescription: For loops.\n---\n" });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const cacheHome = await mkdtemp(join(tmpdir(), "zambil-locked-cache-"));
    const locked = join(cacheHome, "zambil", "models", searchModel.id);
    await mkdir(locked, { recursive: true });
    await chmod(locked, 0o000);
    const environment = { home: "/home/ada", workingFolder: "/", cacheHome };
    const now = new Date(2026, 10, 27);
    const [command, noText, text] = await Promise.all([
      findSimilarNotes(repo.value, { prompt: "/clear", now, environment }),
      findSimilarNotes(repo.value, { prompt: "?!", now, environment }),
      findSimilarNotes(repo.value, { prompt: "iterating", now, environment }),
    ]);
    await chmod(locked, 0o755);
    expect({ command, noText, text: text.ok ? "matched" : text.error.kind }).toEqual({
      command: { ok: true, value: { matches: [], skipped: 0 } },
      noText: { ok: true, value: { matches: [], skipped: 0 } },
      text: "failed",
    });
  });
});

describe("searchableNotes", () => {
  test("leaves out a SessionStart note, a note that the context holds, and a when-expired helper with no hook", async () => {
    const root = await writeTestRepo({
      "Deploy.md": "---\ndescription: How to deploy.\n---\nRun make deploy.\n",
      "rebase.md": "---\ndescription: How to rebase.\n---\nRun git rebase.\n",
      "welcome.md": "---\ndescription: Welcome.\nhooks: SessionStart\n---\nHi.\n",
      "constructor.md": "---\ndescription: How to build a class.\n---\nUse functions.\n",
      "billing.md":
        '---\ndescription: How billing works.\nexpires: 2026-12-31\nwhen-expired: "[[verify billing]]"\n---\nTaxes.\n',
      "check-billing.md":
        "---\ndescription: How to check the billing note.\naliases: [verify billing]\n---\nRead the code.\n",
      "check-deploy.md":
        "---\ndescription: How to check the deploy note.\nhooks: UserPromptSubmit\n---\nRun make status.\n",
      "today.md":
        '---\ndescription: The date.\nexpires: 2026-11-28\nwhen-expired: "[[check-deploy]]"\n---\nFriday.\n',
      "deploy-blog.md":
        '---\ndescription: How to deploy the blog.\nexpires: 2027-06-01\nwhen-expired: "[[deploy-blog]]"\n---\nRun make blog.\n',
    });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const inContext = { deploy: "an older version" };
    const notes = searchableNotes(repo.value, { inContext, place: undefined });
    expect(notes.map((note) => note.name)).toEqual([
      "billing",
      "check-deploy",
      "constructor",
      "deploy-blog",
      "rebase",
      "today",
    ]);
  });

  test("leaves out the deploy notes of other projects, so a deploy prompt in a third project gets neither", async () => {
    const root = await writeTestRepo({
      "deploy-blog.md":
        "---\ndescription: How to deploy the blog.\nprojects: [blog]\n---\nmake blog\n",
      "deploy-webshop.md":
        '---\ndescription: How to deploy the webshop.\npaths: ["~/git/webshop"]\n---\nmake shop\n',
      "deploy-checklist.md":
        "---\ndescription: What to check before any deploy.\n---\nTests pass.\n",
    });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const home = "/home/ada";
    const places = [
      { folder: "/home/ada/git/notes-app", projects: ["notes-app"], home },
      { folder: "/home/ada/git/blog/posts", projects: ["blog", "posts"], home },
      { folder: "/home/ada/git/webshop", projects: ["webshop"], home },
    ];
    const names: string[][] = [];
    for (const place of places) {
      const notes = searchableNotes(repo.value, { inContext: {}, place });
      names.push(notes.map((note) => note.name));
    }
    expect(names).toEqual([
      ["deploy-checklist"],
      ["deploy-blog", "deploy-checklist"],
      ["deploy-checklist", "deploy-webshop"],
    ]);
  });
});
