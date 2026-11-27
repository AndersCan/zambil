import { describe, expect, test } from "vite-plus/test";
import { hookCommandLine } from "./hook-command-line.ts";

describe("hookCommandLine", () => {
  test("puts the node folders first on the PATH and quotes each path", () => {
    const paths = {
      zambilPath: "/home/ada/.local/bin/zambil",
      repoRoot: "/home/ada/my notes",
      compileCache: "/home/ada/.cache/zambil/node-compile-cache",
    };
    expect([
      hookCommandLine({
        ...paths,
        nodeFolders: ["/opt/homebrew/bin", "/opt/homebrew/Cellar/node/24.1.0/bin"],
      }),
      hookCommandLine({ ...paths, nodeFolders: [] }),
    ]).toEqual([
      "PATH=/opt/homebrew/bin:/opt/homebrew/Cellar/node/24.1.0/bin:$PATH NODE_COMPILE_CACHE=/home/ada/.cache/zambil/node-compile-cache /home/ada/.local/bin/zambil hook --repo '/home/ada/my notes'",
      "NODE_COMPILE_CACHE=/home/ada/.cache/zambil/node-compile-cache /home/ada/.local/bin/zambil hook --repo '/home/ada/my notes'",
    ]);
  });
});
