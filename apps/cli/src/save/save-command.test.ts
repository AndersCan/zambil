import { describe, expect, test } from "vite-plus/test";
import { homedir, tmpdir } from "node:os";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { checkSimilar } from "../doctor/check-similar.ts";
import type { CliConfig } from "../config.ts";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadRepo } from "@zambil/core/load-repo";
import { openNoteSearch } from "@zambil/embed/open-note-search";
import { saveCommand } from "./save-command.ts";
import { writeTestRepo } from "@zambil/core/write-test-repo";
import { writeTestSearchFiles } from "@zambil/embed/write-test-search-files";

interface RunOptions {
  input?: string;
  config?: CliConfig;
}

const defaultConfig = { environment: { home: "/home/ada", workingFolder: "/" } };

async function run(args: string[], options: RunOptions = {}) {
  const printed = { stdout: "", stderr: "" };
  const output = {
    write: (text: string) => {
      printed.stdout += text;
    },
    error: (text: string) => {
      printed.stderr += text;
    },
  };
  const text = options.input;
  const input = {
    readAll: () =>
      text === undefined ? Promise.reject(new Error("read standard input")) : Promise.resolve(text),
  };
  const config = options.config ?? defaultConfig;
  const code = await saveCommand.run({ args, config, input, output, now: new Date(2026, 10, 27) });
  return { code, ...printed };
}

const note = "---\ndescription: How to deploy.\n---\n\nRun `make deploy`.\n";

describe("saveCommand", () => {
  test("creates a note from standard input and reminds about the when-expired note", async () => {
    const root = await writeTestRepo({});
    const result = await run(
      ["deploy", "--repo", root, "--expires", "2027-01-15", "--folder", "ops"],
      {
        input: note,
      },
    );
    expect({ result, text: await readFile(join(root, "ops/deploy.md"), "utf8") }).toEqual({
      result: {
        code: 0,
        stdout: "Created ops/deploy.md.\n",
        stderr: [
          "Reminder: ops/deploy.md expires, but it has no when-expired note.",
          "Save a note that tells how to update this note or verify its claims. Then link it:",
          `  zambil save deploy --rewrite --expires 2027-01-15 --when-expired <that note> --repo ${root} < /dev/null`,
          "",
        ].join("\n"),
      },
      text: "---\ndescription: How to deploy.\nexpires: 2027-01-15\n---\n\nRun `make deploy`.\n",
    });
  });

  test("records a verified note without reading standard input", async () => {
    const root = await writeTestRepo({
      "deploy.md": "---\nexpires: 2026-12-01\nwhen-expired: deploy\n---\nText.\n",
    });
    const result = await run(["deploy", "--verified", "--expires", "2027-03-01", "--repo", root]);
    expect({ result, text: await readFile(join(root, "deploy.md"), "utf8") }).toEqual({
      result: {
        code: 0,
        stdout: "Verified deploy.md. It now expires on 2027-03-01.\n",
        stderr: "",
      },
      text: "---\nexpires: 2027-03-01\nwhen-expired: deploy\n---\nText.\n",
    });
  });

  test("makes the writer choose about expiry and the mode", async () => {
    const root = await writeTestRepo({ "deploy.md": note });
    const results = await Promise.all([
      run(["deploy", "--repo", root], { input: note }),
      run(["deploy", "--repo", root, "--no-expires"], { input: note }),
      run(["new", "--repo", root, "--no-expires"], { input: "" }),
      run(["deploy", "--repo", root, "--verified", "--no-expires"]),
      run(["new", "--repo", root, "--no-expires", "--when-expired", "deploy"], { input: note }),
      run(["new", "--repo", root, "--no-expires"], { input: "---\naliases: [deploy]\n---\nText." }),
      run(["deploy", "--repo", root, "--rewrite", "--no-expires", "--allow-similar"], {
        input: note,
      }),
      run(["deploy", "--repo", root, "--verified", "--expires", "2027-01-01", "--allow-similar"]),
    ]);
    const messages = results.map((result) => {
      const lines = result.stderr.split("\n");
      return [result.code, ...lines.filter((line) => line !== "" && !/^(Usage:| )/.test(line))];
    });
    expect(messages).toEqual([
      [
        2,
        "Choose an expiry: add --expires <date>, or add --no-expires for a note that makes no claims that go out of date.",
      ],
      [
        1,
        'zambil did not save "deploy". The name "deploy" is already used by deploy.md.',
        "To change that note, add --rewrite.",
      ],
      [2, "Give the text of the new note on standard input."],
      [2, "--verified sets a new expires date only. Use --rewrite to change more."],
      [2, "--when-expired needs --expires. A note without expires has no when-expired note."],
      [
        1,
        'zambil did not save "new". The alias "deploy" in the text is already used by deploy.md. Pick another alias.',
      ],
      [2, "--allow-similar is only for a new note."],
      [2, "--verified sets a new expires date only. Use --rewrite to change more."],
    ]);
  });

  test("warns about a name that z: cannot recall plainly and about a note without description", async () => {
    const root = await writeTestRepo({});
    const spaced = await run(["My Note", "--no-expires", "--repo", root], { input: "Hello.\n" });
    const described = "---\ndescription: The end.\n---\nBye.\n";
    const dotted = await run(["end.", "--no-expires", "--repo", root], { input: described });
    const plain = await run(["it-is", "--no-expires", "--repo", root], { input: described });
    expect([spaced, dotted, plain]).toEqual([
      {
        code: 0,
        stdout: "Created My Note.md.\n",
        stderr: [
          'My Note.md: warning: A plain z:My Note in a prompt recalls "My", not this note. Write z:[[My Note]] to recall it.',
          "My Note.md: warning: The note has no description, so zambil search and the similar notes in a prompt never find it. Add `description: <one sentence>` to its frontmatter.",
          "",
        ].join("\n"),
      },
      {
        code: 0,
        stdout: "Created end..md.\n",
        stderr:
          'end..md: warning: A plain z:end. in a prompt recalls "end", not this note. Write z:[[end.]] to recall it.\n',
      },
      { code: 0, stdout: "Created it-is.md.\n", stderr: "" },
    ]);
  });
});

