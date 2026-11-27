import { describe, expect, test } from "vite-plus/test";
import { findRecalls } from "./find-recalls.ts";

describe("findRecalls", () => {
  test("finds plain names, names with spaces, parts of notes and names at the end of a sentence", () => {
    const prompt =
      'z:deploy then (z:release), z:[[on call rota]] and z:deploy#Steps. Again: z:Deploy? z:\n"z:[[q\'s]]"';
    expect(findRecalls(prompt)).toEqual([
      { typed: "z:deploy", target: "deploy" },
      { typed: "z:release", target: "release" },
      { typed: "z:[[on call rota]]", target: "on call rota" },
      { typed: "z:deploy#Steps", target: "deploy#Steps" },
      { typed: "z:[[q's]]", target: "q's" },
    ]);
  });

  test("skips z: in code and z: that follows a letter", () => {
    const prompt = "The syntax is `z:name`.\n```\nz:inside\n```\nxyz:abc https://z:foo@host";
    expect(findRecalls(prompt)).toEqual([]);
  });
});
