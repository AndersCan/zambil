import { homedir } from "node:os";
import type { UserEnvironment } from "@zambil/core/locate-repo";

/** Everything the CLI reads from the process at startup. Commands read this, never `process.env`. */
export interface CliConfig {
  environment: UserEnvironment;
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value;
}

/** Reads `ZAMBIL_REPO`, `XDG_CONFIG_HOME`, the home folder and the working folder once. */
export function readCliConfig(): CliConfig {
  const environment: UserEnvironment = { home: homedir(), workingFolder: process.cwd() };
  const repo = nonEmpty(process.env.ZAMBIL_REPO);
  if (repo !== undefined) environment.repo = repo;
  const configHome = nonEmpty(process.env.XDG_CONFIG_HOME);
  if (configHome !== undefined) environment.configHome = configHome;
  return { environment };
}
