import { describe, expect, test } from "vite-plus/test";
import { missingDependencyProblem, nodeVersionProblem } from "./startup-problem.ts";

describe("nodeVersionProblem", () => {
  test("names the version that zambil needs and the version that runs", () => {
    const problems = ["22.18.0", "24.0.0", "25.1.0"].map((version) => nodeVersionProblem(version));
    expect(problems).toEqual([
      "zambil needs Node 24 or later, and this is Node 22.18.0. Install Node 24 or later from https://nodejs.org, then run zambil again.\n",
      undefined,
      undefined,
    ]);
  });
});

describe("missingDependencyProblem", () => {
  test("explains a missing package and leaves other failures alone", () => {
    const missing = Object.assign(new Error("Cannot find package 'js-yaml'"), {
      code: "ERR_MODULE_NOT_FOUND",
    });
    const options = { root: "/home/user/zambil" };
    const problems = [missing, new Error("a bug"), "not an error"].map((error) =>
      missingDependencyProblem(error, options),
    );
    expect(problems).toEqual([
      [
        "zambil cannot start, because its dependencies are not installed in /home/user/zambil.",
        "Node says: Cannot find package 'js-yaml'",
        "",
        "If you installed zambil with the install script, run it again:",
        "",
        "  curl -fsSL https://raw.githubusercontent.com/AndersCan/zambil/main/install.sh | sh",
        "",
        "In a clone for development, run `pnpm install` in /home/user/zambil.",
        "",
      ].join("\n"),
      undefined,
      undefined,
    ]);
  });
});
