/** An error makes `zambil check` fail. A warning does not. */
export type ProblemSeverity = "error" | "warning";

/** Something wrong with one note. `path` is relative to the repo root. */
export interface NoteProblem {
  severity: ProblemSeverity;
  path: string;
  message: string;
}
