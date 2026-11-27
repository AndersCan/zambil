import type { CheckResult } from "./check-result.ts";
import type { CliConfig } from "../config.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { isNever } from "@zambil/core/is-never";
import { locateRepo } from "@zambil/core/locate-repo";
import { openRepo } from "../open-repo.ts";
import { quoteArgument } from "@zambil/core/quote-argument";
import type { RepoLocation } from "@zambil/core/locate-repo";

/** The `--repo` flag that the user gave, if any. */
export interface CheckNotesFolderOptions {
  repoFlag: string | undefined;
}

/** The result for the report, and the repo for the checks that need it. */
export interface NotesFolderCheck {
  result: CheckResult;
  repo: ConfigurationRepo | undefined;
}

function sourceFixes(location: RepoLocation): string[] {
  const { source } = location;
  switch (source) {
    case "user-config":
      return [
        "zambil init <new folder>   # if you moved the folder",
        "zambil init   # to create the folder again",
      ];
    case "environment":
      return ["unset ZAMBIL_REPO   # then zambil reads the user config file, or run zambil init"];
    case "flag": {
      const folder = quoteArgument(location.root);
      return [`mkdir -p ${folder}   # or run zambil doctor --repo <the right folder>`];
    }
    default:
      return isNever(source);
  }
}

/** Whether the notes folder exists and zambil can read it. */
export function checkNotesFolder(
  config: CliConfig,
  options: CheckNotesFolderOptions,
): NotesFolderCheck {
  const { repoFlag } = options;
  const located = locateRepo({ flag: repoFlag, environment: config.environment });
  if (!located.ok) {
    const result: CheckResult = {
      level: "skip",
      text: "The notes folder: zambil does not know where it is.",
    };
    return { result, repo: undefined };
  }
  const opened = openRepo({ flag: repoFlag, config });
  if (opened.ok) {
    const { root, notes } = opened.value;
    const count = notes.length === 1 ? "1 note" : `${notes.length} notes`;
    return {
      result: { level: "ok", text: `The notes folder ${root} has ${count}.` },
      repo: opened.value,
    };
  }
  const [text = "", ...details] = opened.error.split("\n");
  const fixes = sourceFixes(located.value);
  return { result: { level: "fail", text, details, fixes }, repo: undefined };
}
