import { locateRepo, userConfigPath } from "@zambil/core/locate-repo";
import type { CheckResult } from "./check-result.ts";
import type { CliConfig } from "../config.ts";
import { isNever } from "@zambil/core/is-never";

/** The startup config, and the `--repo` flag that the user gave, if any. */
export interface CheckUserConfigOptions {
  repoFlag: string | undefined;
}

/** Where the active repo comes from when it is not the user config file, or `undefined`. */
function otherSource(config: CliConfig, options: CheckUserConfigOptions): string | undefined {
  if (options.repoFlag !== undefined) return "--repo";
  if (config.environment.repo !== undefined) return "ZAMBIL_REPO";
  return undefined;
}

interface OverridingRepoOptions extends CheckUserConfigOptions {
  config: CliConfig;
}

/** The repo of ZAMBIL_REPO when it differs from the saved repo and no `--repo` wins over both. */
function overridingRepo(savedRoot: string, options: OverridingRepoOptions): string | undefined {
  if (options.repoFlag !== undefined) return undefined;
  const active = locateRepo({ environment: options.config.environment });
  if (!active.ok || active.value.root === savedRoot) return undefined;
  return active.value.root;
}

/** Whether the user config file names a repo, and whether ZAMBIL_REPO wins over it. */
export function checkUserConfig(config: CliConfig, options: CheckUserConfigOptions): CheckResult {
  const { environment } = config;
  const path = userConfigPath(environment);
  const fileOnly = { ...environment };
  delete fileOnly.repo;
  const saved = locateRepo({ environment: fileOnly });
  const other = otherSource(config, options);
  if (saved.ok) {
    const text = `The user config file ${path} names the notes folder ${saved.value.root}.`;
    const winner = overridingRepo(saved.value.root, { config, repoFlag: options.repoFlag });
    if (winner === undefined) return { level: "ok", text };
    return {
      level: "warn",
      text,
      details: [`ZAMBIL_REPO names ${winner}, and it wins over that file.`],
      fixes: ["unset ZAMBIL_REPO"],
    };
  }
  const { error } = saved;
  switch (error.kind) {
    case "not-configured":
      if (other !== undefined) {
        return {
          level: "ok",
          text: `There is no user config file ${path}. The notes folder comes from ${other}.`,
        };
      }
      return {
        level: "fail",
        text: `zambil does not know where your notes are, because there is no user config file ${path}.`,
        fixes: ["zambil init"],
      };
    case "invalid-config":
      return {
        level: "fail",
        text: `zambil cannot use the user config file ${path}, because ${error.message}.`,
        details: [
          'Fix the file, so that it reads {"repo": "<path of your notes folder>"}, or delete it and run zambil init.',
        ],
      };
    case "empty-flag":
      return { level: "fail", text: "--repo needs the path of a folder, but it is empty." };
    default:
      return isNever(error);
  }
}
