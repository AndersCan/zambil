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
 * one stays valid for a shim or a link that a manager updates, such as Homebrew, asdf or Volta. A
 * folder that links straight to the folder of `node` lives only as long as one shell, as with fnm, so
 * it is left out.
 */
export async function nodeFolders(options: NodeFoldersOptions): Promise<string[]> {
  const node = findOnPath("node", options);
  if (node === undefined) return [];
  const folder = dirname(node);
  const [resolvedFolder, resolvedNode] = await Promise.all([
    wrap(realpath(folder)),
    wrap(realpath(node)),
  ]);
  if (!resolvedNode.ok) return [folder];
  const target = dirname(resolvedNode.value);
  const isShellLink = resolvedFolder.ok && resolvedFolder.value === target;
  if (isShellLink || target === folder) return [target];
  return [folder, target];
}
