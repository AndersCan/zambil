import { describe, expect, test } from "vite-plus/test";
import { listCommand } from "./list-command.ts";
import { writeTestRepo } from "@zambil/core/write-test-repo";

async function run(args: string[]) {
  const printed = { stdout: "", stderr: "" };
  const output = {
    write: (text: string) => {
      printed.stdout += text;
    },
    error: (text: string) => {
      printed.stderr += text;
    },
  };
  const code = await listCommand.run({
    args,
    config: { environment: { home: "/home/ada", workingFolder: "/" } },
    input: { readAll: () => Promise.reject(new Error("read standard input")) },
    output,
    now: new Date(2026, 10, 27),
  });
  return { code, ...printed };
}

interface NoteOptions {
  aliases?: string;
}

function note(description: string, options: NoteOptions = {}): string {
  const aliases = options.aliases ?? "[]";
  return `---\ndescription: ${description}\naliases: ${aliases}\n---\nText.\n`;
}

function lines(text: string): string[] {
  return text.trimEnd().split("\n");
}

describe("listCommand", () => {
  test("keeps the notes that have each word in the name, an alias or the description", async () => {
    const root = await writeTestRepo({
      "deploy-blog.md": note("How to publish the blog."),
      "deploy-webshop.md": note("How to ship the shop.", { aliases: "[release-shop]" }),
      "commit-messages.md": note("How to write a commit message."),
    });
    const results = await Promise.all([
      run(["DEPLOY", "--repo", root]),
      run(["release", "shop", "--repo", root]),
      run(["commit", "blog", "--repo", root]),
      run(["publish", "--repo", root]),
    ]);
    expect(results).toEqual([
      {
        code: 0,
        stdout: [
          "NAME            KIND  PATH               DESCRIPTION",
          "deploy-blog     note  deploy-blog.md     How to publish the blog.",
          "deploy-webshop  note  deploy-webshop.md  How to ship the shop.",
          "",
        ].join("\n"),
        stderr: "",
      },
      {
        code: 0,
        stdout: [
          "NAME            KIND  PATH               DESCRIPTION",
          "deploy-webshop  note  deploy-webshop.md  How to ship the shop.",
          "",
        ].join("\n"),
        stderr: "",
      },
      {
        code: 0,
        stdout: [
          'No note has each word of "commit blog" in its name, an alias or its description.',
          `To find notes with a similar description, run \`zambil search 'commit blog' --repo ${root}\`. To see every name, run \`zambil list --repo ${root}\`.`,
          "",
        ].join("\n"),
        stderr: "",
      },
      {
        code: 0,
        stdout: [
          "NAME         KIND  PATH            DESCRIPTION",
          "deploy-blog  note  deploy-blog.md  How to publish the blog.",
          "",
        ].join("\n"),
        stderr: "",
      },
    ]);
  });

  test("lists at most 100 notes and says how to find the rest, unless --all is given", async () => {
    const files: Record<string, string> = {};
    for (let number = 100; number < 205; number += 1) {
      files[`note-${number}.md`] = note(`Note ${number}.`);
    }
    const root = await writeTestRepo(files);
    const limited = await run(["--repo", root]);
    const all = await run(["--all", "--repo", root]);
    const filtered = await run(["note", "--repo", root]);
    expect({
      limited: { code: limited.code, last: lines(limited.stdout).at(-1), stderr: limited.stderr },
      all: { code: all.code, count: lines(all.stdout).length, stderr: all.stderr },
      filtered: filtered.stderr,
    }).toEqual({
      limited: {
        code: 0,
        last: "note-199  note  note-199.md  Note 199.",
        stderr: [
          `zambil listed 100 of 105 notes. To find a note, run \`zambil list <word> --repo ${root}\` or \`zambil search "<what the note is about>" --repo ${root}\`.`,
          "To list every note, add --all.",
          "",
        ].join("\n"),
      },
      all: { code: 0, count: 106, stderr: "" },
      filtered: [
        'zambil listed 100 of the 105 notes that have each word of "note".',
        "To narrow the list, add a word. To list every match, add --all.",
        "",
      ].join("\n"),
    });
  });
});
