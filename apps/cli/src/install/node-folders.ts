import { dirname } from "node:path";
import { findOnPath } from "./find-on-path.ts";
import { realpath } from "node:fs/promises";
import { wrap } from "@zambil/core/either";

/** The folders of `PATH`, in order. */
export interface NodeFoldersOptions {
  searchPath: string[];
}

/**
 * The folder of the `node` on the `PATH`, then the folder of the file that it links to. The first
 * one stays valid for a shim or a link that a manager updates, such as Homebrew, mise, asdf or Volta.
 * The second one stays valid for a link that lives only as long as one shell, such as fnm.
 */
export async function nodeFolders(options: NodeFoldersOptions): Promise<string[]> {
  const node = findOnPath("node", options);
  if (node === undefined) return [];
  const folders = [dirname(node)];
  const resolved = await wrap(realpath(node));
  if (!resolved.ok) return folders;
  const target = dirname(resolved.value);
  if (!folders.includes(target)) folders.push(target);
  return folders;
}
