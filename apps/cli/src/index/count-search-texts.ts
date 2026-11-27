/** A count of the descriptions and triggers that search embeds, in words. */
export function countSearchTexts(count: number): string {
  return count === 1 ? "1 description or trigger" : `${count} descriptions and triggers`;
}
