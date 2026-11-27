import {
  hasLocalBinOnPath,
  linkCommand,
  localBinPathLine,
  mainPath,
} from "../install/link-hint.ts";
import { readlink, realpath } from "node:fs/promises";
import type { CheckResult } from "./check-result.ts";
import type { CliConfig } from "../config.ts";
import { join } from "node:path";
import { wrap } from "@zambil/core/either";

/** The startup config, for the home folder and the `PATH`. */
export interface CheckZambilLinkOptions {
  config: CliConfig;
}

const profileAdvice =
  "Also add the export line to ~/.zshrc or ~/.bashrc, so that each new terminal and Claude Code get it.";

/** Why `~/.local/bin/zambil` does not run, when it is a link to a file that is gone. */
async function brokenLink(link: string): Promise<string[]> {
  const [target, resolved] = await Promise.all([wrap(readlink(link)), wrap(realpath(link))]);
  if (!target.ok || resolved.ok) return [];
  return [`${link} links to ${target.value}, which does not exist. The clone moved or is gone.`];
}

/** The link is missing or broken: link this clone, and put `~/.local/bin` on the `PATH` if needed. */
async function notOnPath(config: CliConfig): Promise<CheckResult> {
  const link = join(config.environment.home, ".local", "bin", "zambil");
  const text = "zambil is not on your PATH. Claude Code and the agent run zambil by name.";
  const isLinked = (await wrap(realpath(link))).ok;
  if (hasLocalBinOnPath(config)) {
    return { level: "fail", text, details: await brokenLink(link), fixes: [linkCommand()] };
  }
  if (isLinked) {
    const linked = `${link} exists, but ~/.local/bin is not on your PATH.`;
    return { level: "fail", text: linked, details: [profileAdvice], fixes: [localBinPathLine] };
  }
  return {
    level: "fail",
    text,
    details: [...(await brokenLink(link)), profileAdvice],
    fixes: [linkCommand(), localBinPathLine],
  };
}

/** Whether `zambil` is on the `PATH`, and whether it runs this clone. */
export async function checkZambilLink(
  zambilPath: string | undefined,
  options: CheckZambilLinkOptions,
): Promise<CheckResult> {
  const { config } = options;
  if (zambilPath === undefined) return notOnPath(config);
  const [onPath, running] = await Promise.all([
    wrap(realpath(zambilPath)),
    wrap(realpath(mainPath())),
  ]);
  const target = onPath.ok ? onPath.value : zambilPath;
  const here = running.ok ? running.value : mainPath();
  if (target === here) {
    return { level: "ok", text: `zambil on your PATH is ${zambilPath}, which runs ${target}.` };
  }
  return {
    level: "warn",
    text: `zambil on your PATH is ${zambilPath}, which runs ${target}, not this clone ${here}.`,
    details: ["The hooks run the zambil on your PATH. To use this clone, link it:"],
    fixes: [linkCommand()],
  };
}
