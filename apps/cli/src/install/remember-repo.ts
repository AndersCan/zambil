import { locateRepo, userConfigPath } from "@zambil/core/locate-repo";
import type { CliConfig } from "../config.ts";
import type { CommandOutput } from "../command.ts";
import { saveRepoPath } from "./user-config-file.ts";

/** The startup config, and where to print. */
export interface RememberRepoOptions {
  config: CliConfig;
  output: CommandOutput;
}

/** `failed` when the user config file cannot be read or written. The message is already printed. */
export type RememberResult = "saved" | "failed";

/** Saves the repo in the user config file, so that `zambil list` finds it without `--repo`. */
export async function rememberRepo(
  repoRoot: string,
  options: RememberRepoOptions,
): Promise<RememberResult> {
  const { config, output } = options;
  const path = userConfigPath(config.environment);
  const saved = await saveRepoPath(repoRoot, { environment: config.environment });
  if (!saved.ok) {
    output.error(`zambil cannot save the repo in ${path}: ${saved.error}\n`);
    return "failed";
  }
  if (saved.value.kind === "changed") {
    const { before } = saved.value;
    const previous = before === undefined ? "" : ` It named ${before} before.`;
    output.write(`Saved the configuration repo ${repoRoot} in ${path}.${previous}\n`);
  }
  const active = locateRepo({ environment: config.environment });
  const isOverridden = active.ok && active.value.source === "environment";
  if (isOverridden && active.value.root !== repoRoot) {
    output.write(
      `ZAMBIL_REPO names ${active.value.root}, and it wins over ${path}. Unset it to use the saved repo.\n`,
    );
  }
  return "saved";
}
