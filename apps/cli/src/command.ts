import type { CliConfig } from "./config.ts";

/** 0: done. 1: the command ran and found a problem, such as an invalid note. 2: wrong usage or no repo. */
export type ExitCode = 0 | 1 | 2;

/** Where a command prints. `write` is standard output and `error` is standard error. */
export interface CommandOutput {
  write: (text: string) => void;
  error: (text: string) => void;
}

/** Standard input. It is read only when a command calls `readAll`, so other commands do not wait for it. */
export interface CommandInput {
  readAll: () => Promise<string>;
}

/** What a command gets: its arguments after the command name, the startup config, input, output and the clock. */
export interface CommandRunOptions {
  args: string[];
  config: CliConfig;
  input: CommandInput;
  output: CommandOutput;
  now: Date;
}

/** One `zambil <name>` command. Each lives in its own folder and has one line in `commands.ts`. */
export interface Command {
  summary: string;
  usage: string;
  run: (options: CommandRunOptions) => ExitCode | Promise<ExitCode>;
}
