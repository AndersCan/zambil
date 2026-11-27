import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { describe, expect, test } from "vite-plus/test";
import { join } from "node:path";
import { replaceText } from "./text-file.ts";
import { tmpdir } from "node:os";

describe("replaceText", () => {
  test("writes through a symbolic link and keeps the permissions of the file", async () => {
    const home = await mkdtemp(join(tmpdir(), "zambil-home-"));
    const dotfiles = join(home, "dotfiles");
    await mkdir(dotfiles);
    const target = join(dotfiles, "settings.json");
    await writeFile(target, "{}\n");
    await chmod(target, 0o600);
    const link = join(home, "settings.json");
    await symlink(target, link);
    const replaced = await replaceText(link, { text: '{ "model": "opus" }\n' });
    const isLink = (await lstat(link)).isSymbolicLink();
    const mode = (await stat(target)).mode & 0o777;
    expect({
      replaced,
      isLink,
      mode,
      text: await readFile(target, "utf8"),
      files: await readdir(dotfiles),
    }).toEqual({
      replaced: { ok: true, value: link },
      isLink: true,
      mode: 0o600,
      text: '{ "model": "opus" }\n',
      files: ["settings.json"],
    });
  });
});
