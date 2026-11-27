import { describe, expect, test } from "vite-plus/test";
import type { ExpiredMode } from "./find-target.ts";
import { loadRepo } from "../repo/load-repo.ts";
import { renderNote } from "./render-note.ts";
import type { SkillOffer } from "./render-wording.ts";
import { writeTestRepo } from "../repo/write-test-repo.ts";

const wording = {
  openNote: (target: string) => `Open ${target}.`,
  openExpired: (target: string) => `Open ${target} anyway.`,
  loadSkill: (skill: SkillOffer) => `Load ${skill.path}.`,
};

interface RenderOptions {
  target: string;
  expired?: ExpiredMode;
  now?: Date;
}

const beforeExpiry = new Date(2026, 10, 27);
const afterExpiry = new Date(2026, 10, 29);

const cacheNotes = {
  "today.md":
    '---\ndescription: The date.\nexpires: 2026-11-28\nwhen-expired: "[[refresh]]"\n---\nToday is 2026-11-27.\n',
  "refresh.md":
    "---\ndescription: How to refresh the date.\nexpires: 2026-11-27T12:00\n---\nRun `date`.\n",
};

async function render(files: Record<string, string>, options: RenderOptions) {
  const root = await writeTestRepo(files);
  const loaded = loadRepo(root);
  if (!loaded.ok) return { root, status: "unloaded", text: loaded.error.message };
  const now = options.now ?? beforeExpiry;
  const rendered = renderNote(loaded.value, { ...options, now, wording });
  return { root, ...rendered };
}

