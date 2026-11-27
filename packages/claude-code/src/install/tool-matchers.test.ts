import { describe, expect, test } from "vite-plus/test";
import { matcherCovers, toolMatchers } from "./tool-matchers.ts";
import { loadRepo } from "@zambil/core/load-repo";
import { writeTestRepo } from "@zambil/core/write-test-repo";

describe("toolMatchers", () => {
  test("joins the tools of the notes of each tool hook, and gives no matcher when a note names no tool or a pattern", async () => {
    const root = await writeTestRepo({
      "shell.md": "---\nhooks: [PreToolUse, PostToolUse]\ntools: Bash\n---\nQuote paths.\n",
      "style.md":
        "---\nhooks: [PreToolUse, PostToolUseFailure]\ntools: [Write, Edit, Bash]\n---\nStyle.\n",
      "every.md": "---\nhooks: PostToolUse\n---\nEvery tool.\n",
      "mcp.md": "---\nhooks: PostToolUseFailure\ntools: mcp__.*\n---\nMCP.\n",
      "batch.md": "---\nhooks: PostToolBatch\ntools: Bash\n---\nBatch.\n",
    });
    const repo = loadRepo(root);
    if (!repo.ok) throw new Error(repo.error.message);
    const hookNames = ["PreToolUse", "PostToolUse", "PostToolUseFailure", "PostToolBatch"];
    expect(toolMatchers(repo.value.notes, { hookNames })).toEqual({
      PreToolUse: "Bash|Edit|Write",
    });
  });
});

describe("matcherCovers", () => {
  test("covers the tools that the notes need, and every tool only with no matcher", () => {
    expect([
      matcherCovers(undefined, { needed: "Bash" }),
      matcherCovers("Bash|Edit", { needed: "Edit" }),
      matcherCovers("Bash", { needed: "Bash|Edit" }),
      matcherCovers("Bash", { needed: undefined }),
      matcherCovers("Bash, Edit", { needed: "Edit" }),
      matcherCovers("mcp__deploy-server__run", { needed: "mcp__deploy-server__run" }),
    ]).toEqual([true, true, false, false, true, true]);
  });
});
