#!/usr/bin/env node
import { missingDependencyProblem, nodeVersionProblem } from "./startup/startup-problem.ts";
import type { Either } from "@zambil/core/either";
import { enableCompileCache } from "node:module";
import type { readCliConfig } from "./config.ts";
import { text as readStream } from "node:stream/consumers";
import { resolve } from "node:path";
import type { runCli } from "./run-cli.ts";

interface CliModules {
  readCliConfig: typeof readCliConfig;
  runCli: typeof runCli;
}

/** A type import of `@zambil/core` is erased, but a value import fails before the dependencies are installed. */
function loadCli(): Promise<Either<unknown, CliModules>> {
  return Promise.all([import("./config.ts"), import("./run-cli.ts")]).then(
    ([config, cli]): Either<unknown, CliModules> => ({
      ok: true,
      value: { readCliConfig: config.readCliConfig, runCli: cli.runCli },
    }),
    (reason: unknown): Either<unknown, CliModules> => ({ ok: false, error: reason }),
  );
}

async function main(): Promise<void> {
  const versionProblem = nodeVersionProblem(process.versions.node);
  if (versionProblem !== undefined) {
    process.stderr.write(versionProblem);
    process.exitCode = 1;
    return;
  }
  enableCompileCache();
  const loaded = await loadCli();
  if (!loaded.ok) {
    const root = resolve(import.meta.dirname, "../../..");
    const problem = missingDependencyProblem(loaded.error, { root });
    if (problem === undefined) throw loaded.error;
    process.stderr.write(problem);
    process.exitCode = 1;
    return;
  }
  const cli = loaded.value;
  const output = {
    write: (text: string) => process.stdout.write(text),
    error: (text: string) => process.stderr.write(text),
  };
  const input = {
    readAll: () => (process.stdin.isTTY ? Promise.resolve("") : readStream(process.stdin)),
  };
  const options = { config: cli.readCliConfig(), input, output, now: new Date() };
  process.exitCode = await cli.runCli(process.argv.slice(2), options);
}

await main();