describe("renderNote", () => {
  test("brings in only the name and description for a link, and the content for an embed", async () => {
    const files = {
      "host.md":
        "---\ndescription: The host.\n---\nSee [[guest|the guest]] and [[Guest]].\n\n![[embedded]]\n",
      "guest.md": "---\ndescription: A guest.\n---\nGuest content.\n",
      "embedded.md": "Embedded content links [[guest#Part]].\n",
    };
    expect(await render(files, { target: "host" })).toEqual({
      root: expect.any(String),
      status: "shown",
      text: [
        '<note name="host" path="host.md">',
        "Description: The host.",
        "",
        "See [[guest|the guest]] and [[Guest]].",
        "",
        '<note name="embedded" path="embedded.md">',
        "Embedded content links [[guest#Part]].",
        "",
        "Links:",
        '- [[guest#Part]]: Warning: [[guest]] has no heading "Part".',
        "</note>",
        "",
        "Links:",
        "- [[guest]]: A guest. Open guest.",
        "</note>",
      ].join("\n"),
    });
  });

  test("embeds a heading or a block, and points an empty name at the note itself", async () => {
    const files = {
      "host.md": "![[guide#Use]]\n![[guide#^tip]]\n",
      "guide.md":
        "# Use\nRun it. ^tip\n\nSee [[#Use]] and ![[#^tip]]. Not [[#Nope]].\n# Other\nNot this.\n",
    };
    const tip = ['<note name="guide" path="guide.md" section="#^tip">', "Run it.", "</note>"];
    const use = ['<note name="guide" path="guide.md" section="#Use">', "# Use", "Run it.", ""];
    use.push("See [[#Use]] and", ...tip, ". Not [[#Nope]].", "", "Links:");
    use.push("- [[guide#Use]]: It has no description. Open guide#Use.");
    use.push('- [[guide#Nope]]: Warning: [[guide]] has no heading "Nope".', "</note>");
    const host = ['<note name="host" path="host.md">', ...use, ...tip, "</note>"];
    expect((await render(files, { target: "host" })).text).toBe(host.join("\n"));
  });

  test("warns in place of an unknown name, an ambiguous name, a missing block and a cycle", async () => {
    const files = {
      "host.md": "![[nope]]\n![[same]]\n![[loop#^missing]]\n![[loop]]\n",
      "a/same.md": "One.",
      "b/same.md": "Two.",
      "loop.md": "Loop: ![[host]]",
    };
    const shown = await render(files, { target: "host" });
    const missing = await render(files, { target: "nope" });
    expect([shown.text, missing]).toEqual([
      [
        '<note name="host" path="host.md">',
        'Warning: zambil cannot show ![[nope]], because no note has the name "nope".',
        'Warning: zambil cannot show ![[same]], because 2 notes use the name "same": a/same.md, b/same.md.',
        'Warning: zambil cannot show ![[loop#^missing]], because [[loop]] has no block "^missing".',
        '<note name="loop" path="loop.md">',
        "Loop:",
        "Warning: zambil cannot show ![[host]], because it embeds itself: host > loop > host.",
        "</note>",
        "</note>",
      ].join("\n"),
      {
        root: expect.any(String),
        status: "unresolved",
        text: 'Warning: zambil cannot show "nope", because no note has the name "nope".',
      },
    ]);
  });

  test("puts a warning in place of an expired note, with its when-expired note and a way to read it anyway", async () => {
    const files = { ...cacheNotes, "host.md": "![[today]]\n\nSee [[today]].\n![[today#Nope]]\n" };
    const embedded = await render(files, { target: "host", now: afterExpiry });
    const shown = await render(files, { target: "today", now: afterExpiry });
    const warning = [
      '<note name="today" path="today.md">',
      "Description: The date.",
      "Warning: this note expired on 2026-11-28, so its content can be out of date. It is not shown here.",
      "To update or verify it, read [[refresh]]: How to refresh the date. Warning: it expired on 2026-11-27 12:00, so it can be out of date. Open refresh anyway.",
      "You can skip this note. Open today anyway.",
      "You can offer the user an update. Save a change, or a new `expires` date, only when the user asks for it.",
      "</note>",
    ];
    expect([embedded.text, shown.status, shown.text]).toEqual([
      [
        '<note name="host" path="host.md">',
        ...warning,
        "",
        "See [[today]].",
        'Warning: zambil cannot show ![[today#Nope]], because [[today]] has no heading "Nope".',
        "",
        "Links:",
        "- [[today]]: The date. Warning: it expired on 2026-11-28, so it can be out of date. To update or verify it, read [[refresh]]: How to refresh the date. Warning: it expired on 2026-11-27 12:00, so it can be out of date. Open refresh anyway. Open today anyway.",
        "</note>",
      ].join("\n"),
      "expired",
      warning.join("\n"),
    ]);
  });

  test("reads an expired note only when asked, and still warns about the expired notes it embeds", async () => {
    const files = {
      ...cacheNotes,
      "week.md": "---\nexpires: 2026-11-28\n---\nWeek 48.\n![[today]]\n",
    };
    const read = await render(files, { target: "week", now: afterExpiry, expired: "show" });
    const lines = read.text.split("\n");
    expect({ status: read.status, head: lines.slice(0, 4), embed: lines[5] }).toEqual({
      status: "shown",
      head: [
        '<note name="week" path="week.md">',
        "Warning: this note expired on 2026-11-28, so its content can be out of date. It is shown because you chose to read it anyway.",
        "You can offer the user an update. Save a change, or a new `expires` date, only when the user asks for it.",
        "",
      ],
      embed: '<note name="today" path="today.md">',
    });
    expect(lines.slice(6, 8)).toEqual([
      "Description: The date.",
      "Warning: this note expired on 2026-11-28, so its content can be out of date. It is not shown here.",
    ]);
  });

  test("names the when-expired note of a current note as the way to verify it, and marks it when it expired", async () => {
    const early = await render(cacheNotes, { target: "today", now: beforeExpiry });
    const late = await render(cacheNotes, { target: "today", now: new Date(2026, 10, 27, 18) });
    expect([early.text, late.text.split("\n")[2]]).toEqual([
      [
        '<note name="today" path="today.md">',
        "Description: The date.",
        "This note is current until 2026-11-28, but it can be wrong before that date. To verify its claims, read [[refresh]]: How to refresh the date. Open refresh.",
        "",
        "Today is 2026-11-27.",
        "</note>",
      ].join("\n"),
      "This note is current until 2026-11-28, but it can be wrong before that date. To verify its claims, read [[refresh]]: How to refresh the date. Warning: it expired on 2026-11-27 12:00, so it can be out of date. Open refresh anyway.",
    ]);
  });

  test("offers a skill and a script without their source", async () => {
    const files = {
      "skills/release/SKILL.md":
        "---\ndescription: Release a package.\n---\nStep one of the skill.\n",
      "tools/backup.md":
        "---\ndescription: Back up.\nscript: back up.sh\nrun-with: bash\n---\nPass a folder.\n",
      "tools/back up.sh": "echo SCRIPT-SOURCE\n",
      "tools/gone.md": "---\nscript: gone.sh\n---\n",
      "host.md": "[[release]] [[backup]] ![[backup.sh]]\n![[gone]]",
    };
    const skill = await render(files, { target: "release" });
    const script = await render(files, { target: "backup" });
    const host = await render(files, { target: "host" });
    const path = `${script.root}/tools/back up.sh`;
    const gone = `${host.root}/tools/gone.sh`;
    expect([skill.text, script.text, host.text]).toEqual([
      [
        '<skill name="release" path="skills/release/SKILL.md">',
        "Description: Release a package.",
        `Load ${skill.root}/skills/release/SKILL.md.`,
        "</skill>",
      ].join("\n"),
      [
        '<script name="backup" path="tools/backup.md">',
        "Description: Back up.",
        `The script is ${path}. Run it with \`bash '${path}'\`.`,
        "",
        "Pass a folder.",
        "</script>",
      ].join("\n"),
      [
        '<note name="host" path="host.md">',
        "[[release]] [[backup]]",
        'Warning: zambil cannot show ![[backup.sh]], because no note has the name "backup.sh".',
        '<script name="gone" path="tools/gone.md">',
        `Warning: no file is at ${gone}, so the script cannot run.`,
        "</script>",
        "",
        "Links:",
        `- [[release]] (skill): Release a package. Load ${host.root}/skills/release/SKILL.md.`,
        "- [[backup]] (script): Back up. Open backup.",
        "</note>",
      ].join("\n"),
    ]);
  });

  test("gives a true reason for a note whose frontmatter does not parse", async () => {
    const files = { "broken.md": "---\nexpires: 2099-01-01\ntags: [a\n---\nOld.\n" };
    const lines = (await render(files, { target: "broken" })).text.split("\n");
    expect(lines[1]).toBe(
      "Warning: this note counts as expired, because zambil cannot read its `expires` value or its frontmatter, so its content can be out of date. It is not shown here.",
    );
  });

  test("finds headings in a note with Windows line endings", async () => {
    const files = { "guide.md": "# Use\r\nRun it.\r\n# Other\r\n" };
    expect((await render(files, { target: "guide#Use" })).text).toBe(
      '<note name="guide" path="guide.md" section="#Use">\n# Use\nRun it.\n</note>',
    );
  });

  test("leaves links in code blocks and inline code as plain text", async () => {
    const files = { "host.md": "`[[nope]]` and\n```\n![[nope]]\n```\n" };
    expect((await render(files, { target: "host" })).text).toBe(
      '<note name="host" path="host.md">\n`[[nope]]` and\n```\n![[nope]]\n```\n</note>',
    );
  });
});
