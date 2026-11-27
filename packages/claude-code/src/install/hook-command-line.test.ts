import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import { hookCommandLine } from "./hook-command-line.ts";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

interface ScriptOptions {
  text: string;
}

async function writeScript(path: string, options: ScriptOptions): Promise<void> {
  await writeFile(path, options.text);
  await chmod(path, 0o755);
}

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

  test("runs zambil with a shell whose PATH has no node", async () => {
    const folder = await mkdtemp(join(tmpdir(), "zambil-node-"));
    const nodeFolder = join(folder, "node bin");
    await mkdir(nodeFolder);
    await writeScript(join(nodeFolder, "node"), { text: '#!/bin/sh\necho "node $*"\n' });
    const zambilPath = join(folder, "zambil");
    await writeScript(zambilPath, { text: "#!/usr/bin/env node\n" });
    const command = hookCommandLine({
      zambilPath,
      repoRoot: join(folder, "notes"),
      compileCache: join(folder, "cache"),
      nodeFolders: [join(folder, "gone"), nodeFolder],
    });
    const result = spawnSync("/bin/sh", ["-c", command], {
      encoding: "utf8",
      env: { PATH: "/usr/bin:/bin" },
    });
    expect({ status: result.status, stdout: result.stdout }).toEqual({
      status: 0,
      stdout: `node ${zambilPath} hook --repo ${folder}/notes\n`,
    });
  });
});
