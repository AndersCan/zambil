import { describe, expect, test } from "vite-plus/test";
import { installHooks, listZambilHooks, uninstallHooks } from "./settings-hooks.ts";

const command =
  "NODE_COMPILE_CACHE=/home/ada/.cache/zambil/node-compile-cache /home/ada/.local/bin/zambil hook --repo /home/ada/notes";

const zambil = { type: "command", command, timeout: 10 };

const lint = { type: "command", command: "npm run lint" };

/** Settings with other keys, a hook of the user, and a zambil hook from an older install. */
const settings = {
  model: "opus",
  permissions: { allow: ["Bash(npm test)"] },
  hooks: {
    PreToolUse: [{ matcher: "Bash", hooks: [lint] }],
    Stop: [{ hooks: [lint, { type: "command", command: "zambil hook", timeout: 10 }] }],
    SessionEnd: [],
  },
};

describe("installHooks", () => {
  test("adds one zambil hook per named hook, removes the others and keeps the rest", () => {
    const installed = installHooks(settings, {
      command,
      hookNames: ["UserPromptSubmit", "PreToolUse"],
    });
    expect(installed).toEqual({
      ok: true,
      value: {
        model: "opus",
        permissions: { allow: ["Bash(npm test)"] },
        hooks: {
          PreToolUse: [{ matcher: "Bash", hooks: [lint] }, { hooks: [zambil] }],
          Stop: [{ hooks: [lint] }],
          SessionEnd: [],
          UserPromptSubmit: [{ hooks: [zambil] }],
        },
      },
    });
  });

  test("gives the same settings on a second run, and updates the command in its place", () => {
    const hookNames = ["UserPromptSubmit", "Stop"];
    const first = installHooks(settings, { command, hookNames });
    if (!first.ok) throw new Error(first.error);
    const second = installHooks(first.value, { command, hookNames });
    const moved = installHooks(first.value, {
      command: "/opt/zambil hook --repo /notes",
      hookNames,
    });
    if (!moved.ok) throw new Error(moved.error);
    expect({ second, stop: moved.value.hooks }).toEqual({
      second: first,
      stop: {
        PreToolUse: [{ matcher: "Bash", hooks: [lint] }],
        Stop: [
          {
            hooks: [
              lint,
              { type: "command", command: "/opt/zambil hook --repo /notes", timeout: 10 },
            ],
          },
        ],
        SessionEnd: [],
        UserPromptSubmit: [
          { hooks: [{ type: "command", command: "/opt/zambil hook --repo /notes", timeout: 10 }] },
        ],
      },
    });
  });

  test("moves a zambil hook out of a group with a matcher and keeps one zambil hook per event", () => {
    const old = { type: "command", command: "zambil hook" };
    const narrow = {
      hooks: { PreToolUse: [{ matcher: "Bash", hooks: [lint, old] }, { hooks: [old, old] }] },
    };
    const twice = { hooks: { Stop: [{ hooks: [old, lint, old] }] } };
    const hookNames = ["PreToolUse", "Stop"];
    expect([
      installHooks(narrow, { command, hookNames }),
      installHooks(twice, { command, hookNames }),
    ]).toEqual([
      {
        ok: true,
        value: {
          hooks: {
            PreToolUse: [{ matcher: "Bash", hooks: [lint] }, { hooks: [zambil] }],
            Stop: [{ hooks: [zambil] }],
          },
        },
      },
      {
        ok: true,
        value: { hooks: { Stop: [{ hooks: [zambil, lint] }], PreToolUse: [{ hooks: [zambil] }] } },
      },
    ]);
  });

  test("refuses settings whose hooks it cannot read", () => {
    const results = [
      installHooks({ hooks: [] }, { command, hookNames: ["UserPromptSubmit"] }),
      installHooks({ hooks: { Stop: {} } }, { command, hookNames: ["UserPromptSubmit"] }),
    ];
    expect(results).toEqual([
      { ok: false, error: "its `hooks` value is not an object" },
      { ok: false, error: "its `hooks.Stop` value is not a list" },
    ]);
  });
});

describe("listZambilHooks", () => {
  test("lists the zambil command lines per event and leaves out the user's hooks", () => {
    expect([listZambilHooks(settings), listZambilHooks({}), listZambilHooks({ hooks: 1 })]).toEqual(
      [
        { ok: true, value: { Stop: ["zambil hook"] } },
        { ok: true, value: {} },
        { ok: false, error: "its `hooks` value is not an object" },
      ],
    );
  });
});

describe("uninstallHooks", () => {
  test("removes every zambil hook and leaves the settings as they were before the install", () => {
    const empty = { model: "opus" };
    const installed = installHooks(empty, { command, hookNames: ["UserPromptSubmit"] });
    if (!installed.ok) throw new Error(installed.error);
    expect([
      uninstallHooks(settings),
      uninstallHooks(installed.value),
      uninstallHooks(empty),
    ]).toEqual([
      {
        ok: true,
        value: {
          model: "opus",
          permissions: { allow: ["Bash(npm test)"] },
          hooks: {
            PreToolUse: [{ matcher: "Bash", hooks: [lint] }],
            Stop: [{ hooks: [lint] }],
            SessionEnd: [],
          },
        },
      },
      { ok: true, value: empty },
      { ok: true, value: empty },
    ]);
  });
});
