import { describe, it, expect } from 'vitest';
import { parseCsvRows, parseRateList, RATE_LIST_HEADERS } from './gst-rate-list';

// Gap #262 — reading the rate list file.

describe('parseRateList', () => {
  it('reads the template', () => {
    const out = parseRateList(`${RATE_LIST_HEADERS.join(',')}\nD1,"Oldcillin, 500mg",3004,5%,22/09/2025\n\n,Oldmycin,,18,\n`);
    expect(out.error).toBeNull();
    expect(out.rows).toEqual([
      { rowNumber: 2, drugCode: 'D1', drugName: 'Oldcillin, 500mg', hsnCode: '3004', gstPercent: '5%', effectiveFrom: '22/09/2025' },
      { rowNumber: 4, drugCode: '', drugName: 'Oldmycin', hsnCode: '', gstPercent: '18', effectiveFrom: '' },
    ]);
  });

  it('reads a list in its own column order and spelling, and one pasted from a sheet', () => {
    const csv = parseRateList('﻿HSN Code,Medicine Name,GST Rate,W.E.F.\n3004,Dolo,5,01/04/2026');
    expect(csv.rows[0]).toMatchObject({ hsnCode: '3004', drugName: 'Dolo', gstPercent: '5', effectiveFrom: '01/04/2026' });
    const tsv = parseRateList('Item Code\tItem Name\tGST (%)\r\n890\tDolo, 650\t5\r\n');
    expect(tsv.rows[0]).toMatchObject({ drugCode: '890', drugName: 'Dolo, 650', gstPercent: '5' });
  });

  it('says why a file cannot be read', () => {
    expect(parseRateList('').error).toMatch(/empty/);
    expect(parseRateList('Drug name,HSN\nDolo,3004').error).toMatch(/No "GST %" column/);
    expect(parseRateList('GST %,Remarks\n5,x').error).toMatch(/No drug code, drug name or HSN/);
    expect(parseRateList(RATE_LIST_HEADERS.join(',')).error).toMatch(/no rows/);
  });

  it('keeps quotes and newlines inside a field', () => {
    expect(parseCsvRows('a,"b ""c""\nd",e')).toEqual([['a', 'b "c"\nd', 'e']]);
  });
});
