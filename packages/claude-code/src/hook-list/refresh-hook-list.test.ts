import { bundledHookList, hookListPath, loadHookList } from "./load-hook-list.ts";
import { describe, expect, test } from "vite-plus/test";
import { mkdtemp, readFile } from "node:fs/promises";
import type { Either } from "@zambil/core/either";
import { join } from "node:path";
import { left } from "@zambil/core/either";
import { refreshHookList } from "./refresh-hook-list.ts";
import { right } from "@zambil/core/either";
import { tmpdir } from "node:os";

const contextHooks = bundledHookList.contextHooks;

/** A page in the shape of the hooks reference: every bundled context hook, and `Notification`. */
function hooksPage(quietHook: string | undefined): string {
  const lines = ["| Event | When it fires |", "| :- | :- |"];
  for (const hook of [...contextHooks, "Notification"]) lines.push(`| \`${hook}\` | A moment |`);
  lines.push("", "## Hook events");
  for (const hook of contextHooks) {
    const output =
      hook === quietHook ? "| `reason` | Text |" : "| `additionalContext` | Text for Claude |";
    lines.push("", `### ${hook}`, "", output);
  }
  return lines.join("\n");
}

async function testEnvironment(): Promise<{
  home: string;
  workingFolder: string;
  cacheHome: string;
}> {
  const home = await mkdtemp(join(tmpdir(), "zambil-home-"));
  return { home, workingFolder: home, cacheHome: join(home, "cache") };
}

describe("refreshHookList", () => {
  test("keeps the list from the page in the cache, where loadHookList finds it", async () => {
    const environment = await testEnvironment();
    const before = loadHookList(environment);
    const downloads: string[] = [];
    function download(url: string): Promise<Either<string, string>> {
      downloads.push(url);
      return Promise.resolve(right(hooksPage(undefined)));
    }
    const now = new Date("2026-12-01T10:00:00Z");
    const refreshed = await refreshHookList(environment, { download, now });
    const list = {
      source: "https://code.claude.com/docs/en/hooks.md",
      readOn: "2026-12-01",
      hooks: [...contextHooks, "Notification"],
      contextHooks,
    };
    const cached = JSON.parse(await readFile(hookListPath(environment), "utf8"));
    expect({
      origin: before.origin,
      downloads,
      refreshed,
      cached,
      after: loadHookList(environment),
    }).toEqual({
      origin: "bundled",
      downloads: ["https://code.claude.com/docs/en/hooks.md"],
      refreshed: { ok: true, value: list },
      cached: list,
      after: { list, origin: "cache" },
    });
  });

  test("keeps the old list when the page cannot be read", async () => {
    const environment = await testEnvironment();
    const now = new Date("2026-12-01T10:00:00Z");
    const offline = await refreshHookList(environment, {
      download: () => Promise.resolve(left("cannot download: offline")),
      now,
    });
    const changed = await refreshHookList(environment, {
      download: () => Promise.resolve(right("# Hooks\n")),
      now,
    });
    const quieter = await refreshHookList(environment, {
      download: () => Promise.resolve(right(hooksPage("SessionStart"))),
      now,
    });
    expect({ offline, changed, quieter, origin: loadHookList(environment).origin }).toEqual({
      offline: { ok: false, error: "cannot download: offline" },
      changed: {
        ok: false,
        error:
          "cannot read the hook list from https://code.claude.com/docs/en/hooks.md: the page has no table of hook events",
      },
      quieter: {
        ok: false,
        error:
          "https://code.claude.com/docs/en/hooks.md no longer says that SessionStart can add context. zambil keeps the old list, because the page may only have changed its wording",
      },
      origin: "bundled",
    });
  });
});
