import { describe, expect, it } from 'vitest';

import type { NdpsDoseContext } from '@/hooks/use-emar';
import { EMPTY_NDPS_FORM, buildNdpsPatientDose } from './ndps-dose-fields';

const context: NdpsDoseContext = {
  isNdps: true,
  linkedBatchId: '11111111-1111-4111-8111-111111111111',
  requiresEmergencyReason: false,
  clinicalDetails: {
    doctorRegistration: 'NMC-12345',
    bedNumber: 'ICU-01',
    diagnosis: 'Post-operative pain',
  },
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
  it('uses labelled contents derived from the selected drug when the form is empty', () => {
    const dose = buildNdpsPatientDose({
      ...context,
      labelledContents: {
        quantity: 10,
        unit: 'mL',
        source: 'drug_strength',
        sourceText: '10ml',
      },
    }, {
      ...EMPTY_NDPS_FORM,
      administeredQuantity: '2',
    });

    expect(dose).toMatchObject({
      labelledQuantity: 10,
      administeredQuantity: 2,
      quantityUnit: 'mL',
      residualHandling: 'pending_destruction',
    });
  });

  it('records a destruction request without claiming destruction occurred', () => {
    const dose = buildNdpsPatientDose(context, {
      ...EMPTY_NDPS_FORM,
      labelledQuantity: '2',
      administeredQuantity: '0.5',
    });

    expect(dose).toMatchObject({
      labelledQuantity: 2,
      administeredQuantity: 0.5,
      disposition: 'quarantined',
      residualHandling: 'pending_destruction',
    });
    expect(dose?.quarantineLocation).toBeUndefined();
    expect(dose).not.toHaveProperty('disposalMethod');
    expect(dose).not.toHaveProperty('witnessedById');
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

  it('does not block administration when the doctor profile has no registration number', () => {
    const dose = buildNdpsPatientDose({
      ...context,
      clinicalDetails: { ...context.clinicalDetails!, doctorRegistration: null },
    }, {
      ...EMPTY_NDPS_FORM,
      labelledQuantity: '2',
      administeredQuantity: '2',
    });

    expect(dose?.disposition).toBe('none');
    expect(dose).not.toHaveProperty('prescriberRegistrationNumber');
  });

  it('does not require bedside clinical justification when the chart has no diagnosis', () => {
    const dose = buildNdpsPatientDose({
      ...context,
      clinicalDetails: { ...context.clinicalDetails!, diagnosis: null },
    }, {
      ...EMPTY_NDPS_FORM,
      labelledQuantity: '2',
      administeredQuantity: '2',
    });

    expect(dose?.disposition).toBe('none');
    expect(dose).not.toHaveProperty('clinicalJustification');
  });
});
