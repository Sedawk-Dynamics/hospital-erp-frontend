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
  it('records a destruction request without claiming destruction occurred', () => {
    const dose = buildNdpsPatientDose(context, {
      ...EMPTY_NDPS_FORM,
      labelledQuantity: '2',
      administeredQuantity: '0.5',
      residualHandling: 'pending_destruction',
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

  it('requires the sealed quarantine location when medicine remains', () => {
    expect(() => buildNdpsPatientDose(context, {
      ...EMPTY_NDPS_FORM,
      labelledQuantity: '2',
      administeredQuantity: '0.5',
      residualHandling: 'sealed_quarantine',
    })).toThrow('Record where the sealed residual will be quarantined.');
  });

  it('requires one handling checkbox when medicine remains', () => {
    expect(() => buildNdpsPatientDose(context, {
      ...EMPTY_NDPS_FORM,
      labelledQuantity: '2',
      administeredQuantity: '0.5',
    })).toThrow('Choose whether the remainder should be destroyed or sealed and quarantined.');
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

  it('accepts a per-dose clinical justification when the patient record has no diagnosis', () => {
    const dose = buildNdpsPatientDose({
      ...context,
      clinicalDetails: { ...context.clinicalDetails!, diagnosis: null },
    }, {
      ...EMPTY_NDPS_FORM,
      labelledQuantity: '2',
      administeredQuantity: '2',
      clinicalJustification: 'Severe breakthrough pain',
    });

    expect(dose?.clinicalJustification).toBe('Severe breakthrough pain');
  });

  it('requires that justification only when no diagnosis is recorded', () => {
    expect(() => buildNdpsPatientDose({
      ...context,
      clinicalDetails: { ...context.clinicalDetails!, diagnosis: null },
    }, {
      ...EMPTY_NDPS_FORM,
      labelledQuantity: '2',
      administeredQuantity: '2',
    })).toThrow('Enter the diagnosis or clinical justification for this dose.');
  });
});
