import { dirname, join } from "node:path";
import { stat } from "node:fs/promises";
import { wrap } from "@zambil/core/either";

function foldersUp(folder: string): string[] {
  const folders = [folder];
  let current = folder;
  while (dirname(current) !== current) {
    current = dirname(current);
    folders.push(current);
  }
  return folders;
}

/**
 * The Obsidian vault that holds the folder: the folder itself or the nearest folder above it with an
 * `.obsidian` folder. It is `undefined` when no folder on the way up is a vault.
 */
export async function findObsidianVault(folder: string): Promise<string | undefined> {
  const folders = foldersUp(folder);
  const states = await Promise.all(folders.map((path) => wrap(stat(join(path, ".obsidian")))));
  for (const [position, state] of states.entries()) {
    if (state.ok && state.value.isDirectory()) return folders[position];
  }
  return undefined;
}
