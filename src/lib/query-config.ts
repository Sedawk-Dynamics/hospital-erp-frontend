// ============================================================
// How fresh the cache has to be, decided in one place.
//
// The problem this solves: a hospital screen is almost never read by the person
// who wrote it. The nurse records vitals, the doctor reads them. The lab enters
// a result, the doctor acts on it. The front desk collects a payment, the ward
// waits on it. With `refetchOnWindowFocus: false` and a 60s `staleTime` — the
// old defaults — none of those writes could EVER reach the other person's open
// browser. There is no websocket or SSE channel in this app, so the cache was
// the only thing standing between two roles, and it was told to sit still.
//
// Three tiers, applied by key prefix on the QueryClient itself rather than hook
// by hook:
//
//   default    everything — refetch when the tab regains focus or the network
//              comes back, and treat data older than 15s as stale.
//   LIVE       shared worklists two roles both write to. Additionally polled
//              while the tab is visible, so a change shows up even when nobody
//              switches windows.
//   REFERENCE  catalogues and config that change rarely and cost a lot to
//              fetch (the drug master is ~254K rows). Held longer ON PURPOSE,
//              so tightening the global default does not turn into a stampede.
//
// Why prefixes and not per-hook options: `setQueryDefaults` matches on key
// prefix, so `['lab', 'orders']` covers every list, detail and filtered variant
// underneath it. That keeps the policy readable in one table, and — because
// options passed at the call site always win — it cannot override a hook that
// has already made a deliberate choice. Nothing existing is taken away.
// ============================================================

import type { QueryClient } from '@tanstack/react-query';

/**
 * Shared worklists: queues, orders, beds, ledgers, charts. Two different roles
 * are looking at these at the same time and one of them is waiting on the other.
 *
 * `refetchIntervalInBackground` stays false (the default) so a hidden tab stops
 * polling entirely — a browser left open overnight costs nothing, and the focus
 * refetch catches it up the moment someone comes back to it.
 */
export const LIVE_POLICY = {
  staleTime: 5_000,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
};

/**
 * Catalogues, tariffs, templates, branding. Edited occasionally by one admin
 * and then read constantly by everyone.
 *
 * A long staleTime is safe here because it only governs PASSIVE refresh: an
 * explicit `invalidateQueries` after a mutation still refetches immediately, so
 * the person who edits a catalogue always sees their own change at once.
 */
export const REFERENCE_POLICY = {
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
};

/**
 * Key prefixes whose data is genuinely collaborative.
 *
 * Each entry is a prefix, so `['clinical', 'admissions']` also covers
 * `['clinical', 'admissions', 'list', {...}]` and `[..., 'detail', id]`.
 */
const LIVE_KEYS: string[][] = [
  // ── Beds and the IP census ────────────────────────────────────────
  // Front desk admits, nurse assigns a bed, doctor rounds, billing accrues.
  ['clinical', 'admissions'],
  ['clinical', 'visits'],
  ['clinical', 'beds'],
  ['infrastructure', 'beds'],

  // ── The OP queue ──────────────────────────────────────────────────
  // The front desk books and confirms; the doctor and nurse read the queue.
  ['hospital', 'op-appointments'],
  ['hospital', 'appointment-stats'],
  ['hospital', 'doctor-queue'],
  ['hospital', 'doctor-slots'],
  ['hospital', 'walkin-appointments'],

  // ── Money ─────────────────────────────────────────────────────────
  // The counter settles while the ward waits for clearance to discharge.
  ['hospital', 'bills'],
  ['hospital', 'payments'],
  ['hospital', 'charges'],
  ['hospital', 'billing-pending'],
  ['hospital', 'billing-order-list'],
  ['ip-ledger'],
  ['ip-ledger-activity'],

  // ── Doctor worklists ──────────────────────────────────────────────
  ['doctor', 'appointments'],
  ['doctor', 'admissions'],
  ['doctor', 'active-visit'],
  ['doctor', 'vitals'],
  ['doctor', 'lab-orders'],
  ['doctor', 'imaging-requests'],
  ['doctor', 'ot-requests'],
  ['doctor', 'progress-notes'],
  ['doctor', 'prescriptions'],

  // ── Nurse worklists ───────────────────────────────────────────────
  ['nurse', 'admissions'],
  ['nurse', 'vitals'],
  ['nurse', 'orders'],
  ['nurse', 'administration'],
  ['nurse', 'handovers'],
  ['nurse', 'beds'],
  ['nurse', 'prescriptions'],
  ['nurse', 'supply-requests'],
  ['nurse-assignments'],
  ['nurse-doctor-assignments'],
  ['emar'],

  // ── Diagnostics ───────────────────────────────────────────────────
  // The doctor is waiting on the lab; the lab is waiting on the sample.
  ['lab', 'orders'],
  ['lab', 'samples'],
  ['lab', 'results'],
  ['lab', 'reports'],
  ['imaging', 'requests'],
  ['imaging', 'results'],

  // ── Pharmacy and stock movement ───────────────────────────────────
  ['pharmacy', 'dispensing'],
  ['pharmacy', 'returns'],
  ['pharmacy', 'batches'],
  ['indents'],
  ['inventory', 'supply-requests'],
  ['inventory', 'transfers'],

  // ── Theatre ───────────────────────────────────────────────────────
  // The desk schedules, the doctor accepts, the kit is issued and returned.
  ['ot', 'requests'],
  ['ot', 'theaters'],
  ['ot-kit'],

  // ── Forms filled by one role and read by another ──────────────────
  ['form-submissions'],
];

