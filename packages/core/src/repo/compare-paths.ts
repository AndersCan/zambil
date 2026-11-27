/** The path to compare against. */
export interface ComparePathsOptions {
  other: string;
}

/** Orders repo paths by code point, the same on every machine, unlike a locale order. */
export function comparePaths(path: string, options: ComparePathsOptions): number {
  if (path === options.other) return 0;
  return path < options.other ? -1 : 1;
}
