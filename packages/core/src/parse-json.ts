function unsafeParseJson(text: string): unknown {
  return JSON.parse(text);
}

/** Parses JSON text, or gives `undefined` when the text is not JSON. */
export function parseJson(text: string): unknown {
  try {
    return unsafeParseJson(text);
  } catch {
    return undefined;
  }
}
