import { left, right } from "../either.ts";
import { asRecord } from "../as-record.ts";
import type { Either } from "../either.ts";

/** The user config file, `config.json` in the zambil config folder. */
export interface UserConfig {
  repo: string;
}

function unsafeParseJson(text: string): unknown {
  return JSON.parse(text);
}

/** Reads the user config file. It must be a JSON object with a `repo` path; other keys are ignored. */
export function parseUserConfig(text: string): Either<string, UserConfig> {
  let parsed: unknown;
  try {
    parsed = unsafeParseJson(text);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    return left(`it is not valid JSON: ${reason}`);
  }
  const repo = asRecord(parsed)?.repo;
  if (typeof repo !== "string" || repo.trim() === "") {
    return left('it needs a "repo" key with the path of the configuration repo');
  }
  return right({ repo: repo.trim() });
}
