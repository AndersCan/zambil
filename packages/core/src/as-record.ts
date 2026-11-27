/** Untyped input, such as parsed JSON or a foreign AST, as an object to read keys off, or `undefined` when it is none. */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  const isPlainObject = typeof value === "object" && value !== null && !Array.isArray(value);
  if (!isPlainObject) return undefined;
  return Object(value);
}
