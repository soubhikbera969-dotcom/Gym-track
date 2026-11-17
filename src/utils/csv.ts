/**
 * Neutralizes spreadsheet formula injection (=, +, -, @, tab, CR)
 * and safely quotes RFC 4180 CSV cells.
 */
export function toSafeCsvCell(rawValue: unknown): string {
  const str = String(rawValue ?? '');
  const trimmedStart = str.replace(/^\s+/, '');
  const safe =
    /^[=+\-@\t\r]/.test(trimmedStart) ? `'${str}` : str;
  const escaped = safe.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildSafeCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map((h) => toSafeCsvCell(h)).join(',');
  const bodyLines = rows.map((row) => row.map((cell) => toSafeCsvCell(cell)).join(','));
  return [headerLine, ...bodyLines].join('\n');
}
