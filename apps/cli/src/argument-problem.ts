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

interface UnknownOptionOptions {
  options: ParseArgsOptionsConfig;
  allowPositionals: boolean;
}

function unknownOption(rawName: string, options: UnknownOptionOptions): string {
  const names = optionNames(options.options);
  const isLong = rawName.startsWith("--");
  const suggestion = isLong ? closestMatch(rawName, { candidates: names }) : undefined;
  const first = `This command has no option "${rawName}".`;
  if (suggestion !== undefined) return `${first} Did you mean \`${suggestion}\`?`;
  const takes = joinWords(names);
  const lines = [`${first} It takes ${takes}.`];
  if (options.allowPositionals) {
    lines.push(`If "${rawName}" is text and not an option, write -- before it.`);
  }
  return lines.join("\n");
}

interface OptionToken {
  name: string;
  rawName: string;
  value?: string | undefined;
  inlineValue?: boolean | undefined;
}

function valueProblem(token: OptionToken, options: UnknownOptionOptions): string | undefined {
  const descriptor = Object.hasOwn(options.options, token.name)
    ? options.options[token.name]
    : undefined;
  if (descriptor === undefined) return unknownOption(token.rawName, options);
  const { rawName, value } = token;
  if (descriptor.type === "boolean") {
    return value === undefined ? undefined : `The option "${rawName}" takes no value.`;
  }
  if (value === undefined) return `The option "${rawName}" needs a value.`;
  const isOptionLike = token.inlineValue !== true && value.startsWith("-");
  if (!isOptionLike) return undefined;
  return `The option "${rawName}" needs a value, but "${value}" comes next. If the value starts with -, write ${rawName}=${value}.`;
}

/**
 * The first argument that a strict parse of `config` rejects, said in plain words, or `undefined` when
 * the parse accepts them all. An unknown option gets a "did you mean" over the long option names.
 */
export function argumentProblem(config: ParseArgsConfig): string | undefined {
  const allowPositionals = config.allowPositionals === true;
  const known = { options: config.options ?? {}, allowPositionals };
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
