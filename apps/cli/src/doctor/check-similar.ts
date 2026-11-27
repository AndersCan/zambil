import type { CheckResult } from "./check-result.ts";
import { checkSearchFiles } from "@zambil/embed/check-search-files";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import type { UserEnvironment } from "@zambil/core/locate-repo";
import { zambilCommand } from "./zambil-command.ts";

/** Where the cache folder is, and the `--repo` flag for the fix command. */
export interface CheckSimilarOptions {
  environment: UserEnvironment;
  repoFlag: string | undefined;
}

/** Whether the model and the index for similar notes are ready, without loading the model. */
export function checkSimilar(repo: ConfigurationRepo, options: CheckSimilarOptions): CheckResult {
  const files = checkSearchFiles(repo, options);
  const index = zambilCommand("index", options);
  if (files.descriptions === 0) {
    return {
      level: "ok",
      text: "No note has a description, so similar notes need no model and no index.",
    };
  }
  if (files.model === "missing") {
    return {
      level: "fail",
      text: `The model for similar notes is not in ${files.modelFolder}, so the hook adds no similar notes.`,
      fixes: [`${index}   # downloads about 23 MB`],
    };
  }
  if (files.unindexed > 0) {
    return {
      level: "fail",
      text: `${files.unindexed} of ${files.descriptions} descriptions are not in the index ${files.indexPath}.`,
      details: [
        "The hook embeds a few of them on each prompt and leaves out the notes of the others.",
      ],
      fixes: [index],
    };
  }
  return {
    level: "ok",
    text: `The model and the index for similar notes are ready: ${files.descriptions} descriptions.`,
  };
}
