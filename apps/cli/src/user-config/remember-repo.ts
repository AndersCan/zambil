import { checkUserConfig, saveRepoPath } from "./user-config-file.ts";
import { locateRepo, userConfigPath } from "@zambil/core/locate-repo";
import type { CliConfig } from "../config.ts";
import type { CommandOutput } from "../command.ts";

/** The startup config, and where to print. */
export interface RememberRepoOptions {
  config: CliConfig;
  output: CommandOutput;
}

/**
 * `unchanged` when the file already named the repo. `failed` when the file cannot be read or written.
 * The message is already printed.
 */
export type RememberResult = "saved" | "unchanged" | "failed";

interface ConfigErrorOptions {
  reason: string;
}

function describeConfigError(path: string, options: ConfigErrorOptions): string {
  return `zambil cannot save the repo in ${path}: ${options.reason}\nFix the file or delete it, then run the command again.\n`;
}

/** Prints why the user config file cannot take the repo. `failed` stops a command before it changes anything. */
export async function checkRepoCanBeSaved(options: RememberRepoOptions): Promise<RememberResult> {
  const checked = await checkUserConfig(options.config.environment);
  if (checked.ok) return "unchanged";
  const path = userConfigPath(options.config.environment);
  options.output.error(describeConfigError(path, { reason: checked.error }));
  return "failed";
}

/** Saves the repo in the user config file, so that `zambil list` finds it without `--repo`. */
export async function rememberRepo(
  repoRoot: string,
  options: RememberRepoOptions,
): Promise<RememberResult> {
  const { config, output } = options;
  const path = userConfigPath(config.environment);
  const saved = await saveRepoPath(repoRoot, { environment: config.environment });
  if (!saved.ok) {
    output.error(describeConfigError(path, { reason: saved.error }));
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
  return saved.value.kind === "changed" ? "saved" : "unchanged";
}
