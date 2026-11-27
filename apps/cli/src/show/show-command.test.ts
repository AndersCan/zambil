import { basename, dirname } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { showCommand } from "./show-command.ts";
import { writeTestRepo } from "@zambil/core/write-test-repo";

async function show(args: string[]) {
  const root = await writeTestRepo({
    "today.md": "---\ndescription: The date.\nexpires: 2026-11-28\n---\nToday is 2026-11-27.\n",
  });
  const printed = { stdout: "", stderr: "" };
  const output = {
    write: (text: string) => {
      printed.stdout += text;
    },
    error: (text: string) => {
      printed.stderr += text;
    },
  };
  const environment = { home: "/home/ada", workingFolder: "/", repo: root };
  const code = await showCommand.run({
    args,
    config: { environment },
    input: { readAll: () => Promise.resolve("") },
    output,
    now: new Date(2026, 10, 29),
  });
  return { code, ...printed };
}

describe("showCommand", () => {
  test("warns about an expired note, reads it with --expired and fails for an unknown name", async () => {
    const warned = await show(["today"]);
    const read = await show(["today", "--expired"]);
    const unknown = await show(["nope"]);
    const usage = await show([]);
    expect({
      warned: [warned.code, warned.stdout.split("\n")[3]],
      read: [read.code, read.stdout.split("\n").at(-3)],
      unknown,
      usage: usage.code,
    }).toEqual({
      warned: [0, "You can skip this note. To read it anyway, run `zambil show today --expired`."],
      read: [0, "Today is 2026-11-27."],
      unknown: {
        code: 1,
        stdout: 'Warning: zambil cannot show "nope", because no note has the name "nope".\n',
        stderr: "",
      },
      usage: 2,
    });
  });

  test("prints the full path of a relative --repo in the commands that it prints", async () => {
    const root = await writeTestRepo({ "a.md": "[[b c]]", "b c.md": "B." });
    const printed: string[] = [];
    const output = { write: (text: string) => printed.push(text), error: () => 0 };
    await showCommand.run({
      args: ["a", "--repo", basename(root)],
      config: { environment: { home: "/home/ada", workingFolder: dirname(root) } },
      input: { readAll: () => Promise.resolve("") },
      output,
      now: new Date(),
    });
    expect(printed.join("").split("\n").at(-3)).toBe(
      `- [[b c]]: It has no description. To read it, run \`zambil show 'b c' --repo ${root}\`.`,
    );
  });
});
