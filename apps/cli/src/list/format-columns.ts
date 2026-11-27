/** Lays out rows as columns separated by two spaces. The last column is not padded. */
export function formatColumns(rows: string[][]): string {
  const widths: number[] = [];
  for (const row of rows) {
    for (const [column, cell] of row.entries()) {
      widths[column] = Math.max(widths[column] ?? 0, cell.length);
    }
  }
  const lines: string[] = [];
  for (const row of rows) {
    const cells: string[] = [];
    for (const [column, cell] of row.entries()) {
      const isLast = column === row.length - 1;
      cells.push(isLast ? cell : cell.padEnd(widths[column] ?? 0));
    }
    lines.push(cells.join("  ").trimEnd());
  }
  return lines.join("\n");
}
