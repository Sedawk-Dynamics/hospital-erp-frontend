'use client';

import { useEffect, useRef } from 'react';

/**
 * Seed a form from server data once per record — not once per fetch.
 *
 * The usual shape of this bug:
 *
 * ```ts
 * useEffect(() => {
 *   if (summary) { setNarrative(summary.narrative ?? ''); ... }
 * }, [summary]);            // ← fires again on every refetch
 * ```
 *
 * That reads as "fill the form when the record arrives", but the dependency is
 * the query object, so it actually means "fill the form whenever the query
 * hands back a new object". React Query's structural sharing hides this while
 * the server data is unchanged — identity is preserved, the effect stays quiet.
 * The moment the record genuinely differs, or the endpoint recomputes something
 * on each call, the effect fires and overwrites whatever the user had typed.
 *
 * Now that queries refetch on window focus, that is one alt-tab away: a doctor
 * half-way through a discharge narrative checks a lab value in another tab,
 * comes back, and the form has reset itself.
 *
 * Passing the record's identity — usually its id — makes the intent literal:
 * seed when we start editing a DIFFERENT record, and never again for this one.
 *
 * `seed` does not need to be memoised. It is read on every run, but the guard
 * returns before calling it, so an unmemoised callback costs a comparison.
 */
export function useSeedOnChange(
  identity: string | number | null | undefined,
  seed: () => void,
): void {
  const seededFor = useRef<string | number | null>(null);

  useEffect(() => {
    if (identity == null) return;
    if (seededFor.current === identity) return;
    seededFor.current = identity;
    seed();
  }, [identity, seed]);
}
