import { describe, it, expect, vi, afterEach } from 'vitest';
import { csvEscape, toCsv, downloadCsv, type CsvRow } from './csv';

describe('csv — CSV serialiser (G15 report export)', () => {
  describe('csvEscape', () => {
    it('leaves plain values untouched', () => {
      expect(csvEscape('Amoxicillin')).toBe('Amoxicillin');
      expect(csvEscape(42)).toBe('42');
    });

    it('renders null / undefined as empty string', () => {
      expect(csvEscape(null)).toBe('');
      expect(csvEscape(undefined)).toBe('');
    });

    it('quotes values containing a comma', () => {
      expect(csvEscape('Telma 40, Tab')).toBe('"Telma 40, Tab"');
    });

    it('quotes and doubles embedded double-quotes', () => {
      expect(csvEscape('Para "650" Tab')).toBe('"Para ""650"" Tab"');
    });

    it('quotes values containing newlines or carriage returns', () => {
      expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
      expect(csvEscape('a\r\nb')).toBe('"a\r\nb"');
    });
  });

  describe('toCsv', () => {
    it('returns an empty string for no rows', () => {
      expect(toCsv([])).toBe('');
    });

    it('takes headers from the first row and emits one line per row', () => {
      const rows: CsvRow[] = [
        { invoice: 'PH-1', total: 100 },
        { invoice: 'PH-2', total: 250 },
      ];
      expect(toCsv(rows)).toBe('invoice,total\nPH-1,100\nPH-2,250');
    });

    it('projects every row onto the first row keys (missing keys -> empty)', () => {
      const rows: CsvRow[] = [
        { drug: 'Amox', batch: 'B1' },
        { drug: 'Telma' }, // missing batch
      ];
      expect(toCsv(rows)).toBe('drug,batch\nAmox,B1\nTelma,');
    });

    it('escapes fields with commas/quotes so columns stay aligned', () => {
      const rows: CsvRow[] = [
        { vendor: 'Acme, Ltd', gstin: '29ABCDE1234F1Z5', note: 'said "ok"' },
      ];
      expect(toCsv(rows)).toBe(
        'vendor,gstin,note\n"Acme, Ltd",29ABCDE1234F1Z5,"said ""ok"""',
      );
    });

    it('serialises null/undefined cells as empty', () => {
      const rows: CsvRow[] = [{ a: null, b: undefined, c: 0 }];
      expect(toCsv(rows)).toBe('a,b,c\n,,0');
    });
  });

  describe('downloadCsv', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('builds a blob URL and clicks an anchor with the given filename', () => {
      let capturedBlob: Blob | undefined;
      const createUrl = vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:mock';
      });
      const revokeUrl = vi.fn();
      // jsdom does not implement these on URL
      (URL as unknown as { createObjectURL: unknown }).createObjectURL = createUrl;
      (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeUrl;

      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});

      downloadCsv('pharmacy-daily-2026-06-19.csv', [{ invoice: 'PH-1', total: 100 }]);

      expect(createUrl).toHaveBeenCalledTimes(1);
      // the blob passed in should carry the csv mime type
      expect(capturedBlob).toBeInstanceOf(Blob);
      expect(capturedBlob?.type).toContain('text/csv');
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeUrl).toHaveBeenCalledWith('blob:mock');
    });
  });
});
