/** The `zambil` program and the `--repo` folder that a hook command line runs, as the shell reads them. */
export interface HookCommandPaths {
  zambilPath?: string;
  repoRoot?: string;
}

/** One unquoted run, one quoted run or one escaped character. A word is one or more of them. */
const piece = String.raw`[^\s'"\\]+|'[^']*'|"(?:[^"\\]|\\.)*"|\\.`;
const wordPattern = new RegExp(`(?:${piece})+`, "gu");
const piecePattern = new RegExp(piece, "gu");

function unquote(text: string): string {
  if (text.startsWith("'")) return text.slice(1, -1);
  if (text.startsWith('"')) return text.slice(1, -1).replaceAll(/\\(.)/gu, "$1");
  if (text.startsWith("\\")) return text.slice(1);
  return text;
}

/** Splits a command line into words the way a POSIX shell reads quotes and backslashes. */
function shellWords(command: string): string[] {
  const words: string[] = [];
  for (const [word] of command.matchAll(wordPattern)) {
    let text = "";
    for (const [part] of word.matchAll(piecePattern)) text += unquote(part);
    words.push(text);
  }
  return words;
}

/** Reads the program before `hook` and the folder after `--repo` from a zambil hook command line. */
export function parseHookCommand(command: string): HookCommandPaths {
  const words = shellWords(command);
  const hook = words.indexOf("hook");
  const paths: HookCommandPaths = {};
  const zambilPath = words[hook - 1];
  if (hook > 0 && zambilPath !== undefined) paths.zambilPath = zambilPath;
  const repo = words.indexOf("--repo", hook);
  const repoRoot = words[repo + 1];
  if (repo !== -1 && repoRoot !== undefined) paths.repoRoot = repoRoot;
  return paths;
}
