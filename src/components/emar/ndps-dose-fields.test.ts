import { describe, expect, it } from 'vitest';

import type { NdpsDoseContext } from '@/hooks/use-emar';
import { EMPTY_NDPS_FORM, buildNdpsPatientDose } from './ndps-dose-fields';

const context: NdpsDoseContext = {
  isNdps: true,
  linkedBatchId: '11111111-1111-4111-8111-111111111111',
  requiresEmergencyReason: false,
  batches: [],
  locations: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'ICU narcotic safe',
      type: 'ward',
      wardId: null,
      availableContainers: 1,
      preferred: true,
    },
  ],
};

describe('NDPS bedside dose reconciliation', () => {
  it('automatically quarantines a positive remainder', () => {
    const dose = buildNdpsPatientDose(context, {
      ...EMPTY_NDPS_FORM,
      labelledQuantity: '2',
      administeredQuantity: '0.5',
      quarantineLocation: 'ICU narcotic safe - residual bin A',
    });

    expect(dose).toMatchObject({
      labelledQuantity: 2,
      administeredQuantity: 0.5,
      disposition: 'quarantined',
      quarantineLocation: 'ICU narcotic safe - residual bin A',
    });
    expect(dose).not.toHaveProperty('disposalMethod');
    expect(dose).not.toHaveProperty('witnessedById');
  });

  it('requires the sealed quarantine location when medicine remains', () => {
    expect(() => buildNdpsPatientDose(context, {
      ...EMPTY_NDPS_FORM,
      labelledQuantity: '2',
      administeredQuantity: '0.5',
    })).toThrow('Record where the sealed residual will be quarantined.');
  });

  it('records no disposition when the full labelled quantity is given', () => {
    const dose = buildNdpsPatientDose(context, {
      ...EMPTY_NDPS_FORM,
      labelledQuantity: '2',
      administeredQuantity: '2',
    });

    expect(dose?.disposition).toBe('none');
    expect(dose?.quarantineLocation).toBeUndefined();
  });
});
