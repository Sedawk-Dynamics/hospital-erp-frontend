// #264: the hospital's services list as a spreadsheet — SAC, treatment, GST %.
// Reading the sheet only; every rule is checked on the server.

export const SERVICE_GST_COLUMNS = ['Service code', 'Service name', 'SAC', 'Treatment', 'GST %'] as const;

export interface ServiceGstImportRow {
  /** The row number the admin sees in the spreadsheet. */
  rowNumber: number;
  serviceCode: string;
  serviceName: string;
  sacCode: string;
  treatment: string;
  gstPercent: string;
}

type Field = Exclude<keyof ServiceGstImportRow, 'rowNumber'>;

const HEADERS: Record<string, Field> = {
  'service code': 'serviceCode',
  code: 'serviceCode',
  'service name': 'serviceName',
  service: 'serviceName',
  name: 'serviceName',
  sac: 'sacCode',
  'sac code': 'sacCode',
  treatment: 'treatment',
  'gst treatment': 'treatment',
  'gst %': 'gstPercent',
  'gst%': 'gstPercent',
  gst: 'gstPercent',
  'gst rate': 'gstPercent',
  'gst percent': 'gstPercent',
};

const text = (v: unknown) => String(v ?? '').trim();

/** Turn a sheet (as displayed text) into rows. Blank rows are skipped, not errors. */
export function parseServiceGstGrid(grid: unknown[][]): { rows: ServiceGstImportRow[]; error: string | null } {
  const headerAt = grid.findIndex((r) => r.some((c) => HEADERS[text(c).toLowerCase()]));
  if (headerAt < 0) {
    return { rows: [], error: `The file needs a header row: ${SERVICE_GST_COLUMNS.join(', ')}` };
  }
  const columns = grid[headerAt]!.map((c) => HEADERS[text(c).toLowerCase()]);
  const missing = (['sacCode', 'treatment', 'gstPercent'] as Field[]).filter((f) => !columns.includes(f));
  if (!columns.includes('serviceCode') && !columns.includes('serviceName')) missing.unshift('serviceName');
  if (missing.length) {
    const label: Record<Field, string> = { serviceCode: 'Service code', serviceName: 'Service code or Service name', sacCode: 'SAC', treatment: 'Treatment', gstPercent: 'GST %' };
    return { rows: [], error: `Missing column(s): ${missing.map((m) => label[m]).join(', ')}` };
  }
  const rows: ServiceGstImportRow[] = [];
  grid.slice(headerAt + 1).forEach((cells, i) => {
    if (!cells.some((c) => text(c))) return;
    const row: ServiceGstImportRow = { rowNumber: headerAt + i + 2, serviceCode: '', serviceName: '', sacCode: '', treatment: '', gstPercent: '' };
    columns.forEach((field, c) => {
      if (field) row[field] = text(cells[c]);
    });
    rows.push(row);
  });
  return rows.length ? { rows, error: null } : { rows: [], error: 'The file has no services under its header row' };
}
