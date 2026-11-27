import type { Command, CommandRunOptions, ExitCode } from "./command.ts";
import type { CliConfig } from "./config.ts";
import { commands } from "./commands.ts";
import { quoteArgument } from "@zambil/core/quote-argument";
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
  const lines = [command.usage, "", command.summary];
  if (command.details !== undefined) lines.push(command.details);
  lines.push("");
  return lines.join("\n");
}

function commandNameIn(args: string[]): string | undefined {
  for (const [position, argument] of args.entries()) {
    const isRepoValue = args[position - 1] === "--repo";
    if (!isRepoValue && Object.hasOwn(commands, argument)) return argument;
  }
  return undefined;
}

function unknownCommandMessage(args: string[]): string {
  const [first = ""] = args;
  if (!first.startsWith("-")) return `zambil has no command "${first}".`;
  const isSharedOption = first === "--repo" || first.startsWith("--repo=");
  if (!isSharedOption) return `zambil has no option "${first}".`;
  const command = commandNameIn(args) ?? "<command>";
  const words = ["zambil", command];
  for (const argument of args) {
    if (argument !== command) words.push(quoteArgument(argument));
  }
  const fixed = words.join(" ");
  return `Put the command first: ${fixed}`;
}

async function printHelp(args: string[], options: RunCliOptions): Promise<ExitCode> {
  const name = commandNameIn(args);
  const load = name === undefined ? undefined : commands[name];
  const text = load === undefined ? await formatHelp(options.config) : formatUsage(await load());
  options.output.write(text);
  return 0;
}

/** Runs `zambil` with the arguments after the program name, and returns the exit code. */
export async function runCli(args: string[], options: RunCliOptions): Promise<ExitCode> {
  const asksForHelp = args.length === 0 || args.some((argument) => helpWords.has(argument));
  if (asksForHelp) return printHelp(args, options);
  const [name = "", ...rest] = args;
  const load = Object.hasOwn(commands, name) ? commands[name] : undefined;
  if (load === undefined) {
    const help = await formatHelp(options.config);
    options.output.error(`${unknownCommandMessage(args)}\n\n${help}`);
    return 2;
  }
  const command = await load();
  return command.run({ ...options, args: rest });
}
