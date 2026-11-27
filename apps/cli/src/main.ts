#!/usr/bin/env node
import { enableCompileCache } from "node:module";
import { text as readStream } from "node:stream/consumers";

async function main(): Promise<void> {
  enableCompileCache();
  const { readCliConfig } = await import("./config.ts");
  const { runCli } = await import("./run-cli.ts");
  const output = {
    write: (text: string) => process.stdout.write(text),
    error: (text: string) => process.stderr.write(text),
  };
  const input = {
    readAll: () => (process.stdin.isTTY ? Promise.resolve("") : readStream(process.stdin)),
  };
  const options = { config: readCliConfig(), input, output, now: new Date() };
  process.exitCode = await runCli(process.argv.slice(2), options);
}

await main();
