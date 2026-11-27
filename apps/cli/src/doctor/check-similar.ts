import type { CheckResult } from "./check-result.ts";
import { checkSearchFiles } from "@zambil/embed/check-search-files";
import { countSearchTexts } from "../index/count-search-texts.ts";
import type { ConfigurationRepo } from "@zambil/core/configuration-repo";
import { unindexedLimit } from "@zambil/claude-code/find-similar-notes";
import type { UserEnvironment } from "@zambil/core/locate-repo";
import { zambilCommand } from "./zambil-command.ts";

/** Where the cache folder is, and the `--repo` flag for the fix command. */
export interface CheckSimilarOptions {
  environment: UserEnvironment;
  repoFlag: string | undefined;
}

/** Whether the model and the index for similar notes are ready, without loading the model. */
export async function checkSimilar(
  repo: ConfigurationRepo,
  options: CheckSimilarOptions,
): Promise<CheckResult> {
  const files = await checkSearchFiles(repo, options);
  const index = zambilCommand("index", options);
  if (files.texts === 0) {
    return {
      level: "ok",
      text: "No note has a description or triggers, so similar notes need no model and no index.",
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
    const total = countSearchTexts(files.texts);
    const effect =
      files.unindexed > unindexedLimit
        ? `The hook embeds the first ${unindexedLimit} of them on each prompt and does not score the others.`
        : "The hook embeds them on each prompt, which makes it slower.";
    return {
      level: "fail",
      text: `${files.unindexed} of ${total} are not in the index ${files.indexPath}.`,
      details: [effect],
      fixes: [index],
    };
  }
  const texts = countSearchTexts(files.texts);
  return {
    level: "ok",
    text: `The model and the index for similar notes are ready: ${texts}.`,
  };
}
