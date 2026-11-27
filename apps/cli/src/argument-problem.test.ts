import { describe, expect, test } from "vite-plus/test";
import { argumentProblem } from "./argument-problem.ts";

const options = {
  repo: { type: "string" },
  help: { type: "boolean", short: "h" },
  expires: { type: "string" },
  rewrite: { type: "boolean" },
} as const;

describe("argumentProblem", () => {
  test("says in plain words what is wrong with the first rejected argument", () => {
    const cases = [
      ["--expire", "2027-01-15"],
      ["--bogus"],
      ["-x"],
      ["--repo"],
      ["--repo", "--rewrite"],
      ["--repo", "--notes"],
      ["-xyz"],
      ["--write"],
      ["--rewrite=yes"],
      ["note"],
    ];
    const problems = cases.map((args) => argumentProblem({ args, options }));
    expect(problems).toEqual([
      'This command has no option "--expire". Did you mean `--expires`?',
      'This command has no option "--bogus". It takes --repo, --expires, --rewrite and --help.',
      'This command has no option "-x". It takes --repo, --expires, --rewrite and --help.',
      'The option "--repo" needs a value.',
      'The option "--repo" needs a value.',
      'The option "--repo" needs a value. If the value is "--notes", write --repo=--notes.',
      'This command has no option "-xyz". It takes --repo, --expires, --rewrite and --help.',
      'This command has no option "--write". It takes --repo, --expires, --rewrite and --help.',
      'The option "--rewrite" takes no value.',
      'This command takes no arguments, but it got "note".',
    ]);
  });

  test("accepts valid arguments, and tells how to pass text that looks like an option", () => {
    const valid = argumentProblem({
      args: ["note", "--repo", "-", "--expires=-1", "-h", "--", "--bogus"],
      options,
      allowPositionals: true,
    });
    const text = argumentProblem({ args: ["--bogus"], options, allowPositionals: true });
    expect({ valid, text }).toEqual({
      valid: undefined,
      text: [
        'This command has no option "--bogus". It takes --repo, --expires, --rewrite and --help.',
        'If "--bogus" is not meant as an option, write -- before it.',
      ].join("\n"),
    });
  });
});
