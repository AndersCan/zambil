#!/usr/bin/env node
import { missingDependencyProblem, nodeVersionProblem } from "./startup/startup-problem.ts";
import type { Either } from "@zambil/core/either";
import { enableCompileCache } from "node:module";
import type { ExitCode } from "./command.ts";
import { processOutput } from "./process-output.ts";
import { text as readStream } from "node:stream/consumers";
import { resolve } from "node:path";

/** Loads the CLI and runs it. A type import of `@zambil/core` is erased, but a value import fails without the dependencies. */
async function runZambil(): Promise<ExitCode> {
  const [config, cli] = await Promise.all([import("./config.ts"), import("./run-cli.ts")]);
  const output = processOutput();
  const input = {
    readAll: () => (process.stdin.isTTY ? Promise.resolve("") : readStream(process.stdin)),
  };
  const options = { config: config.readCliConfig(), input, output, now: new Date() };
  return cli.runCli(process.argv.slice(2), options);
}

function settle(run: Promise<ExitCode>): Promise<Either<unknown, ExitCode>> {
  return run.then(
    (code): Either<unknown, ExitCode> => ({ ok: true, value: code }),
    (reason: unknown): Either<unknown, ExitCode> => ({ ok: false, error: reason }),
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
  const ran = await settle(runZambil());
  if (ran.ok) {
    process.exitCode = ran.value;
    return;
  }
  const root = resolve(import.meta.dirname, "../../..");
  const problem = missingDependencyProblem(ran.error, { root });
  if (problem === undefined) throw ran.error;
  process.stderr.write(problem);
  process.exitCode = 1;
}

await main();
