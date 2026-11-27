import type { CommandOutput } from "../command.ts";
import { spawn } from "node:child_process";

/** The text for standard input, and where the program prints. */
export interface RunProgramOptions {
  input: string;
  output: CommandOutput;
}

/**
 * Runs a program and passes what it prints to the output of the command, line by line as it comes.
 * It resolves with the exit code, and with 1 when the program does not start or a signal stops it.
 */
export function runProgram(command: string[], options: RunProgramOptions): Promise<number> {
  const [program = "", ...args] = command;
  const { output } = options;
  return new Promise((resolve) => {
    const child = spawn(program, args, { stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.on("data", (chunk: Buffer) => output.write(chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => output.error(chunk.toString()));
    child.on("error", (error) => {
      output.error(`${error.message}\n`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.stdin.end(options.input);
  });
}
