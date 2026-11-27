// Gap 369: the lab catalogue import file. One row per parameter; a test with no
// parameters takes one row. Parsing only: every check is made on the server.

export interface LabImportRow {
  rowNumber: number;
  testCode?: string | null;
  testName?: string | null;
  sampleType?: string | null;
  specimen?: string | null;
  instructions?: string | null;
  description?: string | null;
  turnaroundHours?: string | null;
  price?: string | null;
  aliases?: string | null;
  parameterName?: string | null;
  parameterUnit?: string | null;
  refLow?: string | null;
  refHigh?: string | null;
  refText?: string | null;
  group?: string | null;
}

type Field = Exclude<keyof LabImportRow, 'rowNumber'>;

export const LAB_IMPORT_COLUMNS: ReadonlyArray<{ field: Field; header: string }> = [
  { field: 'testCode', header: 'Test code' },
  { field: 'testName', header: 'Test name' },
  { field: 'sampleType', header: 'Sample type' },
  { field: 'specimen', header: 'Specimen' },
  { field: 'instructions', header: 'Patient instructions' },
  { field: 'description', header: 'Description' },
  { field: 'turnaroundHours', header: 'Turnaround hours' },
  { field: 'price', header: 'Price' },
  { field: 'aliases', header: 'Other names' },
  { field: 'parameterName', header: 'Parameter' },
  { field: 'parameterUnit', header: 'Unit' },
  { field: 'refLow', header: 'Range low' },
  { field: 'refHigh', header: 'Range high' },
  { field: 'refText', header: 'Range text' },
  { field: 'group', header: 'Parameter group' },
];

const headerKey = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z]+/g, '');

export const LAB_IMPORT_MAX_ROWS = 2000;

/** Template rows: the header, and two lines showing one test with two parameters. */
export function labImportTemplate(): string[][] {
  const line = (values: Partial<Record<Field, string>>) =>
    LAB_IMPORT_COLUMNS.map((c) => values[c.field] ?? '');
  return [
    LAB_IMPORT_COLUMNS.map((c) => c.header),
    line({
      testCode: 'EXAMPLE',
      testName: 'Example panel (delete these two rows)',
      sampleType: 'Blood',
      turnaroundHours: '4',
      parameterName: 'First parameter',
      parameterUnit: 'mg/dL',
    }),
    line({
      testCode: 'EXAMPLE',
      testName: 'Example panel (delete these two rows)',
      parameterName: 'Second parameter',
      parameterUnit: 'mg/dL',
    }),
  ];
}

/** Turn a sheet (array of rows) into import rows, or say why it cannot be read. */
export function parseLabImportGrid(grid: unknown[][]): { rows: LabImportRow[]; error: string | null } {
  const headerAt = grid.findIndex((r) => r.some((c) => headerKey(c) === 'testname'));
  if (headerAt < 0) return { rows: [], error: 'No "Test name" column found. Use the template.' };

  const index = new Map<Field, number>();
  grid[headerAt].forEach((cell, i) => {
    const col = LAB_IMPORT_COLUMNS.find((c) => headerKey(c.header) === headerKey(cell));
    if (col && !index.has(col.field)) index.set(col.field, i);
  });

  const rows: LabImportRow[] = [];
  for (let i = headerAt + 1; i < grid.length; i += 1) {
    const raw = grid[i] ?? [];
    const row: LabImportRow = { rowNumber: i + 1 };
    let filled = false;
    for (const [field, at] of index) {
      const v = String(raw[at] ?? '').trim();
      if (v) {
        row[field] = v;
        filled = true;
      }
    }
    if (!filled || (row.testCode === 'EXAMPLE' && row.testName?.startsWith('Example panel'))) continue;
    rows.push(row);
  }
  if (rows.length === 0) return { rows, error: 'The file has no tests in it.' };
  if (rows.length > LAB_IMPORT_MAX_ROWS) {
    return { rows: [], error: `Import at most ${LAB_IMPORT_MAX_ROWS.toLocaleString('en-IN')} rows at a time.` };
  }
  return { rows, error: null };
}
