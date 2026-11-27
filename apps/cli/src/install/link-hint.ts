import { join, resolve } from "node:path";
import type { CliConfig } from "../config.ts";
import { fileURLToPath } from "node:url";
import { quoteArgument } from "@zambil/core/quote-argument";

/** The command to run again after the fix, for example `zambil install`. */
export interface LinkHintOptions {
  command: string;
}

/** The `main.ts` of the clone that runs now, which a link on the `PATH` points to. */
export function mainPath(): string {
  return fileURLToPath(new URL("../main.ts", import.meta.url));
}

/** The shell command that links this clone into `~/.local/bin`. */
export function linkCommand(): string {
  const main = quoteArgument(mainPath());
  return `mkdir -p ~/.local/bin && ln -sf ${main} ~/.local/bin/zambil`;
}

/** The line for the shell profile that puts `~/.local/bin` on the `PATH`. */
export const localBinPathLine = 'export PATH="$HOME/.local/bin:$PATH"';

/** Whether `~/.local/bin` is a folder of the `PATH`. */
export function hasLocalBinOnPath(config: CliConfig): boolean {
  const localBin = join(config.environment.home, ".local", "bin");
  const searchPath = (config.searchPath ?? []).map((folder) => resolve(folder));
  return searchPath.includes(localBin);
}

/** What to do when `zambil` is not on the `PATH`: link it, and put `~/.local/bin` on the `PATH`. */
export function linkHint(config: CliConfig, options: LinkHintOptions): string {
  const link = linkCommand();
  const lines = [
    `zambil is not on your PATH, or its link points to a clone that moved. The agent runs zambil by name. Link it into a folder on your PATH, then run ${options.command} again:`,
    "",
    `  ${link}`,
  ];
  if (!hasLocalBinOnPath(config)) {
    lines.push(
      "",
      "~/.local/bin is not on your PATH. Add this line to the profile of your shell, ~/.zshrc for zsh or ~/.bashrc for bash, then open a new terminal:",
      "",
      `  ${localBinPathLine}`,
    );
  }
  return lines.join("\n");
}
