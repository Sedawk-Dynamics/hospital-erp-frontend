import { describe, it, expect } from 'vitest';
import { billDialogMaxWidth } from './bill-print-dialog';
import { DEFAULT_PDF_TEMPLATE } from '@/lib/pdf-theme';
import type { PdfTemplate } from '@/hooks/use-hospital-branding';

// The preview dialog has to be as wide as the paper it is previewing, or the
// document is squeezed and stops being a true preview of what will print.
//
// It used to carry `max-w-4xl`, which never applied: DialogContent's own
// `sm:max-w-lg` is a responsive variant, so it beats a plain `max-w-*` from a
// caller and twMerge keeps both (different variants). The box sat at 512px
// while the A4 page inside it overflowed at 794px, with nothing to show for it
// in the class list. Hence a computed width, and hence this test.

const withPage = (page: PdfTemplate['page']): PdfTemplate => ({ ...DEFAULT_PDF_TEMPLATE, page });

/** The px value inside `min(calc(100vw - 2rem), Npx)`. */
function pxCap(value: string): number {
  const m = /,\s*(\d+)px\)/.exec(value);
  if (!m) throw new Error(`no px cap in ${value}`);
  return Number(m[1]);
}

describe('billDialogMaxWidth', () => {
  it('fits an A4 portrait page at its true size', () => {
    // 595.28pt = 793.71px of paper, plus the dialog's padding and scrollbar.
    const cap = pxCap(billDialogMaxWidth(DEFAULT_PDF_TEMPLATE));
    expect(cap).toBeGreaterThanOrEqual(794 + 32);
    expect(cap).toBe(850);
  });

  it('grows for a landscape template', () => {
    const cap = pxCap(billDialogMaxWidth(withPage({ size: 'A4', orientation: 'landscape', margin: 42 })));
    // 841.89pt = 1122.52px.
    expect(cap).toBeGreaterThanOrEqual(1123 + 32);
  });

  it('shrinks for a smaller page rather than leaving dead space', () => {
    const a5 = pxCap(billDialogMaxWidth(withPage({ size: 'A5', orientation: 'portrait', margin: 42 })));
    const a4 = pxCap(billDialogMaxWidth(DEFAULT_PDF_TEMPLATE));
    expect(a5).toBeLessThan(a4);
  });

  it('is capped to the window so a wide page cannot overflow it', () => {
    expect(billDialogMaxWidth(withPage({ size: 'LEGAL', orientation: 'landscape', margin: 42 })))
      .toMatch(/^min\(calc\(100vw - 2rem\), \d+px\)$/);
  });

  it('falls back to the default page when no template has arrived yet', () => {
    // The dialog renders once before the document loads.
    expect(billDialogMaxWidth(null)).toBe(billDialogMaxWidth(DEFAULT_PDF_TEMPLATE));
    expect(billDialogMaxWidth(undefined)).toBe(billDialogMaxWidth(DEFAULT_PDF_TEMPLATE));
  });
});
