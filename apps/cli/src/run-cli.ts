import type { Command, CommandAudience, CommandRunOptions, ExitCode } from "./command.ts";
import type { CliConfig } from "./config.ts";
import { closestMatch } from "@zambil/core/closest-match";
import { commands } from "./commands.ts";
import { quoteArgument } from "@zambil/core/quote-argument";
import { userConfigPath } from "@zambil/core/locate-repo";

/** Everything a command gets except its arguments. A new field here reaches every command unchanged. */
export type RunCliOptions = Omit<CommandRunOptions, "args">;

const helpFlags = new Set(["--help", "-h"]);
const helpOption = { flag: "-h, --help", text: "Print this help." };
const seeCommands = "Run `zambil help` to see every command.";

const gettingStarted = [
  "Get started:",
  "  1. Run `zambil init` to create your configuration repo and connect it to Claude Code.",
  "  2. Run `zambil list` to see your notes.",
  "  3. In Claude Code, type z:<name> in a prompt to add the note <name> to it.",
];

interface WordOptions {
  after: number;
}

/** The position of the first argument from `after` on that is not a flag or the value of `--repo`. */
function firstWordPosition(args: string[], options: WordOptions): number | undefined {
  for (const [position, argument] of args.entries()) {
    const isRepoValue = args[position - 1] === "--repo";
    const isWord = position >= options.after && !argument.startsWith("-");
    if (isWord && !isRepoValue) return position;
  }
  return undefined;
}

function firstWord(args: string[], options: WordOptions): string | undefined {
  const position = firstWordPosition(args, options);
  return position === undefined ? undefined : args[position];
}

/** The flags before `--`. A flag after `--` is text, so that `zambil search -- --help` searches. */
function flagsOf(args: string[]): string[] {
  const end = args.indexOf("--");
  return end === -1 ? args : args.slice(0, end);
}

interface Row {
  name: string;
  text: string;
}

function formatRows(rows: Row[]): string[] {
  const width = Math.max(...rows.map((row) => row.name.length));
  return rows.map((row) => {
    const name = row.name.padEnd(width);
    return `  ${name}  ${row.text}`;
  });
}

interface AudienceOptions {
  audience: CommandAudience;
}

function audienceOf(command: Command): CommandAudience {
  return command.audience ?? "user";
}

function commandRows(loaded: [string, Command][], options: AudienceOptions): Row[] {
  const rows: Row[] = [];
  for (const [name, command] of loaded) {
    if (audienceOf(command) === options.audience) rows.push({ name, text: command.summary });
  }
  return rows;
}

async function formatHelp(config: CliConfig): Promise<string> {
  const entries = Object.entries(commands);
  const loaded = await Promise.all(
    entries.map(async ([name, load]): Promise<[string, Command]> => [name, await load()]),
  );
  const userRows = commandRows(loaded, { audience: "user" });
  const agentRows = commandRows(loaded, { audience: "agent" });
  const configPath = userConfigPath(config.environment);
  return [
    "zambil adds the notes of your configuration repo, a folder of Markdown notes, to your Claude Code sessions.",
    "",
    "Usage: zambil <command> [options]",
    "",
    ...gettingStarted,
    "",
    "Commands:",
    ...formatRows(userRows),
    "",
    "Commands that the agent and its hooks run. You do not need to run them:",
    ...formatRows(agentRows),
    "",
    `zambil finds your configuration repo from --repo, then ZAMBIL_REPO, then ${configPath}.`,
    "Run `zambil <command> --help` to see the options of one command, and `zambil --version` to see the version.",
    "",
  ].join("\n");
}

function formatUsage(command: Command): string {
  const lines = [command.usage, "", command.summary];
  if (command.details !== undefined) lines.push(command.details);
  if (command.options !== undefined) {
    const options = [...command.options, helpOption];
    const rows = options.map((option) => ({ name: option.flag, text: option.text }));
    lines.push("", "Options:", ...formatRows(rows));
  }
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

/** `run`: the name came first, so `help` is a candidate too. `help`: the name came after `zambil help`. */
type CommandPosition = "run" | "help";

interface NoSuchCommandOptions {
  position: CommandPosition;
}

function noSuchCommand(name: string, options: NoSuchCommandOptions): string {
  const names = Object.keys(commands);
  const candidates = options.position === "run" ? [...names, "help"] : names;
  const suggestion = closestMatch(name, { candidates });
  const prefix = options.position === "run" ? "zambil" : "zambil help";
  const first = `zambil has no command "${name}".`;
  const guess = suggestion === undefined ? "" : ` Did you mean \`${prefix} ${suggestion}\`?`;
  return `${first}${guess}\n${seeCommands}\n`;
}

function unknownCommandMessage(args: string[]): string {
  const [first = ""] = args;
  if (!first.startsWith("-")) return noSuchCommand(first, { position: "run" });
  const isSharedOption = first === "--repo" || first.startsWith("--repo=");
  if (!isSharedOption) return `zambil has no option "${first}".\n${seeCommands}\n`;
  const command = commandNameIn(args);
  const word = firstWord(args, { after: 0 });
  if (command === undefined && word !== undefined) return noSuchCommand(word, { position: "run" });
  const words = ["zambil", command ?? "<command>"];
  for (const argument of args) {
    if (argument !== command) words.push(quoteArgument(argument));
  }
  const fixed = words.join(" ");
  return `Put the command first: ${fixed}\n`;
}

interface HelpRequest {
  topic: string | undefined;
}

/** `help` counts only as the first word, so that `zambil search help me rebase` searches. */
function helpRequest(args: string[]): HelpRequest | undefined {
  const position = firstWordPosition(args, { after: 0 });
  const first = position === undefined ? undefined : args[position];
  if (position !== undefined && first === "help") {
    return { topic: firstWord(args, { after: position + 1 }) };
  }
  const asksForHelp = args.length === 0 || flagsOf(args).some((flag) => helpFlags.has(flag));
  return asksForHelp ? { topic: first } : undefined;
}

async function printHelp(request: HelpRequest, options: RunCliOptions): Promise<ExitCode> {
  const { topic } = request;
  if (topic === undefined || topic === "help") {
    options.output.write(await formatHelp(options.config));
    return 0;
  }
  const load = Object.hasOwn(commands, topic) ? commands[topic] : undefined;
  if (load === undefined) {
    options.output.error(noSuchCommand(topic, { position: "help" }));
    return 2;
  }
  options.output.write(formatUsage(await load()));
  return 0;
}

function asksForVersion(args: string[]): boolean {
  return flagsOf(args)[0] === "--version";
}

/** Runs `zambil` with the arguments after the program name, and returns the exit code. */
export async function runCli(args: string[], options: RunCliOptions): Promise<ExitCode> {
  const help = helpRequest(args);
  if (help !== undefined) return printHelp(help, options);
  if (asksForVersion(args)) {
    const { default: cliPackage } = await import("../package.json", { with: { type: "json" } });
    options.output.write(`zambil ${cliPackage.version}\n`);
    return 0;
  }
  const [name = "", ...rest] = args;
  const load = Object.hasOwn(commands, name) ? commands[name] : undefined;
  if (load === undefined) {
    options.output.error(unknownCommandMessage(args));
    return 2;
  }
  const command = await load();
  return command.run({ ...options, args: rest });
}
