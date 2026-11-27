import { describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { saveCommand } from "./save-command.ts";
import { writeTestRepo } from "@zambil/core/write-test-repo";

interface RunOptions {
  input?: string;
}

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
  const input = { readAll: () => Promise.resolve(options.input ?? "") };
  const config = { environment: { home: "/home/ada", workingFolder: "/" } };
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
    const result = await run(["deploy", "--verified", "--expires", "2027-03-01", "--repo", root], {
      input: "ignored",
    });
    expect({ result, text: await readFile(join(root, "deploy.md"), "utf8") }).toEqual({
      result: { code: 0, stdout: "Verified deploy.md. It expires 2027-03-01 now.\n", stderr: "" },
      text: "---\nexpires: 2027-03-01\nwhen-expired: deploy\n---\nText.\n",
    });
  });

  test("makes the writer choose about expiry and the mode", async () => {
    const root = await writeTestRepo({ "deploy.md": note });
    const results = await Promise.all([
      run(["deploy", "--repo", root], { input: note }),
      run(["deploy", "--repo", root, "--no-expires"], { input: note }),
      run(["new", "--repo", root, "--no-expires"]),
      run(["deploy", "--repo", root, "--verified", "--no-expires"]),
      run(["new", "--repo", root, "--no-expires", "--when-expired", "deploy"], { input: note }),
    ]);
    const messages = results.map((result) => {
      const lines = result.stderr.split("\n");
      return [result.code, ...lines.filter((line) => line !== "" && !line.startsWith("Usage:"))];
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
    ]);
  });
});
