import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  applyFreshnessPolicies,
  shouldResetCache,
  LIVE_POLICY,
  REFERENCE_POLICY,
  __policyKeys,
} from '@/lib/query-config';

// The key factories the policies are meant to cover. Imported for real, so a
// rename in a hook breaks this test instead of silently unregistering a policy
// — a prefix that matches nothing fails completely quietly at runtime, which is
// the exact class of bug this file exists to prevent.
import { clinicalKeys } from '@/hooks/use-clinical';
import { hospitalKeys } from '@/hooks/use-hospital';
import { labKeys } from '@/hooks/use-lab';
import { imagingKeys } from '@/hooks/use-imaging';
import { otKeys } from '@/hooks/use-ot';
import { ipLedgerKeys } from '@/hooks/use-ip-ledger';

function client() {
  const qc = new QueryClient();
  applyFreshnessPolicies(qc);
  return qc;
}

describe('freshness policy — live worklists', () => {
  // Each of these is written by one role and read by another while they wait.
  it.each([
    ['IP census', clinicalKeys.admissions.list({})],
    ['bed availability', clinicalKeys.beds.availability],
    ['OP queue', hospitalKeys.opAppointments({})],
    ['doctor queue', hospitalKeys.doctorQueue('doc-1', '2026-08-08')],
    ['bills', hospitalKeys.bills({})],
    ['lab orders', labKeys.orders.list({})],
    ['lab results', labKeys.results.list({})],
    ['imaging requests', imagingKeys.requests.list({})],
    ['OT requests', otKeys.requests.list({})],
    ['IP ledger', ipLedgerKeys.detail('adm-1')],
  ])('%s polls and refetches on focus', (_label, key) => {
    const d = client().getQueryDefaults(key as unknown as string[]);
    expect(d.refetchInterval).toBe(LIVE_POLICY.refetchInterval);
    expect(d.refetchOnWindowFocus).toBe(true);
    // A hidden tab must stop polling — an overnight browser should cost nothing.
    expect(d.refetchIntervalInBackground).toBe(false);
  });
});

describe('freshness policy — reference data', () => {
  it('holds the heavy catalogues instead of refetching them', () => {
    const d = client().getQueryDefaults(['drug-master', 'search', 'para']);
    expect(d.staleTime).toBe(REFERENCE_POLICY.staleTime);
    expect(d.refetchInterval).toBeUndefined();
  });

  // The tiers split siblings under one root, which only works if prefix
  // matching is exact. If `['lab']` were ever registered these would collide.
  it('separates the test catalogue from the order worklist', () => {
    const qc = client();
    expect(qc.getQueryDefaults(labKeys.tests.list({})).refetchInterval).toBeUndefined();
    expect(qc.getQueryDefaults(labKeys.orders.list({})).refetchInterval).toBe(
      LIVE_POLICY.refetchInterval,
    );
  });

  it('separates the imaging catalogue from imaging requests', () => {
    const qc = client();
    expect(qc.getQueryDefaults(['imaging', 'catalog', {}]).refetchInterval).toBeUndefined();
    expect(qc.getQueryDefaults(imagingKeys.requests.all).refetchInterval).toBe(
      LIVE_POLICY.refetchInterval,
    );
  });
});

describe('freshness policy — safety', () => {
  // React Query MERGES every matching default, so an overlap would hand a key
  // both tiers at once and the winner would depend on registration order.
  it('never lets one key match both tiers', () => {
    const { LIVE_KEYS, REFERENCE_KEYS } = __policyKeys;
    const isPrefix = (a: string[], b: string[]) => a.every((seg, i) => b[i] === seg);
    for (const live of LIVE_KEYS) {
      for (const ref of REFERENCE_KEYS) {
        expect(
          isPrefix(live, ref) || isPrefix(ref, live),
          `${JSON.stringify(live)} overlaps ${JSON.stringify(ref)}`,
        ).toBe(false);
      }
    }
  });

  it('leaves unlisted keys on the global default', () => {
    const d = client().getQueryDefaults(['something', 'nobody', 'registered']);
    expect(d.refetchInterval).toBeUndefined();
    expect(d.staleTime).toBeUndefined();
  });

  // Polling every list in the app would be a denial-of-service on our own API.
  // This is a deliberate ceiling, not a coincidence.
  it('keeps the polled surface small and intentional', () => {
    expect(__policyKeys.LIVE_KEYS.length).toBeLessThan(60);
  });
});

describe('cache identity boundary', () => {
  const id = (userId: string | null, tenantId: string | null) => ({ userId, tenantId });

  // No query key in this app names the user or the hospital, so when either
  // changes the whole cache belongs to somebody else.
  it('drops the cache when the hospital is switched', () => {
    expect(shouldResetCache(id('u1', 'hosp-a'), id('u1', 'hosp-b'))).toBe(true);
  });

  it('drops the cache on logout, so the next user cannot inherit it', () => {
    expect(shouldResetCache(id('u1', 'hosp-a'), id(null, 'hosp-a'))).toBe(true);
  });

  it('drops the cache when a different user signs in on the same tab', () => {
    expect(shouldResetCache(id('u1', 'hosp-a'), id('u2', 'hosp-a'))).toBe(true);
  });

  // The quiet cases. Clearing here would cancel the queries a page has only
  // just fired, causing a visible double fetch on every single load.
  it('stays quiet on the first observation', () => {
    expect(shouldResetCache(null, id('u1', 'hosp-a'))).toBe(false);
  });

  it('stays quiet while the stores hydrate from localStorage', () => {
    expect(shouldResetCache(id(null, null), id('u1', null))).toBe(false);
    expect(shouldResetCache(id('u1', null), id('u1', 'hosp-a'))).toBe(false);
  });

  it('stays quiet when nothing actually changed', () => {
    expect(shouldResetCache(id('u1', 'hosp-a'), id('u1', 'hosp-a'))).toBe(false);
  });

  // Picking the first hospital after login is not a switch — there is nothing
  // from another hospital in the cache to protect against.
  it('does not treat the first hospital selection as a switch', () => {
    expect(shouldResetCache(id('u1', null), id('u1', 'hosp-a'))).toBe(false);
  });
});
