import { join } from "node:path";
import type { UserEnvironment } from "@zambil/core/locate-repo";

/** The folder for the files that zambil can rebuild: `$XDG_CACHE_HOME/zambil`, or `~/.cache/zambil`. */
export function cacheFolder(environment: UserEnvironment): string {
  return join(environment.cacheHome ?? join(environment.home, ".cache"), "zambil");
}
