import { locateRepo, userConfigPath } from "@zambil/core/locate-repo";
import { changeSettings } from "./settings-file.ts";
import type { Either } from "@zambil/core/either";
import { right } from "@zambil/core/either";
import type { UserEnvironment } from "@zambil/core/locate-repo";

/** The environment that says where the user config file is. */
export interface SaveRepoPathOptions {
  environment: UserEnvironment;
}

/** `unchanged` when the file already named the repo. `before` is the repo that it named before, if any. */
export type SavedRepoPath = { kind: "unchanged" } | { kind: "changed"; before: string | undefined };

function repoInFile(environment: UserEnvironment): string | undefined {
  const fileOnly = { ...environment };
  delete fileOnly.repo;
  const located = locateRepo({ environment: fileOnly });
  return located.ok ? located.value.root : undefined;
}

/**
 * Writes the full path of the repo to the `repo` key of the user config file and keeps every other
 * key. It writes nothing when the file already names that folder, or when the file is not a JSON object.
 */
export async function saveRepoPath(
  repoRoot: string,
  options: SaveRepoPathOptions,
): Promise<Either<string, SavedRepoPath>> {
  const before = repoInFile(options.environment);
  if (before === repoRoot) return right({ kind: "unchanged" });
  const path = userConfigPath(options.environment);
  const saved = await changeSettings(path, {
    change: (config) => right({ ...config, repo: repoRoot }),
  });
  if (!saved.ok) return saved;
  return right({ kind: "changed", before });
}
