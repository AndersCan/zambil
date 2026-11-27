import { describe, expect, test } from "vite-plus/test";
import { hookListPath, loadHookList } from "./load-hook-list.ts";
import { mkdtemp, readFile } from "node:fs/promises";
import type { Either } from "@zambil/core/either";
import { join } from "node:path";
import { left } from "@zambil/core/either";
import { refreshHookList } from "./refresh-hook-list.ts";
import { right } from "@zambil/core/either";
import { tmpdir } from "node:os";

const page = [
  "| Event | When it fires |",
  "| :- | :- |",
  "| `UserPromptSubmit` | When a prompt is submitted |",
  "| `Notification` | When Claude Code sends a notification |",
  "",
  "## Hook events",
  "",
  "### UserPromptSubmit",
  "",
  "| `additionalContext` | String added to Claude's context alongside the submitted prompt |",
].join("\n");

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
      return Promise.resolve(right(page));
    }
    const now = new Date("2026-12-01T10:00:00Z");
    const refreshed = await refreshHookList(environment, { download, now });
    const list = {
      source: "https://code.claude.com/docs/en/hooks.md",
      readOn: "2026-12-01",
      hooks: ["UserPromptSubmit", "Notification"],
      contextHooks: ["UserPromptSubmit"],
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
    expect({ offline, changed, origin: loadHookList(environment).origin }).toEqual({
      offline: { ok: false, error: "cannot download: offline" },
      changed: {
        ok: false,
        error:
          "cannot read the hook list from https://code.claude.com/docs/en/hooks.md: the page has no table of hook events",
      },
      origin: "bundled",
    });
  });
});
