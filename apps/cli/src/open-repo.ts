import { left, right } from "@zambil/core/either";
import type { LocateRepoError, RepoLocation } from "@zambil/core/locate-repo";
import type { CliConfig } from "./config.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import { isNever } from "@zambil/core/is-never";
import { loadRepo } from "@zambil/core/load-repo";
import { locateRepo } from "@zambil/core/locate-repo";
import { userConfigPath } from "@zambil/core/locate-repo";

/** The `--repo` flag, if given, and the startup config. */
export interface OpenRepoOptions {
  flag: string | undefined;
  config: CliConfig;
}

function describeSource(location: RepoLocation, config: CliConfig): string {
  switch (location.source) {
    case "flag":
      return "--repo";
    case "environment":
      return "ZAMBIL_REPO";
    case "user-config":
      return userConfigPath(config.environment);
    default:
      return isNever(location.source);
  }
}

function describeLocateError(error: LocateRepoError): string {
  switch (error.kind) {
    case "empty-flag":
      return "--repo needs the path of a folder, but it is empty.";
    case "invalid-config":
      return `zambil cannot use ${error.configPath}: ${error.message}`;
    case "not-configured":
      return [
        "zambil does not know where your configuration repo is. Do one of these:",
        "  - pass --repo <path>",
        "  - set ZAMBIL_REPO=<path>",
        `  - write {"repo": "<path>"} to ${error.configPath}`,
      ].join("\n");
    default:
      return isNever(error);
  }
}

/** Finds and loads the configuration repo, or returns a message that tells the user how to fix it. */
export function openRepo(options: OpenRepoOptions): Either<string, ConfigurationRepo> {
  const { config } = options;
  const location = locateRepo({ flag: options.flag, environment: config.environment });
  if (!location.ok) return left(describeLocateError(location.error));

  const repo = loadRepo(location.value.root);
  if (repo.ok) return right(repo.value);
  const { root, message } = repo.error;
  const source = describeSource(location.value, config);
  return left(`zambil cannot read the configuration repo ${root} (from ${source}): ${message}`);
}
