import { dirname, join, resolve } from "node:path";
import { left, right } from "../either.ts";
import type { Either } from "../either.ts";
import { parseUserConfig } from "./parse-user-config.ts";
import { readTextFile } from "../repo/read-text-file.ts";

/**
 * What zambil reads from the user's environment. The CLI fills it once at startup. `cacheHome` is
 * `XDG_CACHE_HOME`, for files that zambil can rebuild, such as an index.
 */
export interface UserEnvironment {
  home: string;
  workingFolder: string;
  repo?: string;
  configHome?: string;
  cacheHome?: string;
}

/** The `--repo` flag, if the user gave one, and the environment. */
export interface LocateRepoOptions {
  flag?: string | undefined;
  environment: UserEnvironment;
}

/** Where the repo path came from: the `--repo` flag, `ZAMBIL_REPO` or the user config file. */
export type RepoSource = "flag" | "environment" | "user-config";

/** The absolute path of the configuration repo, where it came from, and the path as the source wrote it. */
export interface RepoLocation {
  root: string;
  source: RepoSource;
  written: string;
}

/** The flag is blank, no source names a repo, or the user config file cannot be used. */
export type LocateRepoError =
  | { kind: "empty-flag" }
  | { kind: "not-configured"; configPath: string }
  | { kind: "invalid-config"; configPath: string; message: string };

function expandHome(path: string, environment: UserEnvironment): string {
  if (path === "~") return environment.home;
  if (path.startsWith("~/")) return join(environment.home, path.slice(2));
  return path;
}

/** The user config file: `$XDG_CONFIG_HOME/zambil/config.json`, or `~/.config/zambil/config.json`. */
export function userConfigPath(environment: UserEnvironment): string {
  const configHome = environment.configHome ?? join(environment.home, ".config");
  return join(configHome, "zambil", "config.json");
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/**
 * Finds the configuration repo. The `--repo` flag wins, then `ZAMBIL_REPO`, then the `repo` key of the
 * user config file. A relative path in the config file is relative to the folder of that file.
 */
export function locateRepo(options: LocateRepoOptions): Either<LocateRepoError, RepoLocation> {
  const { environment } = options;
  if (options.flag?.trim() === "") return left({ kind: "empty-flag" });
  if (options.flag !== undefined) {
    return right({
      root: resolve(environment.workingFolder, expandHome(options.flag, environment)),
      source: "flag",
      written: options.flag,
    });
  }
  if (environment.repo !== undefined) {
    const root = resolve(environment.workingFolder, expandHome(environment.repo, environment));
    return right({ root, source: "environment", written: environment.repo });
  }

  const configPath = userConfigPath(environment);
  const text = readTextFile(configPath);
  if (!text.ok) {
    if (isMissingFile(text.error)) return left({ kind: "not-configured", configPath });
    const message = text.error instanceof Error ? text.error.message : String(text.error);
    return left({ kind: "invalid-config", configPath, message });
  }
  const config = parseUserConfig(text.value);
  if (!config.ok) return left({ kind: "invalid-config", configPath, message: config.error });
  const root = resolve(dirname(configPath), expandHome(config.value.repo, environment));
  return right({ root, source: "user-config", written: config.value.repo });
}
