import type { CliConfig } from "./config.ts";

/** 0: done. 1: the command ran and found a problem, such as an invalid note. 2: wrong usage or no repo. */
export type ExitCode = 0 | 1 | 2;

/** Where a command prints. `write` is standard output and `error` is standard error. */
export interface CommandOutput {
  write: (text: string) => void;
  error: (text: string) => void;
}

/** What a command gets: its arguments after the command name, the startup config, output and the clock. */
export interface CommandRunOptions {
  args: string[];
  config: CliConfig;
  output: CommandOutput;
  now: Date;
}

/** One `zambil <name>` command. Each lives in its own folder and is listed in `commands.ts`. */
export interface Command {
  name: string;
  summary: string;
  usage: string;
  run: (options: CommandRunOptions) => ExitCode | Promise<ExitCode>;
}
