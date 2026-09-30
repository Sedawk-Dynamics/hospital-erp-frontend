import { describe, expect, it } from 'vitest';

import type { EmarSchedule } from '@/hooks/use-emar';
import { latestAdministeredPrnByItem } from './prn-dose-history';

function dose(overrides: Partial<EmarSchedule>): EmarSchedule {
  return {
    id: 'dose-1',
    tenantId: 'tenant-1',
    prescriptionId: 'prescription-1',
    prescriptionItemId: 'item-1',
    patientId: 'patient-1',
    admissionId: 'admission-1',
    drugName: 'Morphine',
    dosage: '2 mg',
    route: 'IV',
    frequencyCode: 'PRN',
    slotCode: null,
    scheduledAt: '2026-09-22T08:00:00.000Z',
    status: 'given',
    isPrn: true,
    actionedAt: '2026-09-22T08:00:00.000Z',
    actualGivenTime: '2026-09-22T08:00:00.000Z',
    givenById: 'user-1',
    delayMinutes: null,
    reason: null,
    notes: null,
    amendedAt: null,
    amendedById: null,
    previousStatus: null,
    cancelledAt: null,
    cancelReason: null,
    ...overrides,
  };
}

describe('PRN dose history', () => {
  it('returns the latest administered dose for each prescription item', () => {
    const earlier = dose({ id: 'earlier' });
    const latest = dose({
      id: 'latest',
      actualGivenTime: '2026-09-23T09:30:00.000Z',
      givenBy: { id: 'user-2', firstName: 'Asha', lastName: 'Nair' },
    });

    expect(latestAdministeredPrnByItem([latest, earlier]).get('item-1')).toBe(latest);
  });

  it('ignores PRN entries that were not administered', () => {
    const held = dose({ status: 'held' });

    expect(latestAdministeredPrnByItem([held]).size).toBe(0);
  });
});
