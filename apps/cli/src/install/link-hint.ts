import type { CliConfig } from "../config.ts";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { quoteArgument } from "@zambil/core/quote-argument";

/** The command to run again after the fix, for example `zambil install`. */
export interface LinkHintOptions {
  command: string;
}

/** What to do when `zambil` is not on the `PATH`: link it, and put `~/.local/bin` on the `PATH`. */
export function linkHint(config: CliConfig, options: LinkHintOptions): string {
  const main = quoteArgument(fileURLToPath(new URL("../main.ts", import.meta.url)));
  const lines = [
    `zambil is not on your PATH, or its link points to a clone that moved. The agent runs zambil by name. Link it into a folder on your PATH, then run ${options.command} again:`,
    "",
    `  mkdir -p ~/.local/bin && ln -sf ${main} ~/.local/bin/zambil`,
  ];
  const localBin = join(config.environment.home, ".local", "bin");
  const searchPath = config.searchPath ?? [];
  if (!searchPath.includes(localBin)) {
    lines.push(
      "",
      "~/.local/bin is not on your PATH. Add this line to the profile of your shell, ~/.zshrc for zsh or ~/.bashrc for bash, then open a new terminal:",
      "",
      '  export PATH="$HOME/.local/bin:$PATH"',
    );
  }
  return lines.join("\n");
}
