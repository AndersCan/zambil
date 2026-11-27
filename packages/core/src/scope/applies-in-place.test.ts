import { describe, expect, test } from "vite-plus/test";
import { appliesInPlace } from "./applies-in-place.ts";
import { loadRepo } from "../repo/load-repo.ts";
import { writeTestRepo } from "../repo/write-test-repo.ts";

const home = "/home/ada";

describe("appliesInPlace", () => {
  test("applies a note with projects or paths only in that project or under that path", async () => {
    const root = await writeTestRepo({
      "anywhere.md": "Everywhere.\n",
      "deploy-blog.md": "---\nprojects: [Blog]\n---\nRun make blog.\n",
      "deploy-webshop.md": '---\npaths: ["~/git/webshop"]\n---\nRun make shop.\n',
      "both.md": '---\nprojects: blog\npaths: ["/srv/shop/", "relative/path"]\n---\nBoth.\n',
    });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const places = {
      blog: { folder: "/home/ada/git/blog/posts", projects: ["blog", "posts"], home },
      webshop: { folder: "/home/ada/git/webshop/src", projects: ["webshop", "src"], home },
      lookalike: { folder: "/home/ada/git/webshop-old", projects: ["webshop-old"], home },
      server: { folder: "/srv/shop", projects: ["shop"], home },
      other: { folder: "/home/ada/git/other", projects: ["other"], home },
      unknown: undefined,
    };
    const applies: Record<string, string[]> = {};
    for (const [label, place] of Object.entries(places)) {
      const names: string[] = [];
      for (const note of repo.value.notes) {
        if (appliesInPlace(note, { place })) names.push(note.name);
      }
      applies[label] = names;
    }
    expect(applies).toEqual({
      blog: ["anywhere", "both", "deploy-blog"],
      webshop: ["anywhere", "deploy-webshop"],
      lookalike: ["anywhere"],
      server: ["anywhere", "both"],
      other: ["anywhere"],
      unknown: ["anywhere"],
    });
  });
});
