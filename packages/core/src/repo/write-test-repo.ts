import { dirname, join } from "node:path";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

/** Writes a configuration repo for a test into a new temporary folder and returns its path. */
export async function writeTestRepo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "zambil-repo-"));
  await Promise.all(
    Object.entries(files).map(async ([path, text]) => {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), text);
    }),
  );
  return root;
}
