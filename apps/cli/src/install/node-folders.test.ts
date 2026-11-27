import { chmod, mkdir, mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import { nodeFolders } from "./node-folders.ts";
import { tmpdir } from "node:os";

describe("nodeFolders", () => {
  test("keeps a folder that a manager updates, and leaves out a folder that is a link", async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "zambil-node-")));
    const installed = join(root, "installs", "24.1.0", "bin");
    await mkdir(installed, { recursive: true });
    await writeFile(join(installed, "node"), "#!/bin/sh\n");
    await chmod(join(installed, "node"), 0o755);
    const shims = join(root, "shims");
    await mkdir(shims);
    await symlink(join(installed, "node"), join(shims, "node"));
    const shell = join(root, "multishells", "4242_1");
    await mkdir(join(root, "multishells"));
    await symlink(join(root, "installs", "24.1.0"), shell);
    expect(
      await Promise.all([
        nodeFolders({ searchPath: [shims] }),
        nodeFolders({ searchPath: [join(shell, "bin")] }),
        nodeFolders({ searchPath: [installed] }),
        nodeFolders({ searchPath: [root] }),
      ]),
    ).toEqual([[shims, installed], [installed], [installed], []]);
  });
});