/**
 * Key prefixes that are expensive and near-static. Listed explicitly so the
 * tighter global default cannot quietly multiply load on the heavy endpoints.
 */
const REFERENCE_KEYS: string[][] = [
  ['drug-master'], // ~254K rows behind the search
  ['icd'],
  ['tariffs'],
  ['lab', 'tests'], // the test catalogue, not the orders
  ['imaging', 'catalog'],
  ['pharmacy', 'formulary'],
  ['hospital-branding'],
  ['infrastructure', 'departments'],
];

/**
 * Register the policies above. Call once, while the QueryClient is being
 * created, so no query can mount before its defaults exist.
 *
 * React Query merges every registered default whose prefix matches, in
 * registration order. The two lists deliberately do not overlap — `lab/tests`
 * against `lab/orders`, `imaging/catalog` against `imaging/requests` — so no
 * key can be claimed by both tiers.
 */
export function applyFreshnessPolicies(client: QueryClient): void {
  for (const key of REFERENCE_KEYS) client.setQueryDefaults(key, REFERENCE_POLICY);
  for (const key of LIVE_KEYS) client.setQueryDefaults(key, LIVE_POLICY);
}

/** Exported for the test that guards the two tiers against overlapping. */
export const __policyKeys = { LIVE_KEYS, REFERENCE_KEYS };

/** Who the cached data belongs to. */
export interface CacheIdentity {
  userId: string | null;
  tenantId: string | null;
}

/**
 * Whether the cache now belongs to somebody else and has to be thrown away.
 *
 * Not one query key in this app carries the user or the hospital in it —
 * `['clinical', 'admissions', 'list', {...}]` means "the admissions of whoever
 * the API client is currently authenticated as". That is fine right up to the
 * moment that changes underneath it:
 *
 *  - **Switching hospital.** The JWT and `X-Tenant-Id` swap over, but every
 *    cached row still belongs to the hospital just left. Until each query
 *    happens to refetch, the new hospital's screens are showing the old
 *    hospital's patients.
 *  - **Logging out.** Tokens are cleared, the cache is not. The next person to
 *    log in on that tab inherits the previous user's data.
 *
 * Deliberately quiet in two cases, so a normal page load does not throw away
 * queries that have only just been fired:
 *
 *  - the first observation, when there is nothing to compare against;
 *  - going from "nobody" to "somebody" — logging in, or the stores hydrating
 *    out of localStorage — where nothing worth keeping is cached anyway.
 *
 * A tenant only counts as switched between two real hospitals; picking the
 * first one after login is not a switch.
 */
export function shouldResetCache(previous: CacheIdentity | null, next: CacheIdentity): boolean {
  if (!previous) return false;
  const userChanged = !!previous.userId && previous.userId !== next.userId;
  const tenantSwitched =
    !!previous.tenantId && !!next.tenantId && previous.tenantId !== next.tenantId;
  return userChanged || tenantSwitched;
}
