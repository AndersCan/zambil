import { quoteArgument } from "@zambil/core/quote-argument";

/** The `zambil index` command for the repo that the user named, with `--repo` when it came from the flag. */
export function indexHint(flag: string | undefined): string {
  return flag === undefined ? "zambil index" : `zambil index --repo ${quoteArgument(flag)}`;
}
