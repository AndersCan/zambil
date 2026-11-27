import type { CliConfig } from "./config.ts";

/** 0: done. 1: the command ran and found a problem, such as an invalid note. 2: wrong usage or no repo. */
export type ExitCode = 0 | 1 | 2;

/** Where a command prints. `write` is standard output and `error` is standard error. */
export interface CommandOutput {
  write: (text: string) => void;
  error: (text: string) => void;
}

/**
 * Standard input. It is read only when a command calls `readAll`, so other commands do not wait for it. A
 * terminal reads as empty text, so that a command never waits for typed input.
 */
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

/** `user`: a person runs it. `agent`: only the agent or a hook runs it, so the help lists it apart. */
export type CommandAudience = "user" | "agent";

/** One option in the help of a command: the flag as the user types it, such as `--expires <date>`, and what it does. */
export interface OptionHelp {
  flag: string;
  text: string;
}

/**
 * One `zambil <name>` command. Each lives in its own folder and has one line in `commands.ts`. Without
 * `audience`, it is a user command. `--help` prints `options` and adds `-h, --help` itself, so a command
 * that takes only `--help` leaves `options` out.
 */
export interface Command {
  summary: string;
  usage: string;
  details?: string;
  audience?: CommandAudience;
  options?: OptionHelp[];
  run: (options: CommandRunOptions) => ExitCode | Promise<ExitCode>;
}
