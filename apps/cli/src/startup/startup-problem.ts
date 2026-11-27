const lowestNodeMajor = 24;

/** The folder of the zambil clone, so that a message can name it. */
export interface StartupProblemOptions {
  root: string;
}

/** A message for the user when this Node is older than zambil supports, or `undefined` when it is new enough. */
export function nodeVersionProblem(version: string): string | undefined {
  const major = Number(version.split(".")[0]);
  if (major >= lowestNodeMajor) return undefined;
  return `zambil needs Node ${lowestNodeMajor} or later, and this is Node ${version}. Install Node ${lowestNodeMajor} or later from https://nodejs.org, then run zambil again.\n`;
}

function isMissingPackage(error: unknown): error is Error {
  if (!(error instanceof Error) || !("code" in error)) return false;
  return error.code === "ERR_MODULE_NOT_FOUND" && error.message.startsWith("Cannot find package");
}

/**
 * A message for the user when zambil cannot load a package, because the dependencies of the clone are not installed.
 * Any other failure, a missing local file too, returns `undefined`: it is a bug, and its stack trace helps.
 */
export function missingDependencyProblem(
  error: unknown,
  options: StartupProblemOptions,
): string | undefined {
  if (!isMissingPackage(error)) return undefined;
  const { message } = error;
  return [
    `zambil cannot start, because its dependencies are not installed in ${options.root}.`,
    `Node says: ${message}`,
    "",
    "If you installed zambil with the install script, run it again:",
    "",
    "  curl -fsSL https://raw.githubusercontent.com/AndersCan/zambil/main/install.sh | sh",
    "",
    `In a clone for development, run \`pnpm install\` in ${options.root}.`,
    "",
  ].join("\n");
}
