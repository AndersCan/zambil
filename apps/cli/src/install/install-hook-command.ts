import type { CliConfig } from "../config.ts";
import { hookCommandLine } from "@zambil/claude-code/hook-command-line";
import { join } from "node:path";
import { nodeFolders } from "./node-folders.ts";

/** The startup config, and the full path of `zambil` on the `PATH`. */
export interface InstallHookCommandOptions {
  config: CliConfig;
  zambilPath: string;
}

/** The command line that `zambil install` writes into each zambil hook for this repo now. */
export async function installHookCommand(
  repoRoot: string,
  options: InstallHookCommandOptions,
): Promise<string> {
  const { environment, searchPath } = options.config;
  const cacheHome = environment.cacheHome ?? join(environment.home, ".cache");
  const compileCache = join(cacheHome, "zambil", "node-compile-cache");
  const folders = await nodeFolders({ searchPath: searchPath ?? [] });
  return hookCommandLine({
    zambilPath: options.zambilPath,
    repoRoot,
    compileCache,
    nodeFolders: folders,
  });
}
