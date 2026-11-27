import type { CheckResult } from "./check-result.ts";
import { lowestNodeMajor } from "../startup/startup-problem.ts";

/** Whether the Node that runs zambil now is new enough. */
export function checkNode(version: string): CheckResult {
  const [major = ""] = version.split(".");
  if (Number(major) >= lowestNodeMajor) return { level: "ok", text: `Node ${version}.` };
  return {
    level: "fail",
    text: `Node ${version} is too old. zambil needs Node ${lowestNodeMajor} or later.`,
    fixes: [
      `Install Node ${lowestNodeMajor} or later from https://nodejs.org, then run: zambil install`,
    ],
  };
}
