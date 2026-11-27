/**
 * `ok`: nothing to do. `warn`: worth a look, but zambil works. `fail`: something to fix, which sets
 * the exit code to 1. `skip`: the check needs what an earlier check could not find.
 */
export type CheckLevel = "ok" | "warn" | "fail" | "skip";

/** One line of the doctor report, the lines that explain it, and the commands that fix it. */
export interface CheckResult {
  level: CheckLevel;
  text: string;
  details?: string[];
  fixes?: string[];
}
