import { describe, expect, test } from "vite-plus/test";
import { linkHint } from "./link-hint.ts";

const environment = { home: "/home/ada", workingFolder: "/home/ada" };

describe("linkHint", () => {
  test("tells how to put ~/.local/bin on the PATH only when it is not there", () => {
    const missing = linkHint({ environment, searchPath: ["/usr/bin"] }, { command: "zambil init" });
    const present = linkHint(
      { environment, searchPath: ["/usr/bin", "/home/ada/.local/bin/"] },
      { command: "zambil init" },
    );
    expect({
      missing: missing.split("\n").slice(2),
      present: present.split("\n").slice(2),
    }).toEqual({
      missing: [
        expect.stringMatching(
          /^ {2}mkdir -p ~\/\.local\/bin && ln -sf .*main\.ts ~\/\.local\/bin\/zambil$/,
        ),
        "",
        "~/.local/bin is not on your PATH. Add this line to the profile of your shell, ~/.zshrc for zsh or ~/.bashrc for bash, then open a new terminal:",
        "",
        '  export PATH="$HOME/.local/bin:$PATH"',
      ],
      present: [expect.stringMatching(/^ {2}mkdir -p ~\/\.local\/bin && ln -sf /)],
    });
  });
});
