import { describe, expect, test } from "vite-plus/test";
import { mkdir, mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
import { findProjectPlace } from "./project-place.ts";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("findProjectPlace", () => {
  test("names the git repo above the folder at any depth, a worktree by its main clone, and a folder with no repo", async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "zambil-place-")));
    const webshop = join(root, "git", "webshop");
    await mkdir(join(webshop, ".git"), { recursive: true });
    await mkdir(join(webshop, "apps", "web"), { recursive: true });
    const worktree = join(root, "git", "webshop-dark-mode");
    await mkdir(worktree, { recursive: true });
    const gitDir = join(webshop, ".git", "worktrees", "webshop-dark-mode");
    await writeFile(join(worktree, ".git"), `gitdir: ${gitDir}\n`);
    const loose = join(root, "scratch");
    await mkdir(loose);
    const bareWorktree = join(root, "git", "blog", "main");
    await mkdir(bareWorktree, { recursive: true });
    const bareStore = join(root, "git", "blog", ".bare", "worktrees", "main");
    await writeFile(join(bareWorktree, ".git"), `gitdir: ${bareStore}\n`);
    const link = join(root, "shop-link");
    await symlink(webshop, link);
    const home = "/home/ada";
    expect([
      findProjectPlace(join(webshop, "apps", "web"), { home }),
      findProjectPlace(worktree, { home }),
      findProjectPlace(`${webshop}/`, { home }),
      findProjectPlace(loose, { home }).projects,
      findProjectPlace(bareWorktree, { home }).projects,
      findProjectPlace(join(link, "apps"), { home }),
    ]).toEqual([
      { folder: join(webshop, "apps", "web"), projects: ["webshop"], home },
      { folder: worktree, projects: ["webshop", "webshop-dark-mode"], home },
      { folder: webshop, projects: ["webshop"], home },
      ["scratch"],
      ["blog", "main"],
      { folder: join(webshop, "apps"), projects: ["webshop"], home },
    ]);
  });
});
