/** The words that a mistyped word can be. */
export interface ClosestMatchOptions {
  candidates: Iterable<string>;
}

interface DistanceOptions {
  to: string;
}

function editDistance(first: string, options: DistanceOptions): number {
  const second = options.to;
  let previous = Array.from({ length: second.length + 1 }, (_, position) => position);
  for (const [row, firstCharacter] of first.split("").entries()) {
    const current = [row + 1];
    for (const [column, secondCharacter] of second.split("").entries()) {
      const substitution = (previous[column] ?? 0) + (firstCharacter === secondCharacter ? 0 : 1);
      const insertion = (current[column] ?? 0) + 1;
      const deletion = (previous[column + 1] ?? 0) + 1;
      current.push(Math.min(substitution, insertion, deletion));
    }
    previous = current;
  }
  return previous[second.length] ?? 0;
}

/**
 * The candidate that the word most likely is a typo of, without regard to case. A short word allows one
 * wrong character, and each three characters more allow one more. No close candidate is `undefined`.
 */
export function closestMatch(word: string, options: ClosestMatchOptions): string | undefined {
  const typed = word.toLowerCase();
  const allowed = Math.max(1, Math.floor(typed.length / 3));
  let best: { candidate: string; distance: number } | undefined;
  for (const candidate of options.candidates) {
    const distance = editDistance(typed, { to: candidate.toLowerCase() });
    const isCloser = best === undefined || distance < best.distance;
    if (distance <= allowed && isCloser) best = { candidate, distance };
  }
  return best?.candidate;
}
