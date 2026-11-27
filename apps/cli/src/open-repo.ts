import { left, right } from "@zambil/core/either";
import type { LocateRepoError, RepoLocation } from "@zambil/core/locate-repo";
import type { CliConfig } from "./config.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { Either } from "@zambil/core/either";
import { isNever } from "@zambil/core/is-never";
import { loadRepo } from "@zambil/core/load-repo";
import type { LoadRepoError } from "@zambil/core/load-repo";
import { locateRepo } from "@zambil/core/locate-repo";
import { userConfigPath } from "@zambil/core/locate-repo";

/** The `--repo` flag, if given, and the startup config. */
export interface OpenRepoOptions {
  flag: string | undefined;
  config: CliConfig;
}

const initStep = "run `zambil init` to set up zambil.";

function describeLocateError(error: LocateRepoError): string {
  switch (error.kind) {
    case "empty-flag":
      return "--repo needs the path of a folder, but it is empty.";
    case "invalid-config":
      return [
        `zambil cannot use its configuration file ${error.configPath}, because ${error.message}.`,
        'Fix the file, so that it reads {"repo": "<path of your configuration repo>"}, or delete it and run `zambil init`.',
      ].join("\n");
    case "not-configured":
      return [
        "zambil does not know where your configuration repo is.",
        "Run `zambil init` to set up zambil.",
        `Or write {"repo": "<path>"} to ${error.configPath}, set ZAMBIL_REPO=<path>, or add --repo <path> to the command.`,
      ].join("\n");
    default:
      return isNever(error);
  }
}

function describeProblem(error: LoadRepoError): string {
  const { root } = error;
  switch (error.kind) {
    case "missing-root":
      return `The configuration repo ${root} does not exist.`;
    case "not-a-folder":
      return `The configuration repo ${root} is not a folder.`;
    case "unreadable-root":
      return `zambil cannot read the configuration repo ${root}: ${error.message}`;
    default:
      return isNever(error.kind);
  }
}

/** Why a path in the configuration file lands somewhere the user did not expect, if it can. */
function configPathAdvice(written: string): string | undefined {
  const fix = "Write a path that starts with ~/ or /.";
  if (written.includes("$")) {
    return `zambil does not expand $HOME or other variables in that file. ${fix}`;
  }
  const isRelative = !written.startsWith("~") && !written.startsWith("/");
  if (isRelative) return `zambil reads a relative path from the folder of that file. ${fix}`;
  return undefined;
}

interface SourceOptions {
  configPath: string;
  problem: LoadRepoError["kind"];
}

/** Where the path came from, and how to change it. For the configuration file, also how zambil reads the path. */
function describeSource(location: RepoLocation, options: SourceOptions): string[] {
  const written = JSON.stringify(location.written);
  switch (location.source) {
    case "flag": {
      const fix =
        options.problem === "missing-root"
          ? "Fix the path, or create the folder."
          : "Fix the path.";
      return [`The path comes from --repo ${written}. ${fix}`];
    }
    case "environment":
      return [`The path comes from ZAMBIL_REPO=${written}. Fix ZAMBIL_REPO, or ${initStep}`];
    case "user-config": {
      const lines = [`The path comes from "repo": ${written} in ${options.configPath}.`];
      const advice = configPathAdvice(location.written);
      if (advice !== undefined) lines.push(advice);
      lines.push(`Fix the path in that file, or ${initStep}`);
      return lines;
    }
    default:
      return isNever(location.source);
  }
}

/** Finds and loads the configuration repo, or returns a message that tells the user how to fix it. */
export function openRepo(options: OpenRepoOptions): Either<string, ConfigurationRepo> {
  const { config } = options;
  const location = locateRepo({ flag: options.flag, environment: config.environment });
  if (!location.ok) return left(describeLocateError(location.error));

  const repo = loadRepo(location.value.root);
  if (repo.ok) return right(repo.value);
  const configPath = userConfigPath(config.environment);
  const source = describeSource(location.value, { configPath, problem: repo.error.kind });
  return left([describeProblem(repo.error), ...source].join("\n"));
}
