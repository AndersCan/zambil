import { installScriptCommand } from "./install-script-command.ts";
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
  // An empty PATH gets no trailing ":", because an empty entry means the project folder.
  return `PATH=${folders}\${PATH:+:$PATH} `;
}

/**
 * Prints a warning for the user when the `zambil` program is gone, for example after the clone moved.
 * Claude Code shows a `systemMessage` in full, and exit code 0 keeps the session going.
 */
function missingProgramGuard(zambil: string): string {
  const systemMessage = `zambil cannot start, so no note reaches this session. To install zambil again, run: ${installScriptCommand}`;
  const warning = quoteArgument(JSON.stringify({ systemMessage }));
  return `[ -x ${zambil} ] || { printf '%s\n' ${warning}; exit 0; }; `;
}

/**
 * The shell command that each hook runs. Claude Code can start without `node` on its `PATH`, so the
 * node folders go first. If a version manager removes one, the `PATH` of Claude Code still applies.
 * `NODE_COMPILE_CACHE` saves compile time. `--repo` comes after `hook`, because a flag before the
 * command is a usage error.
 */
export function hookCommandLine(options: HookCommandLineOptions): string {
  const cache = quoteArgument(options.compileCache);
  const zambil = quoteArgument(options.zambilPath);
  const repo = quoteArgument(options.repoRoot);
  const guard = missingProgramGuard(zambil);
  const prefix = pathPrefix(options.nodeFolders);
  return `${guard}${prefix}NODE_COMPILE_CACHE=${cache} ${zambil} hook --repo ${repo}`;
}
