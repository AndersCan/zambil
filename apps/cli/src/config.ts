import { delimiter } from "node:path";
import { homedir } from "node:os";
import type { UserEnvironment } from "@zambil/core/locate-repo";

/**
 * Everything the CLI reads from the process at startup. Commands read this, never `process.env`.
 * `claudeConfigFolder` is `CLAUDE_CONFIG_DIR`, and `searchPath` holds the folders of `PATH`.
 */
export interface CliConfig {
  environment: UserEnvironment;
  claudeConfigFolder?: string;
  searchPath?: string[];
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

/**
 * Reads `ZAMBIL_REPO`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `CLAUDE_CONFIG_DIR`, `PATH`, the home folder
 * and the working folder once.
 */
export function readCliConfig(): CliConfig {
  const environment: UserEnvironment = { home: homedir(), workingFolder: process.cwd() };
  const repo = nonEmpty(process.env.ZAMBIL_REPO);
  if (repo !== undefined) environment.repo = repo;
  const configHome = nonEmpty(process.env.XDG_CONFIG_HOME);
  if (configHome !== undefined) environment.configHome = configHome;
  const cacheHome = nonEmpty(process.env.XDG_CACHE_HOME);
  if (cacheHome !== undefined) environment.cacheHome = cacheHome;
  const config: CliConfig = { environment, searchPath: (process.env.PATH ?? "").split(delimiter) };
  const claudeConfigFolder = nonEmpty(process.env.CLAUDE_CONFIG_DIR);
  if (claudeConfigFolder !== undefined) config.claudeConfigFolder = claudeConfigFolder;
  return config;
}
