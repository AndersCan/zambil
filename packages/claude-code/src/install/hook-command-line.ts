import { quoteArgument } from "@zambil/core/quote-argument";

/**
 * The `zambil` program, the configuration repo, the Node compile cache and the folders that hold
 * `node`, all as full paths.
 */
export interface HookCommandLineOptions {
  zambilPath: string;
  repoRoot: string;
  compileCache: string;
  nodeFolders: string[];
}

function pathPrefix(nodeFolders: string[]): string {
  if (nodeFolders.length === 0) return "";
  const quoted = nodeFolders.map((folder) => quoteArgument(folder));
  const folders = quoted.join(":");
  return `PATH=${folders}:$PATH `;
}

/**
 * The shell command that each hook runs. Claude Code can start without `node` on its `PATH`, so the
 * node folders go first. If a version manager removes one, the `PATH` of Claude Code still applies.
 * `NODE_COMPILE_CACHE` saves compile time on each event. `--repo` comes after `hook`, because a flag
 * before the command is a usage error.
 */
export function hookCommandLine(options: HookCommandLineOptions): string {
  const cache = quoteArgument(options.compileCache);
  const zambil = quoteArgument(options.zambilPath);
  const repo = quoteArgument(options.repoRoot);
  const prefix = pathPrefix(options.nodeFolders);
  return `${prefix}NODE_COMPILE_CACHE=${cache} ${zambil} hook --repo ${repo}`;
}
