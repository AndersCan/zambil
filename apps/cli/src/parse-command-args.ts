import { left, right } from "@zambil/core/either";
import type { Either } from "@zambil/core/either";
import { parseArgs } from "node:util";
import type { ParseArgsConfig } from "node:util";

/** The options that every command takes: `--repo <path>` and `--help`. */
export const sharedOptions = {
  repo: { type: "string" },
  help: { type: "boolean", short: "h" },
} as const;

type ParsedArgs<Config extends ParseArgsConfig> = ReturnType<typeof parseArgs<Config>>;

function unsafeParseArgs<Config extends ParseArgsConfig>(config: Config): ParsedArgs<Config> {
  return parseArgs(config);
}

/** Parses a command's arguments strictly. An unknown option or a missing value is a usage message. */
export function parseCommandArgs<Config extends ParseArgsConfig>(
  config: Config,
): Either<string, ParsedArgs<Config>> {
  try {
    return right(unsafeParseArgs(config));
  } catch (error: unknown) {
    return left(error instanceof Error ? error.message : String(error));
  }
}
