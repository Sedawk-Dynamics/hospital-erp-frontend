'use client';

// Local draft recovery for long clinical forms.
//
// A doctor's progress note lived in React state until they pressed Save. The
// access token is 15 minutes; any refresh failure, tab crash or stray reload
// mid-consultation took the whole note with it. QA hit exactly that — an
// unexpected logout erased notes that had already been typed — and flagged it
// critical, which it is: the note is the clinical record of the encounter and
// the doctor has already moved on to the next patient.
//
// This is the cheap half of the fix and the one that survives the session
// dying: the draft is written to localStorage as it is typed, and offered back
// when the same form reopens. It is NOT a substitute for saving — it is what
// stops the typing being lost while the doctor works out why they were logged
// out.
//
// Deliberately local-only. A server-side autosave would be better for a doctor
// moving between devices, but it needs a draft state on ProgressNote and a rule
// about who else can see an unfinished note — neither of which should be
// decided in passing.

import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'draft:';
/** Drafts older than this are stale enough to be noise rather than help. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredDraft<T> {
  savedAt: number;
  data: T;
}

function read<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    // A corrupt or unreadable draft must never break the form it belongs to.
    return null;
  }
}

export interface FormDraft<T> {
  /** A recovered draft waiting to be accepted or discarded, if there is one. */
  pending: { data: T; savedAt: number } | null;
  /** Take the recovered draft — the caller applies it to its own state. */
  restore: () => T | null;
  /** Throw the recovered draft away. */
  discard: () => void;
  /** Clear the stored draft — call after a successful save. */
  clear: () => void;
}

/**
 * Persist `value` under `key` while `active`, and surface any draft found from
 * a previous session.
 *
 * `key` must identify the form AND what it is about (patient, encounter, note),
 * or one patient's draft will be offered on another's chart. Pass null to
 * disable entirely.
 */
export function useFormDraft<T>(
  key: string | null,
  value: T,
  active: boolean,
  opts: { isEmpty?: (v: T) => boolean; debounceMs?: number } = {},
): FormDraft<T> {
  const { isEmpty, debounceMs = 800 } = opts;
  const [pending, setPending] = useState<{ data: T; savedAt: number } | null>(null);
  // Once the user has answered the restore prompt, stop writing over their
  // decision and stop re-offering it.
  const answered = useRef(false);

  // Look for a draft when the form becomes active.
  useEffect(() => {
    if (!active || !key) {
      answered.current = false;
      setPending(null);
      return;
    }
    const found = read<T>(key);
    setPending(found ? { data: found.data, savedAt: found.savedAt } : null);
  }, [active, key]);

  // Write as the user types. Debounced — a note is typed continuously and
  // localStorage is synchronous.
  useEffect(() => {
    if (!active || !key) return;
    // Nothing worth keeping, and an empty write would clobber a real draft the
    // user has not answered the prompt for yet.
    if (isEmpty?.(value)) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          PREFIX + key,
          JSON.stringify({ savedAt: Date.now(), data: value } satisfies StoredDraft<T>),
        );
      } catch {
        // Quota or private-browsing. Losing draft recovery is acceptable;
        // breaking the form the doctor is typing into is not.
      }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [key, value, active, isEmpty, debounceMs]);

  const clear = useCallback(() => {
    if (!key) return;
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* see above */
    }
    setPending(null);
  }, [key]);

  const restore = useCallback(() => {
    if (!pending) return null;
    answered.current = true;
    const data = pending.data;
    setPending(null);
    return data;
  }, [pending]);

  const discard = useCallback(() => {
    answered.current = true;
    clear();
  }, [clear]);

  return { pending, restore, discard, clear };
}

/**
 * Warn before a reload or tab close while unsaved work is on screen.
 *
 * The browser shows its own generic wording — the message cannot be set — so
 * this only guards the accidental case. It does nothing for an in-app route
 * change, which is a separate problem.
 */
export function useUnsavedChangesWarning(when: boolean) {
  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);
}
