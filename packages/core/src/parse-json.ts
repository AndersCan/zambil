function unsafeParseJson(text: string): unknown {
  return JSON.parse(text);
}

export function parseJson(text: string): unknown {
  try {
    return unsafeParseJson(text);
  } catch {
    return undefined;
  }
}
