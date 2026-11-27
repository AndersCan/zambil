const linkPattern = /^\[\[(?<target>[^\]|#^]*)[^\]]*\]\]$/;

/**
 * The note name that a link or a plain name points to: `[[ops/deploy.md#Steps|deploy it]]` and
 * `deploy` both give `deploy`. The folder, the heading, the display text and `.md` are dropped.
 */
export function parseLinkTarget(text: string): string {
  const target = linkPattern.exec(text.trim())?.groups?.target ?? text;
  const name = target.split("/").at(-1) ?? target;
  return name.replace(/\.md$/i, "").trim();
}