const welcome = "---\ndescription: Shows that zambil works.\nhooks: [SessionStart]\n---\nHello.\n";

/** A machine with its own home and cache folder, and the config that reads them. */
async function testMachine(): Promise<CliConfig> {
  const home = await mkdtemp(join(tmpdir(), "zambil-home-"));
  const environment = { home, workingFolder: home, cacheHome: join(home, "cache") };
  return { environment, claudeConfigFolder: join(home, "claude") };
}

/** A machine whose cache links to the model in the shared cache, so that a save can load it. */
async function machineWithModel(): Promise<CliConfig> {
  const shared = { home: homedir(), workingFolder: "/" };
  const loaded = await openNoteSearch(shared, { report: () => undefined, download: "allow" });
  if (!loaded.ok) throw new Error(loaded.error);
  const config = await testMachine();
  const cache = join(config.environment.cacheHome ?? "", "zambil");
  await mkdir(cache, { recursive: true });
  await symlink(join(homedir(), ".cache", "zambil", "models"), join(cache, "models"));
  return config;
}

/** The config of the machine that the check reads. */
interface SimilarCheckOptions {
  config: CliConfig;
}

/** The doctor line for similar notes, for the repo as it is on disk now. */
function similarCheck(root: string, options: SimilarCheckOptions) {
  const repo = loadRepo(root);
  if (!repo.ok) throw new Error(repo.error.message);
  return checkSimilar(repo.value, { environment: options.config.environment, repoFlag: root });
}

describe("saveCommand and the index for similar notes", () => {
  test(
    "adds the new note to the index when the model is in the cache, so doctor finds nothing to fix",
    { timeout: 120_000 },
    async () => {
      const config = await machineWithModel();
      const root = await writeTestRepo({ "zambil-welcome.md": welcome });
      const result = await run(["deploy", "--repo", root, "--no-expires"], { input: note, config });
      expect({ result, check: await similarCheck(root, { config }) }).toEqual({
        result: { code: 0, stdout: "Created deploy.md.\n", stderr: "" },
        check: {
          level: "ok",
          text: "The model and the index for similar notes are ready: 2 descriptions and triggers.",
        },
      });
    },
  );

  test("saves the note when the model does not load, and says how to index", async () => {
    const config = await testMachine();
    const root = await writeTestRepo({});
    const written = await writeTestSearchFiles(config.environment, { root, descriptions: [] });
    if (!written.ok) throw new Error(written.error);
    const result = await run(["deploy", "--repo", root, "--no-expires"], { input: note, config });
    expect({ result, isSaved: existsSync(join(root, "deploy.md")) }).toEqual({
      result: {
        code: 0,
        stdout: "Created deploy.md.\n",
        stderr: expect.stringMatching(
          /^deploy\.md: warning: zambil cannot add the note to the index for similar notes: .+\. Run zambil index --repo .+\.\n$/s,
        ),
      },
      isSaved: true,
    });
  });

  test("never downloads a model that is not in the cache", async () => {
    const config = await testMachine();
    const root = await writeTestRepo({});
    const result = await run(["deploy", "--repo", root, "--no-expires"], { input: note, config });
    const models = join(config.environment.cacheHome ?? "", "zambil", "models");
    expect({ result, hasModels: existsSync(models) }).toEqual({
      result: { code: 0, stdout: "Created deploy.md.\n", stderr: "" },
      hasModels: false,
    });
  });
});

