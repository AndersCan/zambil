import type { CommandOutput, ExitCode } from "./command.ts";
import type { CliConfig } from "./config.ts";
import { commands } from "./commands.ts";

/** The startup config, where to print, and the clock. */
export interface RunCliOptions {
  config: CliConfig;
  output: CommandOutput;
  now: Date;
}

async function formatHelp(): Promise<string> {
  const loaded = await Promise.all(Object.values(commands).map((load) => load()));
  const lines = ["Usage: zambil <command> [--repo <path>]", "", "Commands:"];
  const width = Math.max(...loaded.map((command) => command.name.length));
  for (const command of loaded) {
    const name = command.name.padEnd(width);
    lines.push(`  ${name}  ${command.summary}`);
  }
  lines.push(
    "",
    "zambil finds your configuration repo from --repo, then ZAMBIL_REPO, then ~/.config/zambil/config.json.",
    "Run `zambil <command> --help` for the usage of one command.",
  );
  lines.push("");
  return lines.join("\n");
}

/** Runs `zambil` with the arguments after the program name, and returns the exit code. */
export async function runCli(args: string[], options: RunCliOptions): Promise<ExitCode> {
  const [name, ...rest] = args;
  const asksForHelp = name === undefined || name === "help" || name === "--help" || name === "-h";
  if (asksForHelp) {
    options.output.write(await formatHelp());
    return 0;
  }
  const load = Object.hasOwn(commands, name) ? commands[name] : undefined;
  if (load === undefined) {
    const help = await formatHelp();
    options.output.error(`zambil has no command "${name}".\n\n${help}`);
    return 2;
  }
  const command = await load();
  if (rest.includes("--help") || rest.includes("-h")) {
    options.output.write(`${command.usage}\n\n${command.summary}\n`);
    return 0;
  }
  return command.run({
    args: rest,
    config: options.config,
    output: options.output,
    now: options.now,
  });
}
