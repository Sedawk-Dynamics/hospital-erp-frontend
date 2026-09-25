'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { useSnomedSearch, fetchSnomedMap } from '@/hooks/use-snomed';

export function DiagnosisNameField({
  form,
  index,
  placeholder = 'Start typing Diagnosis...',
  inputClassName = 'h-8 text-sm',
}: {

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
  const { data: results, isFetching } = useSnomedSearch(term, open && term.length >= 2);
  const matches = results ?? [];

  const choose = async (concept: { conceptId: string; term: string }) => {
    form.setValue(`diagnoses.${index}.diagnosisName`, concept.term, { shouldDirty: true });
    form.setValue(`diagnoses.${index}.snomedCode`, concept.conceptId, { shouldDirty: true });
    setOpen(false);

    // Resolve the ICD code(s) for this concept via the SNOMED→ICD cross-map.
    // The clinician never picks ICD by hand — it is derived from the selection.
    // Best-effort: a map failure must not block charting, so the free text +
    // SNOMED code are already saved above.
    try {
      const map = await fetchSnomedMap(concept.conceptId);
      form.setValue(`diagnoses.${index}.icdCode`, map.icdCodes[0] ?? '', { shouldDirty: true });
    } catch {
      form.setValue(`diagnoses.${index}.icdCode`, '', { shouldDirty: true });
    }
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
            {matches.map((concept) => (
              <button
                key={concept.conceptId}
                type="button"
                className="flex w-full items-start gap-2 border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-accent"
                // onMouseDown, not onClick: blur fires first and would close the
                // list before a click could land.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(concept);
                }}
              >
                {/* SNOMED code is intentionally NOT shown — it is a backend-only
                    concept, hidden from clinical UI per the coding standard. */}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{concept.term}</span>
                </span>
              </button>
            ))}
              {!matches.length && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {isFetching
                    ? 'Searching SNOMED…'
                    : `No SNOMED match for “${term}”. It will be saved as free text.`}
                </p>
              )}
          </div>,
          document.body,
        )}
    </div>
  );
}
