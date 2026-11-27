// Gap #262 — reading the client's medicine GST rate list.
//
// The template is a CSV (Excel opens and saves it). Headings are matched by
// name, in any order and with the usual spellings, so a list that arrives with
// its own column order still reads. Nothing is validated here: the server
// checks every row and says what is wrong with it.

export const RATE_LIST_HEADERS = ['Drug code', 'Drug name', 'HSN', 'GST %', 'Effective from'] as const;

export interface RateListInputRow {
  rowNumber: number;
  drugCode: string;
  drugName: string;
  hsnCode: string;
  gstPercent: string;
  effectiveFrom: string;
}

type Field = Exclude<keyof RateListInputRow, 'rowNumber'>;

const HEADER_FIELDS: Array<[RegExp, Field]> = [
  [/^(drug|item|medicine|product)?\s*(code|id|gtin|ean|barcode)$/, 'drugCode'],
  [/^(drug|item|medicine|product|brand)?\s*name$|^(drug|item|medicine|product|description)$/, 'drugName'],
  [/^hsn(\s*(code|\/sac|no\.?))?$/, 'hsnCode'],
  [/^(new\s*)?(gst|tax)\s*(%|rate|percent(age)?|rate\s*%)?\s*(\(%\))?$|^rate(\s*%)?$/, 'gstPercent'],
  [/^(effective|valid)?\s*(from|date)$|^effective(\s*from)?(\s*date)?$|^w\.?e\.?f\.?$/, 'effectiveFrom'],
];

/** RFC 4180 rows: quoted fields, embedded commas, quotes and newlines. */
export function parseCsvRows(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  // A list pasted from a spreadsheet is tab-separated.
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export interface ParsedRateList {
  rows: RateListInputRow[];
  /** Why the file could not be read at all; null when it was. */
  error: string | null;
}

export function parseRateList(text: string): ParsedRateList {
  const raw = parseCsvRows(text);
  const headerAt = raw.findIndex((r) => r.some((c) => c.trim() !== ''));
  if (headerAt < 0) return { rows: [], error: 'The file is empty.' };
  const header = raw[headerAt].map((h) => h.trim().toLowerCase().replace(/\s+/g, ' '));
  const at = new Map<Field, number>();
  header.forEach((h, i) => {
    const hit = HEADER_FIELDS.find(([re, f]) => re.test(h) && !at.has(f));
    if (hit) at.set(hit[1], i);
  });
  if (!at.has('gstPercent')) {
    return { rows: [], error: `No "GST %" column found. Use the template headings: ${RATE_LIST_HEADERS.join(', ')}.` };
  }
  if (!at.has('drugCode') && !at.has('drugName') && !at.has('hsnCode')) {
    return { rows: [], error: 'No drug code, drug name or HSN column found. Use the template headings.' };
  }
  const cell = (r: string[], f: Field) => (at.has(f) ? (r[at.get(f)!] ?? '').trim() : '');
  const rows: RateListInputRow[] = [];
  raw.forEach((r, i) => {
    if (i <= headerAt || r.every((c) => c.trim() === '')) return;
    rows.push({
      // As the spreadsheet numbers it, so a message can be found in the file.
      rowNumber: i + 1,
      drugCode: cell(r, 'drugCode'),
      drugName: cell(r, 'drugName'),
      hsnCode: cell(r, 'hsnCode'),
      gstPercent: cell(r, 'gstPercent'),
      effectiveFrom: cell(r, 'effectiveFrom'),
    });
  });
  return rows.length ? { rows, error: null } : { rows: [], error: 'The file has headings but no rows.' };
}
