import type { CommandOutput } from "./command.ts";
import type { Writable } from "node:stream";

/** Writes to the stream while it is open. After a failed write, for example to a closed pipe, it drops the text. */
function writerFor(stream: Writable): (text: string) => void {
  stream.on("error", () => stream.destroy());
  return (text) => {
    if (stream.writable) stream.write(text);
  };
}

/**
 * Standard output and standard error of the process. A reader that exits early, as in `zambil init |
 * head -3`, closes the pipe. The command then runs to its end without output, and prints no stack trace.
 */
export function processOutput(): CommandOutput {
  return { write: writerFor(process.stdout), error: writerFor(process.stderr) };
}
