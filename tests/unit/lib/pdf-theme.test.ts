import { describe, it, expect } from 'vitest';
import {
  buildHtmlTheme,
  fontStack,
  lineHeightFor,
  pageDimensions,
  tableRowHeight,
  tintHex,
  DEFAULT_ACCENT,
  DEFAULT_PDF_TEMPLATE,
} from '@/lib/pdf-theme';
import type { PdfTemplate } from '@/hooks/use-hospital-branding';

// ============================================================
// These derivations are the frontend half of a pair. The other half is
// `backend/src/services/pdf-doc.ts:buildTheme` plus `pdf-template.ts`
// (tableRowHeight / pageDimensions) and `pdf-branding.ts:tintHex`.
//
// The two repos are separate, so the maths cannot be imported — it is copied.
// The numbers below are taken from the server's implementation, so if either
// side is edited alone this fails rather than the bill quietly printing at a
// different size or in a different shade than the PDF of the same stay.
// ============================================================

const tpl = (over: Partial<PdfTemplate> = {}): PdfTemplate => ({ ...DEFAULT_PDF_TEMPLATE, ...over });

describe('tintHex', () => {
  it('mixes towards white by the given amount', () => {
    // Values produced by the server's own tintHex, not computed by hand —
    // these are the exact fills the PDF paints for zebra rows and card
    // backgrounds, and the print view has to land on the same ones.
    expect(tintHex('#7c3aed', 0.9)).toBe('#f2ebfd');
    expect(tintHex('#0f766e', 0.9)).toBe('#e7f1f1');
    expect(tintHex('#0f766e', 0.6)).toBe('#9fc8c5');
    expect(tintHex('#000000', 0.5)).toBe('#808080');
    expect(tintHex('#ffffff', 0.9)).toBe('#ffffff');
  });

  it('passes anything that is not a 6-digit hex straight through', () => {
    expect(tintHex('rebeccapurple', 0.9)).toBe('rebeccapurple');
  });
});

describe('pageDimensions', () => {
  it('returns the page in points and flips it for landscape', () => {
    expect(pageDimensions({ size: 'A4', orientation: 'portrait', margin: 42 })).toEqual({
      width: 595.28,
      height: 841.89,
    });
    expect(pageDimensions({ size: 'A4', orientation: 'landscape', margin: 42 })).toEqual({
      width: 841.89,
      height: 595.28,
    });
    expect(pageDimensions({ size: 'LETTER', orientation: 'portrait', margin: 42 })).toEqual({
      width: 612,
      height: 792,
    });
  });
});

describe('tableRowHeight', () => {
  it('pads the body size by the density', () => {
    const at = (density: PdfTemplate['table']['density'], baseFontSize: number) =>
      tableRowHeight(
        tpl({
          typography: { fontFamily: 'Helvetica', baseFontSize, lineGap: 2 },
          table: { ...DEFAULT_PDF_TEMPLATE.table, density },
        }),
      );
    expect(at('compact', 9)).toBe(14);
    expect(at('normal', 9)).toBe(16.5);
    expect(at('comfortable', 9)).toBe(20);
    expect(at('normal', 11)).toBe(18.5);
  });
});

describe('fontStack', () => {
  it('maps each PDFKit family to a matching CSS stack', () => {
    expect(fontStack('Helvetica')).toContain('Helvetica');
    expect(fontStack('Times')).toContain('Times');
    expect(fontStack('Courier')).toContain('Courier');
  });
});

describe('buildHtmlTheme', () => {
  it('resolves the accent template first, then branding, then the default', () => {
    const branded = { accentColor: '#123456' };
    expect(buildHtmlTheme(tpl({ colors: { accent: '#abcdef', ink: '#111', muted: '#222' } }), branded).accent)
      .toBe('#abcdef');
    expect(buildHtmlTheme(tpl(), branded).accent).toBe('#123456');
    expect(buildHtmlTheme(tpl(), null).accent).toBe(DEFAULT_ACCENT);
  });

  it('ignores a colour that is not a 6-digit hex', () => {
    // The value comes out of a JSON column, so it is not to be trusted.
    expect(buildHtmlTheme(tpl(), { accentColor: 'teal' }).accent).toBe(DEFAULT_ACCENT);
    expect(buildHtmlTheme(tpl({ colors: { accent: 'red', ink: '#1a2332', muted: '#5b6472' } }), null).accent)
      .toBe(DEFAULT_ACCENT);
  });

  it('derives the size scale the way the server does', () => {
    const t = buildHtmlTheme(
      tpl({ typography: { fontFamily: 'Helvetica', baseFontSize: 9, lineGap: 2 } }),
      null,
    );
    expect(t.size).toEqual({ body: 9, small: 8, tiny: 7, heading: 10.5, title: 11.5 });
  });

  it('floors the small sizes so a tiny body size stays legible', () => {
    const t = buildHtmlTheme(
      tpl({ typography: { fontFamily: 'Helvetica', baseFontSize: 6, lineGap: 0 } }),
      null,
    );
    expect(t.size.small).toBe(6);
    expect(t.size.tiny).toBe(5.5);
  });

  it('computes the printable width from the page and its margins', () => {
    const t = buildHtmlTheme(tpl({ page: { size: 'A4', orientation: 'portrait', margin: 42 } }), null);
    expect(t.contentWidth).toBeCloseTo(595.28 - 84, 2);
  });

  it('exposes the accent tints the card fills and rules use', () => {
    const t = buildHtmlTheme(tpl(), { accentColor: '#0f766e' });
    expect(t.soft).toBe(tintHex('#0f766e', 0.9));
    expect(t.softBorder).toBe(tintHex('#0f766e', 0.6));
  });
});

describe('lineHeightFor', () => {
  it('turns the PDF line gap into a CSS multiplier', () => {
    const t = buildHtmlTheme(
      tpl({ typography: { fontFamily: 'Helvetica', baseFontSize: 10, lineGap: 5 } }),
      null,
    );
    expect(lineHeightFor(t)).toBe(1.5);
  });
});
