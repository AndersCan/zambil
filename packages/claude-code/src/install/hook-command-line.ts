import { quoteArgument } from "@zambil/core/quote-argument";

/** The `zambil` program, the configuration repo and the Node compile cache, all as full paths. */
export interface HookCommandLineOptions {
  zambilPath: string;
  repoRoot: string;
  compileCache: string;
}

/**
 * The shell command that each hook runs. `NODE_COMPILE_CACHE` must be set before Node starts to save
 * the compile time on each event. The full paths make it work from any project folder. Only `node`
 * must be on the `PATH` of Claude Code. `--repo` comes after `hook`, because a flag before the command is a usage error.
 */
export function hookCommandLine(options: HookCommandLineOptions): string {
  const cache = quoteArgument(options.compileCache);
  const zambil = quoteArgument(options.zambilPath);
  const repo = quoteArgument(options.repoRoot);
  return `NODE_COMPILE_CACHE=${cache} ${zambil} hook --repo ${repo}`;
}
