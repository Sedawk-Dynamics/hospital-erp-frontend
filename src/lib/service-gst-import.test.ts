import { describe, it, expect } from 'vitest';
import { parseServiceGstGrid, SERVICE_GST_COLUMNS } from './service-gst-import';

describe('parseServiceGstGrid (#264)', () => {
  it('reads the template, keeping the row numbers the admin sees and skipping blank rows', () => {
    const out = parseServiceGstGrid([
      [...SERVICE_GST_COLUMNS],
      ['LAS', 'Laser therapy', '999722', 'taxable', '18%'],
      ['', '', '', '', ''],
      ['CON', 'Consultation', 999312, 'exempt', 0],
    ]);
    expect(out.error).toBeNull();
    expect(out.rows).toEqual([
      { rowNumber: 2, serviceCode: 'LAS', serviceName: 'Laser therapy', sacCode: '999722', treatment: 'taxable', gstPercent: '18%' },
      { rowNumber: 4, serviceCode: 'CON', serviceName: 'Consultation', sacCode: '999312', treatment: 'exempt', gstPercent: '0' },
    ]);
  });

  it('accepts other header spellings, any order, and a title above the header', () => {
    const out = parseServiceGstGrid([['My hospital'], ['GST', 'SAC code', 'Name', 'GST Treatment'], ['5', '996311', 'Room', 'Taxable']]);
    expect(out.rows[0]).toMatchObject({ rowNumber: 3, serviceName: 'Room', sacCode: '996311', treatment: 'Taxable', gstPercent: '5' });
  });

  it('names a missing column, a missing header and an empty file', () => {
    expect(parseServiceGstGrid([['Service name', 'SAC', 'GST %']]).error).toMatch(/Treatment/);
    expect(parseServiceGstGrid([['SAC', 'Treatment', 'GST %']]).error).toMatch(/Service code or Service name/);
    expect(parseServiceGstGrid([['hello']]).error).toMatch(/header row/);
    expect(parseServiceGstGrid([[...SERVICE_GST_COLUMNS]]).error).toMatch(/no services/);
  });
});
