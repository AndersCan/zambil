import { describe, expect, test } from "vite-plus/test";
import { locateRepo } from "./locate-repo.ts";
import type { UserEnvironment } from "./locate-repo.ts";
import { writeTestRepo } from "../repo/write-test-repo.ts";

const base: UserEnvironment = { home: "/home/ada", workingFolder: "/work/project" };

function configHome(text: string): Promise<string> {
  return writeTestRepo({ "zambil/config.json": text });
}

describe("locateRepo", () => {
  test("prefers the flag, then the environment variable, and expands the home folder", () => {
    const environment = { ...base, repo: "~/notes" };
    expect([locateRepo({ flag: "../notes", environment }), locateRepo({ environment })]).toEqual([
      { ok: true, value: { root: "/work/notes", source: "flag" } },
      { ok: true, value: { root: "/home/ada/notes", source: "environment" } },
    ]);
  });

  test("reads the user config file, relative to its folder", async () => {
    const folder = await configHome('{ "repo": "../my-notes" }');
    const located = locateRepo({ environment: { ...base, configHome: folder } });
    expect(located).toEqual({
      ok: true,
      value: { root: `${folder}/my-notes`, source: "user-config" },
    });
  });

  test("tells a missing config file from a broken one", async () => {
    const empty = await writeTestRepo({});
    const broken = await configHome('{ "path": "~/notes" }');
    expect([
      locateRepo({ environment: { ...base, configHome: empty } }),
      locateRepo({ environment: { ...base, configHome: broken } }),
    ]).toEqual([
      { ok: false, error: { kind: "not-configured", configPath: `${empty}/zambil/config.json` } },
      {
        ok: false,
        error: {
          kind: "invalid-config",
          configPath: `${broken}/zambil/config.json`,
          message: 'it needs a "repo" key with the path of the configuration repo',
        },
      },
    ]);
  });
});
