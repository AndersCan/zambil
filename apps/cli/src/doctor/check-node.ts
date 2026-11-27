import type { CheckResult } from "./check-result.ts";

/** The oldest major version of Node that zambil runs on, as in `engines` of the root `package.json`. */
const minimumMajor = 24;

/** Whether the Node that runs zambil now is new enough. */
export function checkNode(version: string): CheckResult {
  const [major = ""] = version.split(".");
  if (Number(major) >= minimumMajor) return { level: "ok", text: `Node ${version}.` };
  return {
    level: "fail",
    text: `Node ${version} is too old. zambil needs Node ${minimumMajor} or later.`,
    fixes: [
      `Install Node ${minimumMajor} or later from https://nodejs.org, then run: zambil install`,
    ],
  };
}
