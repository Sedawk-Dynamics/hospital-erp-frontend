'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';
import { useIcdSearch } from '@/hooks/use-icd';

/**
 * The diagnosis name, typed — and searched against ICD-10 as it is typed.
 *
 * Shared by every screen a doctor records a diagnosis on — the prescription
 * pad and the consultation-completion examination step.
 *
 * Neither searched the catalogue by NAME before. The pad had a code picker
 * beside the field and the examination step had a bare text box, so a doctor
 * who types "fever" rather than "R50.9" left the code empty and the diagnosis
 * was stored as free text, with nothing to bill from, report on or drive the
 * CDSS off. Picking a suggestion here fills the name AND the code.
 *
 * Expects `form` to hold a `diagnoses` field array whose rows carry
 * `diagnosisName` and `icdCode`, which both screens already do.
 *
 * The suggestion list is PORTALLED to the body rather than positioned inside
 * the field. Both hosts clip it otherwise, in two different ways that no
 * z-index can escape: the prescription pad's card had `overflow-hidden`, and
 * the consultation card has `overflow-hidden` for its rounded header while the
 * dialog scrolls its body with `overflow-y-auto`. Measured against the real
 * markup, the second result was cut in half and the third never appeared.
 *
 * Free text is still the fallback and always available: anything not chosen
 * from the list is kept exactly as typed, with no code. That matters — a
 * working diagnosis is often not codeable yet, and the form must not force one.
 */
export function DiagnosisNameField({
  form,
  index,
  placeholder = 'Start typing Diagnosis...',
  /** The two screens size their inputs differently; the dropdown is shared. */
  inputClassName = 'h-8 text-sm',
}: {
  // The forms on both screens are typed `any` already; this follows them
  // rather than inventing a shape neither actually satisfies.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  index: number;
  placeholder?: string;
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const field = form.register(`diagnoses.${index}.diagnosisName`);
  const typed: string = form.watch(`diagnoses.${index}.diagnosisName`) ?? '';
  const debounced = useDebounce(typed, 250);
  const term = debounced.trim();
  const { data: results, isFetching } = useIcdSearch(term, open && term.length >= 2);
  const matches = results ?? [];

  const choose = (icd: { code: string; title: string }) => {
    form.setValue(`diagnoses.${index}.diagnosisName`, icd.title, { shouldDirty: true });
    form.setValue(`diagnoses.${index}.icdCode`, icd.code, { shouldDirty: true });
    setOpen(false);
  };

  // Where to put the portalled list: pinned under the input, tracked while it
  // is open so scrolling an ancestor does not leave it behind.
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
    // `true` — capture, so an ancestor scrolling counts, not just the window.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  return (
    <div ref={anchor} className="relative flex-1">
      <Input
        placeholder={placeholder}
        className={`w-full ${inputClassName}`}
        autoComplete="off"
        {...field}
        onChange={(e) => {
          field.onChange(e);
          setOpen(true);
        }}
        onFocus={() => typed.trim().length >= 2 && setOpen(true)}
        // Delayed so a click on a suggestion lands before the list closes.
        onBlur={(e) => {
          field.onBlur(e);
          setTimeout(() => setOpen(false), 200);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') return setOpen(false);
          if (e.key !== 'Enter') return;
          // Always swallowed: Enter in a diagnosis line must never submit the
          // whole prescription. With a list open it takes the first match;
          // otherwise it just leaves the free text alone.
          e.preventDefault();
          if (open && matches.length) choose(matches[0]);
        }}
      />
      {open &&
        term.length >= 2 &&
        rect &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-[60] max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg"
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            {matches.map((icd) => (
              <button
                key={icd.id}
                type="button"
                className="flex w-full items-start gap-2 border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-accent"
                // onMouseDown, not onClick: blur fires first and would close the
                // list before a click could land.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(icd);
                }}
              >
                <Badge
                  variant="outline"
                  className="mt-0.5 shrink-0 border-error/30 bg-error/10 px-1.5 py-0 text-[10px] font-bold text-error"
                >
                  {icd.code}
                </Badge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{icd.title}</span>
                  {icd.category && (
                    <span className="block truncate text-[10px] uppercase text-muted-foreground">
                      {icd.category}
                    </span>
                  )}
                </span>
              </button>
            ))}
              {!matches.length && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {isFetching
                    ? 'Searching ICD-10…'
                    : `No ICD-10 match for “${term}”. It will be saved as free text.`}
                </p>
              )}
          </div>,
          document.body,
        )}
    </div>
  );
}
