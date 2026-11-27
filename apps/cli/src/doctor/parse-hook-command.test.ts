import { describe, expect, test } from "vite-plus/test";
import { hookCommandLine } from "@zambil/claude-code/hook-command-line";
import { parseHookCommand } from "./parse-hook-command.ts";

describe("parseHookCommand", () => {
  test("reads the paths back from the command line that install writes, and from older ones", () => {
    const installed = hookCommandLine({
      zambilPath: "/home/ada/it's here/zambil",
      repoRoot: "/home/ada/my notes",
      compileCache: "/home/ada/.cache/zambil/node-compile-cache",
      nodeFolders: ["/opt/homebrew/bin"],
    });
    expect([
      parseHookCommand(installed),
      parseHookCommand("zambil hook"),
      parseHookCommand('"/opt/zambil" hook --repo /notes\\ shop'),
    ]).toEqual([
      { zambilPath: "/home/ada/it's here/zambil", repoRoot: "/home/ada/my notes" },
      { zambilPath: "zambil" },
      { zambilPath: "/opt/zambil", repoRoot: "/notes shop" },
    ]);
  });
});