describe("saveCommand and notes with a similar description", () => {
  test(
    "refuses a new note that repeats a current note, unless --allow-similar is given",
    { timeout: 120_000 },
    async () => {
      const config = await machineWithModel();
      const blog = [
        "---",
        "description: How to deploy the blog.",
        "expires: 2027-06-01",
        'when-expired: "[[deploy-blog]]"',
        "---",
        "Run `make blog`.",
        "",
      ].join("\n");
      const root = await writeTestRepo({ "ops/deploy-blog.md": blog });
      const repeat = "---\ndescription: Steps to deploy the blog.\n---\nRun `make blog`.\n";
      const other = "---\ndescription: How to write a commit message.\n---\nShort.\n";
      const refused = await run(["publish-blog", "--repo", root, "--no-expires"], {
        input: repeat,
        config,
      });
      const isRefusedSaved = existsSync(join(root, "publish-blog.md"));
      const merged = "---\ndescription: How to deploy the blog.\n---\nRun `make blog` from main.\n";
      const rewrite = await run(
        ["deploy-blog", "--rewrite", "--expires", "2027-06-01", "--repo", root],
        { input: merged, config },
      );
      const rewritten = await readFile(join(root, "ops/deploy-blog.md"), "utf8");
      const allowed = await run(
        ["publish-blog", "--repo", root, "--no-expires", "--allow-similar"],
        {
          input: repeat,
          config,
        },
      );
      const distinct = await run(["commit-messages", "--repo", root, "--no-expires"], {
        input: other,
        config,
      });
      const refusal = {
        code: refused.code,
        stdout: refused.stdout,
        lines: refused.stderr.split("\n"),
      };
      expect({ refusal, isRefusedSaved, rewrite, rewritten, allowed, distinct }).toEqual({
        refusal: {
          code: 1,
          stdout: "",
          lines: [
            'zambil did not save "publish-blog". A current note has a very similar description:',
            "  SCORE  NAME         PATH                DESCRIPTION",
            expect.stringMatching(
              /^ {2}0\.9\d {3}deploy-blog {2}ops\/deploy-blog\.md {2}How to deploy the blog\.$/,
            ),
            "If the new note says the same, put its text into deploy-blog, the best match, instead. This command keeps the expiry of that note:",
            `  zambil save deploy-blog --rewrite --expires 2027-06-01 --repo ${root} < merged-text.md`,
            "If it is about something else, run the same save again with --allow-similar.",
            "",
          ],
        },
        isRefusedSaved: false,
        rewrite: { code: 0, stdout: "Rewrote ops/deploy-blog.md.\n", stderr: "" },
        rewritten: blog.replace("Run `make blog`.", "\nRun `make blog` from main."),
        allowed: { code: 0, stdout: "Created publish-blog.md.\n", stderr: "" },
        distinct: { code: 0, stdout: "Created commit-messages.md.\n", stderr: "" },
      });
    },
  );

  test(
    "does not refuse a new note whose description is close to a trigger of another note",
    { timeout: 120_000 },
    async () => {
      const config = await machineWithModel();
      const conventions =
        "---\ndescription: Team conventions for git commits.\ntriggers: [write a commit message]\n---\nShort.\n";
      const root = await writeTestRepo({ "git/conventions.md": conventions });
      const input = "---\ndescription: How to write a good commit message.\n---\nShort.\n";
      const saved = await run(["commit-messages", "--repo", root, "--no-expires"], {
        input,
        config,
      });
      expect(saved).toEqual({ code: 0, stdout: "Created commit-messages.md.\n", stderr: "" });
    },
  );
});

describe("saveCommand and zambil install", () => {
  test("says to run zambil install only for a hook of this repo that has no zambil hook yet", async () => {
    const config = await testMachine();
    const claude = config.claudeConfigFolder ?? "";
    const settings = join(claude, "settings.json");
    const root = await writeTestRepo({});
    const otherRoot = await writeTestRepo({});
    const handler = { type: "command", command: `zambil hook --repo ${root}` };
    const hooks = {
      SessionStart: [{ hooks: [handler] }],
      UserPromptSubmit: [{ hooks: [handler] }],
    };
    await mkdir(claude, { recursive: true });
    await writeFile(settings, JSON.stringify({ hooks }));
    const startNote = "---\ndescription: Greet.\nhooks: [SessionStart]\n---\nHello.\n";
    const toolNote = "---\ndescription: Shell.\nhooks: [PreToolUse]\n---\nUse bash.\n";
    const atStart = await run(["greet", "--repo", root, "--no-expires"], {
      input: startNote,
      config,
    });
    const atTool = await run(["shell", "--repo", root, "--no-expires"], {
      input: toolNote,
      config,
    });
    const inOtherRepo = await run(["shell", "--repo", otherRoot, "--no-expires"], {
      input: toolNote,
      config,
    });
    expect({ atStart, atTool, inOtherRepo }).toEqual({
      atStart: { code: 0, stdout: "Created greet.md.\n", stderr: "" },
      atTool: {
        code: 0,
        stdout: "Created shell.md.\n",
        stderr: [
          `The note names PreToolUse, but the zambil hooks in ${settings} do not run there yet for this note.`,
          `To connect it, the user runs: zambil install --repo ${root}`,
          "Then the note reaches the agent from the next Claude Code session on.",
          "",
        ].join("\n"),
      },
      inOtherRepo: { code: 0, stdout: "Created shell.md.\n", stderr: "" },
    });
  });
});
