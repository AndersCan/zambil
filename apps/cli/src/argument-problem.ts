import type { ParseArgsConfig, ParseArgsOptionsConfig } from "node:util";
import { closestMatch } from "@zambil/core/closest-match";
import { parseArgs } from "node:util";

/** The words in order, joined as in a sentence: `a`, `a and b`, `a, b and c`. */
function joinWords(words: string[]): string {
  const leading = [...words];
  const last = leading.pop() ?? "";
  if (leading.length === 0) return last;
  const listed = leading.join(", ");
  return `${listed} and ${last}`;
}

/** The long names of the options, with `--help` last, so that the command's own options come first. */
function optionNames(options: ParseArgsOptionsConfig): string[] {
  const names: string[] = [];
  for (const name of Object.keys(options)) {
    if (name !== "help") names.push(`--${name}`);
  }
  if (Object.hasOwn(options, "help")) names.push("--help");
  return names;
}

interface KnownOptions {
  options: ParseArgsOptionsConfig;
  allowPositionals: boolean;
  args: readonly string[];
}

interface OptionToken {
  index: number;
  name: string;
  rawName: string;
  value?: string | undefined;
  inlineValue?: boolean | undefined;
}

/** A long option as typed, or the whole word of a short group, so that `-foo` reads as typed and not as `-f`. */
function typedName(token: OptionToken, options: KnownOptions): string {
  if (token.rawName.startsWith("--")) return token.rawName;
  return options.args[token.index] ?? token.rawName;
}

function unknownOption(token: OptionToken, options: KnownOptions): string {
  const typed = typedName(token, options);
  const isLong = token.rawName.startsWith("--");
  const candidates = Object.keys(options.options);
  const suggestion = isLong ? closestMatch(token.name, { candidates }) : undefined;
  const first = `This command has no option "${typed}".`;
  if (suggestion !== undefined) return `${first} Did you mean \`--${suggestion}\`?`;
  const takes = joinWords(optionNames(options.options));
  const lines = [`${first} It takes ${takes}.`];
  if (options.allowPositionals) {
    lines.push(`If "${typed}" is not meant as an option, write -- before it.`);
  }
  return lines.join("\n");
}

/** Node reads a value that starts with `-`, except a lone `-`, as a forgotten value. */
function isOptionLike(value: string): boolean {
  return value.length > 1 && value.startsWith("-");
}

function missingValue(token: OptionToken, options: KnownOptions): string | undefined {
  const { rawName, value = "" } = token;
  const needs = `The option "${rawName}" needs a value.`;
  if (token.inlineValue === true || !isOptionLike(value)) return undefined;
  const nextName = value.replace(/^-+/, "").split("=")[0] ?? "";
  if (Object.hasOwn(options.options, nextName)) return needs;
  return `${needs} If the value is "${value}", write ${rawName}=${value}.`;
}

function valueProblem(token: OptionToken, options: KnownOptions): string | undefined {
  const descriptor = Object.hasOwn(options.options, token.name)
    ? options.options[token.name]
    : undefined;
  if (descriptor === undefined) return unknownOption(token, options);
  const { rawName, value } = token;
  if (descriptor.type === "boolean") {
    return value === undefined ? undefined : `The option "${rawName}" takes no value.`;
  }
  if (value === undefined) return `The option "${rawName}" needs a value.`;
  return missingValue(token, options);
}

/**
 * The first argument that a strict parse of `config` rejects, said in plain words, or `undefined` when
 * the parse accepts them all. An unknown option gets a "did you mean" over the long option names.
 */
export function argumentProblem(config: ParseArgsConfig): string | undefined {
  const allowPositionals = config.allowPositionals === true;
  const known = { options: config.options ?? {}, allowPositionals, args: config.args ?? [] };
  const { tokens } = parseArgs({ ...config, strict: false, tokens: true });
  for (const token of tokens) {
    if (token.kind === "positional" && !allowPositionals) {
      return `This command takes no arguments, but it got "${token.value}".`;
    }
    const problem = token.kind === "option" ? valueProblem(token, known) : undefined;
    if (problem !== undefined) return problem;
  }
  return undefined;
}
