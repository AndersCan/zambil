import { describe, expect, test } from "vite-plus/test";
import { checkHookNames } from "./check-hook-names.ts";
import { loadRepo } from "@zambil/core/load-repo";
import { writeTestRepo } from "@zambil/core/write-test-repo";

const hookList = {
  source: "https://code.claude.com/docs/en/hooks.md",
  readOn: "2026-11-27",
  hooks: ["SessionStart", "UserPromptSubmit", "Notification", "SessionEnd"],
  contextHooks: ["SessionStart", "UserPromptSubmit"],
};

describe("checkHookNames", () => {
  test("warns about a hook that cannot add context and a name that is not a hook", async () => {
    const root = await writeTestRepo({
      "good.md": "---\nhooks: [SessionStart, UserPromptSubmit]\n---\n",
      "quiet.md": "---\nhooks: [Notification]\n---\n",
      "typo.md": "---\nhooks: [sessionstart, SessionBegin]\n---\n",
    });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    expect(checkHookNames(repo.value.notes, { hookList })).toEqual([
      {
        severity: "warning",
        path: "quiet.md",
        message:
          '`hooks` names "Notification", but that Claude Code hook cannot add context, so the note never shows there',
      },
      {
        severity: "warning",
        path: "typo.md",
        message:
          '`hooks` names "sessionstart", but the Claude Code hooks reference of 2026-11-27 has no such hook. Names compare exactly: write "SessionStart"',
      },
      {
        severity: "warning",
        path: "typo.md",
        message:
          '`hooks` names "SessionBegin", but the Claude Code hooks reference of 2026-11-27 has no such hook',
      },
    ]);
  });
});
