const plainArgument = /^[\w@%+=:,./~-]+$/;

/** Quotes a command-line argument for a POSIX shell, so that a printed hint can be pasted as it is. */
export function quoteArgument(argument: string): string {
  if (plainArgument.test(argument)) return argument;
  const escaped = argument.replaceAll("'", "'\\''");
  return `'${escaped}'`;
}
