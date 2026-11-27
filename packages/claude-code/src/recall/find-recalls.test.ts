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

  test("ends a plain name at a comma, a possessive or Markdown emphasis", () => {
    const prompt = "z:deploy,z:old then follow z:release's steps and **z:backup**, z:[[unclosed";
    expect(findRecalls(prompt)).toEqual([
      { typed: "z:deploy", target: "deploy" },
      { typed: "z:old", target: "old" },
      { typed: "z:release", target: "release" },
      { typed: "z:backup", target: "backup" },
    ]);
  });

  test("skips z: in code and z: that follows a letter", () => {
    const prompt = "The syntax is `z:name`.\n```\nz:inside\n```\nxyz:abc https://z:foo@host";
    expect(findRecalls(prompt)).toEqual([]);
  });
});
