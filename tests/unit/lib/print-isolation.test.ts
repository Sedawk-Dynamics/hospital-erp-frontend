import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================
// The print stylesheet that lets a document inside a dialog reach the paper.
//
// Printing the IP / Emergency / Day Care bill produced a blank sheet. The
// document isolates itself the usual way — hide the page, un-hide the one
// document node — which works on an ordinary page and does not work inside a
// dialog, because the popup is `position: fixed`, carries a centring
// translate, and is a `max-height` + `overflow-y: auto` scroll box. Measured
// on the real screen: 1020px of an 1106px bill clipped away.
//
// Two of the fixes are the kind that break silently, at build time, with a
// perfectly healthy-looking source file — so they are pinned here rather than
// left to be rediscovered:
//
//   * `translate` next to `transform` in one rule gets combined by Lightning
//     CSS into a single `transform: translate3d(…) …`, which does NOT reset
//     the independent `translate` property Tailwind v4 emits for
//     `-translate-x-1/2`. The popup stays offset and half the bill prints
//     above the first page.
//   * a selector nesting `:has()` inside `:not()` is DROPPED outright by
//     Lightning CSS for our browser targets. The rule never reaches the page
//     and nothing anywhere reports it.
// ============================================================

const RAW = readFileSync(resolve(__dirname, '../../../src/app/globals.css'), 'utf8');
/** Comments explain these traps by quoting them, so match against code only. */
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, '');

/** The @media print block, without the surrounding rules. */
function printBlock(): string {
  const start = CSS.indexOf('@media print');
  expect(start, 'globals.css must carry an @media print block').toBeGreaterThan(-1);
  let depth = 0;
  let i = CSS.indexOf('{', start);
  const open = i;
  for (; i < CSS.length; i++) {
    if (CSS[i] === '{') depth++;
    else if (CSS[i] === '}') {
      depth--;
      if (depth === 0) return CSS.slice(open + 1, i);
    }
  }
  throw new Error('unterminated @media print block');
}

/** The declarations of the first rule whose selector contains `needle`. */
function ruleFor(needle: string, block = printBlock()): string {
  const idx = block.indexOf(needle);
  expect(idx, `expected a rule mentioning ${needle}`).toBeGreaterThan(-1);
  const open = block.indexOf('{', idx);
  const close = block.indexOf('}', open);
  return block.slice(open + 1, close);
}

describe('print isolation for a document inside a dialog', () => {
  it('unwinds the popup so the document is an ordinary block in the flow', () => {
    // Each of these on its own is enough to lose the page.
    const rule = ruleFor("[data-slot='dialog-content'] {");
    expect(rule).toMatch(/position:\s*static\s*!important/);
    expect(rule).toMatch(/transform:\s*none\s*!important/);
    expect(rule).toMatch(/overflow:\s*visible\s*!important/);
    expect(rule).toMatch(/max-height:\s*none\s*!important/);
  });

  it('resets `translate` in a rule of its own, away from `transform`', () => {
    // Lightning CSS combines the two into one `transform` shorthand when they
    // share a block, and the standalone `translate` reset is lost with it.
    const block = printBlock();
    const rules = block.split('}');
    const translateRules = rules.filter((r) => /(^|[;{\s])translate:\s*none/.test(r));
    expect(translateRules.length, 'expected a rule resetting translate').toBeGreaterThan(0);
    for (const r of translateRules) {
      expect(r, 'translate must not share a block with transform').not.toMatch(/transform:/);
    }
  });

  it('never nests :has() inside :not()', () => {
    // Lightning CSS drops such a rule entirely, without a warning.
    expect(CSS).not.toMatch(/:not\(\s*:has\(/);
  });

  it('stops transitions and animations, which outrank !important', () => {
    // The popup carries `transition-property: all`. A running transition sits
    // above `!important` in the cascade, so the print rules were being held at
    // their pre-print values by a transition they had themselves started.
    const block = printBlock();
    expect(block).toMatch(/transition:\s*none\s*!important/);
    expect(block).toMatch(/animation:\s*none\s*!important/);
  });

  it('keeps the app shell off the page rather than merely invisible', () => {
    // `visibility: hidden` keeps an element's height — an app shell's worth of
    // it ahead of the document is a run of blank sheets.
    const block = printBlock();
    expect(block).toMatch(/body:has\(\[data-slot='dialog-portal'\]/);
  });

  it('prints only the dialog holding the document when dialogs are stacked', () => {
    // "Generate Bill" opens the bill print dialog on top of itself, so two
    // popups are mounted at once.
    const block = printBlock();
    expect(block).toMatch(/\.print-document/);
    // Hide-all, then restore the one that holds the document. The restore rule
    // needs the higher specificity, which the extra :has() gives it, and it
    // has to come second.
    const hide = block.search(
      /body:has\(\[data-slot='dialog-content'\] \.print-document\)\s*\[data-slot='dialog-content'\]\s*\{\s*display:\s*none/,
    );
    const show = block.search(
      /\[data-slot='dialog-content'\]:has\(\.print-document\)\s*\{\s*display:\s*block/,
    );
    expect(hide, 'expected a rule hiding every popup').toBeGreaterThan(-1);
    expect(show, 'expected a rule restoring the document popup').toBeGreaterThan(-1);
    expect(show, 'the restore rule must come after the hide rule').toBeGreaterThan(hide);
  });
});
