'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { useDisorderSearch } from '@/hooks/use-disorders';

/**
 * The "existing disorders" control: one search bar, and a chip per disorder.
 *
 * It used to be a free-text box — so the same condition arrived as "sugar",
 * "diabetes" and "DM" and nothing downstream could count or match them — and
 * then briefly a picker sitting ABOVE a textarea, which asked the reader to
 * work out which of two fields was the real one. There is one control now.
 *
 * STORAGE. The chips are the existing `disorders` text column, one per line.
 * That is why no migration was needed and why the patient file, the safety
 * banner and the doctor's file view all keep working untouched — and it is the
 * same row the clinician and the patient both write, so a line added on one
 * side shows as a chip on the other.
 *
 * Anything already in that column — years of free text — parses straight into
 * chips and can be read and removed. Nothing typed before this is lost.
 */

/** A stored line. `code` is null for free text written before the picker. */
export interface DisorderChip {
  code: string | null;
  label: string;
  /** The exact stored line, so removing one edits nothing else. */
  raw: string;
}

/** `"J45.9 — Asthma, unspecified"` → its parts. Free text keeps `code: null`. */
export function parseDisorders(value: string): DisorderChip[] {
  return value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(/^([A-Z][0-9]{2}(?:\.[0-9A-Z]+)?)\s+—\s+(.+)$/);
      return m ? { code: m[1], label: m[2], raw } : { code: null, label: raw, raw };
    });
}

const line = (code: string | null, name: string) => (code ? `${code} — ${name}` : name);

export function DisorderPicker({
  value,
  onChange,
  placeholder = 'Search conditions — e.g. asthma, diabetes, high blood pressure…',
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(term, 250);
  const q = debounced.trim();
  const { data, isFetching } = useDisorderSearch(q, open && q.length >= 2);
  const chips = parseDisorders(value);
  // Already-added ones are shown as such rather than hidden, so a clinician
  // searching for a condition can see it is on the list instead of concluding
  // the search is broken.
  const added = new Set(chips.map((c) => c.raw));
  const matches = data ?? [];

  const add = (d: { icdCode: string | null; name: string }) => {
    const next = line(d.icdCode, d.name);
    if (!added.has(next)) onChange(chips.length ? `${value.trim()}\n${next}` : next);
    setTerm('');
    setOpen(false);
  };
  const remove = (raw: string) =>
    onChange(
      chips
        .filter((c) => c.raw !== raw)
        .map((c) => c.raw)
        .join('\n'),
    );

  // The list is portalled: every host clips it. The portal's position is taken
  // from the input and tracked while open, so scrolling a card does not leave
  // it behind.
  const anchor = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const place = useCallback(() => {
    const el = anchor.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, matches.length]);
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  return (
    <div>
      <div ref={anchor} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/60" />
        <input
          value={term}
          disabled={disabled}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => term.trim().length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') return setOpen(false);
            if (e.key !== 'Enter') return;
            // Swallowed either way: Enter here must never submit the form
            // around it. With a list open it adds the first match.
            e.preventDefault();
            if (open && matches.length) add(matches[0]);
          }}
          placeholder={placeholder}
          className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
      </div>

      {open &&
        q.length >= 2 &&
        rect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-[60] max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg"
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            {matches.map((d) => {
              const already = added.has(line(d.icdCode, d.name));
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={already}
                  className="flex w-full items-start gap-2 border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  // mousedown, not click: blur would close the list first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!already) add(d);
                  }}
                >
                  {d.icdCode && (
                    <span className="mt-0.5 shrink-0 rounded border border-error/30 bg-error/10 px-1.5 text-[10px] font-bold text-error">
                      {d.icdCode}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{d.name}</span>
                    {d.category && (
                      <span className="block truncate text-[10px] uppercase text-muted-foreground">
                        {d.category}
                      </span>
                    )}
                  </span>
                  {already && <span className="shrink-0 text-[10px] text-muted-foreground">added</span>}
                </button>
              );
            })}
            {!matches.length && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {isFetching
                  ? 'Searching…'
                  : `No condition matching “${q}”. Ask your hospital to add it to the list.`}
              </p>
            )}
          </div>,
          document.body,
        )}

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c.raw}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-2.5 pr-1.5 text-xs text-on-surface"
            >
              {c.code && <span className="font-bold text-primary">{c.code}</span>}
              <span>{c.label}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${c.label}`}
                  onClick={() => remove(c.raw)}
                  className="rounded-full p-0.5 text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
