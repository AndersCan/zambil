import { quoteArgument } from "@zambil/core/quote-argument";

/** The `--repo` flag that the user gave to `zambil doctor`, if any. */
export interface ZambilCommandOptions {
  repoFlag: string | undefined;
}

/** A zambil command for the repo that the user named, with `--repo` when it came from the flag. */
export function zambilCommand(name: string, options: ZambilCommandOptions): string {
  const { repoFlag } = options;
  if (repoFlag === undefined) return `zambil ${name}`;
  const quoted = quoteArgument(repoFlag);
  return `zambil ${name} --repo ${quoted}`;
}
