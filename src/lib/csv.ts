/**
 * Minimal, dependency-free CSV serialiser + browser download.
 *
 * Used by the pharmacy statutory reports (G15) so a pharmacist can file the
 * mandatory end-of-day report and hand the Drug-Inspector register to an
 * inspector. RFC-4180 style quoting: a field is wrapped in double quotes when
 * it contains a comma, double quote, or newline, and embedded quotes are
 * doubled.
 */

export type CsvRow = Record<string, unknown>;

/** Quote a single CSV field when it contains a delimiter, quote, or newline. */
export function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Serialise an array of row objects to a CSV string. Column headers are taken
 * from the keys of the first row, and every row is projected onto those keys
 * (missing keys serialise as empty). Returns '' for an empty array.
 */
export function toCsv(rows: CsvRow[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')),
  ];
  return lines.join('\n');
}

/**
 * Trigger a browser download of the given rows as a CSV file. No-ops in a
 * non-browser environment (guards against SSR/test runners without a DOM).
 */
export function downloadCsv(filename: string, rows: CsvRow[]): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    return;
  }
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
