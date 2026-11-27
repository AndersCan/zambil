import { describe, expect, test } from "vite-plus/test";
import { hookPayload, preToolUse } from "./hook-input/hook-payloads.ts";
import { answerHook } from "./answer-hook.ts";
import { loadRepo } from "@zambil/core/load-repo";
import { parseHookInput } from "./hook-input/parse-hook-input.ts";
import { writeTestRepo } from "@zambil/core/write-test-repo";

const now = new Date(2026, 10, 27, 9, 0);

const notes = {
  "session/welcome.md": "---\ndescription: Session start.\nhooks: SessionStart\n---\nWelcome.\n",
  "session/old.md": "---\nhooks: SessionStart\nexpires: 2026-11-01\n---\nOld news.\n",
  "coding/style.md":
    "---\ndescription: Style.\nhooks: [PreToolUse, PostToolBatch]\ntools: [Edit, Write]\n---\nUse function declarations.\n",
  "shell.md": "---\ndescription: Shell.\nhooks: [PreToolUse, PostToolBatch]\n---\nQuote paths.\n",
  "language.md": "---\ndescription: Language.\nhooks: UserPromptSubmit\n---\nAnswer in English.\n",
  "deploy.md":
    '---\ndescription: How to deploy.\nhooks: UserPromptSubmit\nexpires: 2026-12-31\nwhen-expired: "[[check deploy]]"\n---\n# Steps\nRun make deploy.\n',
  "check deploy.md": "---\ndescription: How to check the deploy note.\n---\nRun make status.\n",
  "today.md":
    '---\ndescription: The date.\nexpires: 2026-11-20\nwhen-expired: "[[check deploy]]"\n---\nToday is 2026-11-19.\n',
  "skills/release/SKILL.md": "---\ndescription: Release a package.\n---\nRun the release.\n",
  "backup.md":
    "---\ndescription: Back up the notes.\nscript: backup.sh\nrun-with: bash\n---\nPass a folder.\n",
  "backup.sh": "echo SCRIPT-SOURCE\n",
  "a/twin.md": "One twin.\n",
  "b/twin.md": "Other twin.\n",
  "finish.md": "---\ndescription: Finish.\nhooks: Stop\n---\nSay done.\n",
  "rebase.md":
    "---\ndescription: How to rebase.\n---\n# Steps\nRun git rebase.\n# Conflicts\nFix them.\n",
};

/** The names of the notes that a similarity search found, best first. */
interface AnswerOptions {
  similar: string[];
}

async function answer(payload: string, options: AnswerOptions = { similar: [] }) {
  const root = await writeTestRepo(notes);
  const repo = loadRepo(root);
  const request = parseHookInput(payload);
  if (!repo.ok || !request.ok) return { root, stdout: "not answered" };
  if (request.value.kind === "ignore") return { root, stdout: "not answered" };
  const { input } = request.value;
  const similarNotes = options.similar.flatMap((name) =>
    repo.value.notes.filter((note) => note.name === name),
  );
  return { root, stdout: answerHook(repo.value, { input, now, similarNotes }) };
}

function contextOf(stdout: string): unknown {
  if (stdout === "") return "";
  return JSON.parse(stdout);
}

async function namesAt(
  payload: string,
  options: AnswerOptions = { similar: [] },
): Promise<string[]> {
  const { stdout } = await answer(payload, options);
  const names: string[] = [];
  for (const match of stdout.matchAll(/<(?:note|skill|script) name=\\"(?<name>[^\\]+)\\"/g)) {
    names.push(match.groups?.name ?? "");
  }
  return names;
}

function batch(toolNames: string[]): string {
  const calls = toolNames.map((name) => ({ tool_name: name, tool_input: {}, tool_use_id: name }));
  return hookPayload("PostToolBatch", { tool_calls: calls });
}

const repoHeading = "zambil reads notes from the user's configuration repo.";

