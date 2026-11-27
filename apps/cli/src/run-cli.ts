import type { Command, CommandRunOptions, ExitCode } from "./command.ts";
import type { CliConfig } from "./config.ts";
import { commands } from "./commands.ts";
import { quoteArgument } from "./quote-argument.ts";
import { userConfigPath } from "@zambil/core/locate-repo";

/** Everything a command gets except its arguments. A new field here reaches every command unchanged. */
export type RunCliOptions = Omit<CommandRunOptions, "args">;

const helpWords = new Set(["help", "--help", "-h"]);

async function formatHelp(config: CliConfig): Promise<string> {
  const names = Object.keys(commands);
  const loaded = await Promise.all(Object.values(commands).map((load) => load()));
  const width = Math.max(...names.map((name) => name.length));
  const lines = ["Usage: zambil <command> [--repo <path>]", "", "Commands:"];
  for (const [position, command] of loaded.entries()) {
    const name = (names[position] ?? "").padEnd(width);
    lines.push(`  ${name}  ${command.summary}`);
  }
  const configPath = userConfigPath(config.environment);
  lines.push(
    "",
    `zambil finds your configuration repo from --repo, then ZAMBIL_REPO, then ${configPath}.`,
    "Run `zambil help <command>` for the usage of one command.",
    "",
  );
  return lines.join("\n");
}

function formatUsage(command: Command): string {
  return `${command.usage}\n\n${command.summary}\n`;
}

function unknownCommandMessage(args: string[]): string {
  const [first = ""] = args;
  if (!first.startsWith("-")) return `zambil has no command "${first}".`;
  const isSharedOption = first === "--repo" || first.startsWith("--repo=");
  if (!isSharedOption) return `zambil has no option "${first}".`;
  const command = args.find((argument) => Object.hasOwn(commands, argument)) ?? "<command>";
  const words = ["zambil", command];
  for (const argument of args) {
    if (argument !== command) words.push(quoteArgument(argument));
  }
  const fixed = words.join(" ");
  return `Put the command first: ${fixed}`;
}

/** Runs `zambil` with the arguments after the program name, and returns the exit code. */
export async function runCli(args: string[], options: RunCliOptions): Promise<ExitCode> {
  const [first, ...rest] = args;
  const asksForHelp = first === undefined || helpWords.has(first);
  const name = asksForHelp ? rest.find((argument) => !helpWords.has(argument)) : first;
  if (name === undefined) {
    options.output.write(await formatHelp(options.config));
    return 0;
  }
  const load = Object.hasOwn(commands, name) ? commands[name] : undefined;
  if (load === undefined) {
    const help = await formatHelp(options.config);
    const message = unknownCommandMessage(asksForHelp ? rest : args);
    options.output.error(`${message}\n\n${help}`);
    return 2;
  }
  const command = await load();
  const commandArgs = asksForHelp ? [] : rest;
  const hasHelpFlag = commandArgs.includes("--help") || commandArgs.includes("-h");
  if (asksForHelp || hasHelpFlag) {
    options.output.write(formatUsage(command));
    return 0;
  }
  return command.run({ ...options, args: commandArgs });
}
