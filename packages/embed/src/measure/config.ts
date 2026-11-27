import { homedir } from "node:os";
import type { UserEnvironment } from "@zambil/core/locate-repo";

/** The home folder and `XDG_CACHE_HOME`, read once when the measurement starts. */
export function readMeasureEnvironment(): UserEnvironment {
  const environment: UserEnvironment = { home: homedir(), workingFolder: process.cwd() };
  const cacheHome = process.env.XDG_CACHE_HOME;
  if (cacheHome !== undefined && cacheHome.trim() !== "") environment.cacheHome = cacheHome;
  return environment;
}