describe("answerHook", () => {
  test("adds the current notes of a hook in the JSON shape of the hooks reference", async () => {
    const { stdout } = await answer(hookPayload("SessionStart", { source: "startup" }));
    expect({ endsWithNewline: stdout.endsWith("}\n"), output: contextOf(stdout) }).toEqual({
      endsWithNewline: true,
      output: {
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: [
            `${repoHeading} These notes name the SessionStart hook:`,
            "",
            '<note name="welcome" path="session/welcome.md">',
            "Description: Session start.",
            "",
            "Welcome.",
            "</note>",
          ].join("\n"),
        },
      },
    });
  });

  test("filters tool hooks with tools, and a note without tools applies to every tool", async () => {
    const names = await Promise.all([
      namesAt(preToolUse("Edit")),
      namesAt(preToolUse("Bash")),
      namesAt(batch(["Read", "Write"])),
      namesAt(batch(["Read"])),
      namesAt(hookPayload("Stop", { stop_hook_active: false })),
    ]);
    expect(names).toEqual([
      ["style", "shell"],
      ["shell"],
      ["style", "shell"],
      ["shell"],
      ["finish"],
    ]);
  });

  test("stays silent when no note applies", async () => {
    const outputs = await Promise.all([
      answer(hookPayload("SubagentStart", { agent_id: "a1", agent_type: "Explore" })),
      answer(hookPayload("PostToolUse", { tool_name: "Bash", tool_input: {}, tool_response: {} })),
    ]);
    const stdouts = outputs.map((output) => output.stdout);
    expect(stdouts).toEqual(["", ""]);
  });

  test("adds each z:<name> next to the prompt, with offers for skills and scripts and clear warnings", async () => {
    const prompt = "z:deploy z:today, z:release z:backup z:nope and z:twin";
    const { root, stdout } = await answer(hookPayload("UserPromptSubmit", { prompt }));
    const showCheck = `zambil show 'check deploy' --repo ${root}`;
    const showToday = `zambil show today --repo ${root} --expired`;
    const checkLink = `[[check deploy]]: How to check the deploy note. To read [[check deploy]], run \`${showCheck}\`.`;
    const list = `To see the name of every note, run \`zambil list --repo ${root}\`.`;
    expect(contextOf(stdout)).toEqual({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: [
          `${repoHeading} The user named these notes with z:<name> in the prompt:`,
          "",
          "The user typed z:deploy in the prompt. This is the note that it names:",
          '<note name="deploy" path="deploy.md">',
          "Description: How to deploy.",
          `This note is current until 2026-12-31, but it can be wrong before that date. To verify its claims, read ${checkLink}`,
          "",
          "# Steps",
          "Run make deploy.",
          "</note>",
          "",
          "The user typed z:today in the prompt. The note that it names expired:",
          '<note name="today" path="today.md">',
          "Description: The date.",
          "Warning: this note expired on 2026-11-20, so its content can be out of date. It is not shown here.",
          `To update or verify it, read ${checkLink}`,
          `You can skip this note. To read [[today]] anyway, run \`${showToday}\`.`,
          "You can offer the user an update. Save a change, or a new `expires` date, only when the user asks for it.",
          "</note>",
          "",
          'The user typed z:release in the prompt, so the user opted in to the skill "release".',
          '<skill name="release" path="skills/release/SKILL.md">',
          "Description: Release a package.",
          `To use it, read ${root}/skills/release/SKILL.md with the Read tool and follow it. Paths in it are relative to ${root}/skills/release.`,
          "</skill>",
          "",
          "The user typed z:backup in the prompt. This is the note that it names:",
          '<script name="backup" path="backup.md">',
          "Description: Back up the notes.",
          `The script is ${root}/backup.sh. Run it with \`bash ${root}/backup.sh\`.`,
          "",
          "Pass a folder.",
          "</script>",
          "",
          "The user typed z:nope in the prompt.",
          `Warning: zambil cannot show "nope", because no note has the name "nope". ${list}`,
          "",
          "The user typed z:twin in the prompt.",
          `Warning: zambil cannot show "twin", because 2 notes use the name "twin": a/twin.md, b/twin.md. ${list}`,
          "",
          `${repoHeading} These notes name the UserPromptSubmit hook:`,
          "",
          '<note name="language" path="language.md">',
          "Description: Language.",
          "",
          "Answer in English.",
          "</note>",
        ].join("\n"),
      },
    });
  });

  test("reads names with spaces and parts of notes, and a part keeps the whole hook note", async () => {
    const prompt = "z:[[check deploy]] z:deploy#Steps `z:release`";
    const names = await namesAt(hookPayload("UserPromptSubmit", { prompt }));
    expect(names).toEqual(["check deploy", "deploy", "deploy", "language"]);
  });

  test("points a missing heading to the note, not to the list of names", async () => {
    const { root, stdout } = await answer(
      hookPayload("UserPromptSubmit", { prompt: "z:deploy#Nope" }),
    );
    const context = JSON.stringify(contextOf(stdout)).split("\\n").slice(1, 4);
    expect(context).toEqual([
      "",
      "The user typed z:deploy#Nope in the prompt.",
      `Warning: zambil cannot show \\"deploy#Nope\\", because [[deploy]] has no heading \\"Nope\\". To read [[deploy]], run \`zambil show deploy --repo ${root}\`.`,
    ]);
  });

  test("offers similar skills and scripts as matches, never as an opt-in, after the other notes", async () => {
    const prompt = "make a backup and ship a new version";
    const similar = ["release", "backup", "check deploy"];
    const { root, stdout } = await answer(hookPayload("UserPromptSubmit", { prompt }), { similar });
    expect(contextOf(stdout)).toEqual({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: [
          `${repoHeading} These notes name the UserPromptSubmit hook:`,
          "",
          '<note name="deploy" path="deploy.md">',
          "Description: How to deploy.",
          `This note is current until 2026-12-31, but it can be wrong before that date. To verify its claims, read [[check deploy]]: How to check the deploy note. To read [[check deploy]], run \`zambil show 'check deploy' --repo ${root}\`.`,
          "",
          "# Steps",
          "Run make deploy.",
          "</note>",
          "",
          '<note name="language" path="language.md">',
          "Description: Language.",
          "",
          "Answer in English.",
          "</note>",
          "",
          `${repoHeading} The description of each of these notes is similar to the prompt. The user did not name them, so use one only if it fits the task:`,
          "",
          'The skill "release" matched the prompt. The user did not opt in to it, so load it only if it fits the task.',
          '<skill name="release" path="skills/release/SKILL.md">',
          "Description: Release a package.",
          `To use it, read ${root}/skills/release/SKILL.md with the Read tool and follow it. Paths in it are relative to ${root}/skills/release.`,
          "</skill>",
          "",
          'The script "backup" matched the prompt. zambil did not run it. Run it only if the task needs it.',
          '<script name="backup" path="backup.md">',
          "Description: Back up the notes.",
          `The script is ${root}/backup.sh. Run it with \`bash ${root}/backup.sh\`.`,
          "",
          "Pass a folder.",
          "</script>",
          "",
          '<note name="check deploy" path="check deploy.md">',
          "Description: How to check the deploy note.",
          "",
          "Run make status.",
          "</note>",
        ].join("\n"),
      },
    });
    expect(stdout.includes("SCRIPT-SOURCE")).toBe(false);
  });

  test("adds a similar note once: not after its hook, a SessionStart hook, or a z:<name> of it or a part of it", async () => {
    const prompt = "z:deploy#Steps and z:[[check deploy]]";
    const similar = ["language", "deploy", "check deploy", "welcome"];
    const names = await namesAt(hookPayload("UserPromptSubmit", { prompt }), { similar });
    expect(names).toEqual(["deploy", "check deploy", "deploy", "language"]);
  });

  test("leaves out a similar note that the prompt names in part, though no hook adds it", async () => {
    const prompt = "rebase it the way z:rebase#Steps says";
    const names = await namesAt(hookPayload("UserPromptSubmit", { prompt }), {
      similar: ["rebase"],
    });
    expect(names).toEqual(["rebase", "deploy", "language"]);
  });
});
