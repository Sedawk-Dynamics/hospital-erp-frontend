import type { HospitalBranding, PdfTemplate } from '@/hooks/use-hospital-branding';

// ============================================================
// The PDF Builder's settings, resolved for rendering in HTML.
//
// A document type's look is defined once, in the PDF Builder, and stored on the
// tenant. The server renders it with PDFKit; the print view in the browser has
// to render the SAME definition, or the bill on screen and the bill that comes
// out of the PDF button are two different documents.
//
// This mirrors `backend/src/services/pdf-doc.ts:buildTheme` and the helpers in
// `pdf-template.ts`. The derivations are duplicated rather than shared because
// the two repos are separate — so they are kept deliberately small and literal,
// and pinned by tests on both sides.
//
// ── Units ───────────────────────────────────────────────────────────────────
// Everything here is in POINTS, and the print view sets CSS in `pt`. PDFKit
// works in points and 1pt is 1/72in in CSS too, so a 9pt heading in the PDF and
// a 9pt heading in the print view are the same physical size on the paper.
// Using px would have made the HTML render ~1.33x larger than the PDF.
// ============================================================

export const DEFAULT_ACCENT = '#0f766e';
export const DEFAULT_INK = '#1a2332';
export const DEFAULT_MUTED = '#5b6472';
export const HAIRLINE = '#d3d8de';

/** Mix a colour towards white. `amount` 0..1 — 0.9 is a very light tint. */
export function tintHex(hex: string, amount: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const to2 = (c: number) => c.toString(16).padStart(2, '0');
  return `#${to2(mix(r))}${to2(mix(g))}${to2(mix(b))}`;
}

const isHex = (v: string | null | undefined): v is string => !!v && /^#[0-9a-fA-F]{6}$/.test(v);

/** Page size in points, portrait-normalised then flipped for landscape. */
const PAGE_DIMS: Record<PdfTemplate['page']['size'], [number, number]> = {
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  LETTER: [612, 792],
  LEGAL: [612, 1008],
};

export function pageDimensions(page: PdfTemplate['page']): { width: number; height: number } {
  const [w, h] = PAGE_DIMS[page.size] ?? PAGE_DIMS.A4;
  return page.orientation === 'landscape' ? { width: h, height: w } : { width: w, height: h };
}

/**
 * CSS font stacks for the three families PDFKit ships as standard. The browser
 * cannot use PDFKit's built-ins, so each maps to the closest metric-compatible
 * stack — Helvetica/Arial, Times/Georgia-class serif, Courier monospace.
 */
export function fontStack(family: PdfTemplate['typography']['fontFamily']): string {
  if (family === 'Times') return 'Times, "Times New Roman", Georgia, serif';
  if (family === 'Courier') return '"Courier New", Courier, ui-monospace, monospace';
  return 'Helvetica, Arial, "Helvetica Neue", ui-sans-serif, sans-serif';
}

/** Row height for a table at the template's density. */
export function tableRowHeight(t: PdfTemplate): number {
  const base = t.typography.baseFontSize;
  const pad = t.table.density === 'compact' ? 5 : t.table.density === 'comfortable' ? 11 : 7.5;
  return Math.round((base + pad) * 10) / 10;
}

export interface PdfHtmlTheme {
  /** Page margin, points. */
  margin: number;
  /** Printable width inside the margins, points. */
  contentWidth: number;
  page: { width: number; height: number };
  accent: string;
  ink: string;
  muted: string;
  /** Very light accent tint — card fills, zebra rows, meta strip. */
  soft: string;
  /** Mid accent tint — card and meta-strip borders. */
  softBorder: string;
  hairline: string;
  fontFamily: string;
  size: { body: number; small: number; tiny: number; heading: number; title: number };
  lineGap: number;
  rowHeight: number;
  template: PdfTemplate;
}

/**
 * Resolve a template + letterhead into the values the print view draws with.
 *
 * The accent falls back the same way the server does: the template's own accent
 * wins, then the hospital's brand colour, then the product default. A hospital
 * that has never opened the builder still gets its brand colour.
 */
export function buildHtmlTheme(
  template: PdfTemplate,
  branding: Pick<HospitalBranding, 'accentColor'> | null | undefined,
): PdfHtmlTheme {
  const accent = isHex(template.colors.accent)
    ? template.colors.accent
    : isHex(branding?.accentColor)
      ? branding.accentColor
      : DEFAULT_ACCENT;
  const body = template.typography.baseFontSize;
  const page = pageDimensions(template.page);
  return {
    margin: template.page.margin,
    contentWidth: page.width - template.page.margin * 2,
    page,
    accent,
    ink: isHex(template.colors.ink) ? template.colors.ink : DEFAULT_INK,
    muted: isHex(template.colors.muted) ? template.colors.muted : DEFAULT_MUTED,
    soft: tintHex(accent, 0.9),
    softBorder: tintHex(accent, 0.6),
    hairline: HAIRLINE,
    fontFamily: fontStack(template.typography.fontFamily),
    size: {
      body,
      small: Math.max(6, body - 1),
      tiny: Math.max(5.5, body - 2),
      heading: body + 1.5,
      title: body + 2.5,
    },
    lineGap: template.typography.lineGap,
    rowHeight: tableRowHeight(template),
    template,
  };
}

/**
 * PDFKit's `lineGap` is extra space between lines, in points. CSS wants a
 * multiplier, so express the gap relative to the body size.
 */
export function lineHeightFor(theme: PdfHtmlTheme): number {
  return (theme.size.body + theme.lineGap) / theme.size.body;
}

/**
 * The template a hospital gets before it has ever opened the PDF Builder.
 * Mirrors `DEFAULT_TEMPLATE` on the server, and is what the print view falls
 * back to if a document is somehow served without one.
 */
export const DEFAULT_PDF_TEMPLATE: PdfTemplate = {
  page: { size: 'A4', orientation: 'portrait', margin: 42 },
  typography: { fontFamily: 'Helvetica', baseFontSize: 9, lineGap: 2 },
  colors: { accent: null, ink: DEFAULT_INK, muted: DEFAULT_MUTED },
  header: {
    showLetterhead: true,
    headerStyle: 'inherit',
    showTitleBar: true,
    titleOverride: null,
    showMetaStrip: true,
  },
  footer: {
    showFooter: true,
    footerTextOverride: null,
    showPageNumbers: true,
    showGeneratedAt: true,
  },
  watermark: { enabled: false, text: 'COPY', opacity: 0.08, angle: -35, color: null, fontSize: 90 },
  table: { density: 'normal', headerFill: 'accent', zebraRows: true, gridLines: 'horizontal' },
  signature: { enabled: false, labels: ['Authorised Signatory'], height: 48 },
  blocks: [],
};
