import { describe, it, expect } from 'vitest';
import { patientPickerSubtitle } from './patient-picker-label';
import type { GlobalPatientMatch } from '@/hooks/use-hospital';

const m = (over: Partial<GlobalPatientMatch>): GlobalPatientMatch => ({
  sourcePatientId: 'src', localPatientId: 'loc', isLocal: true,
  firstName: 'Ravi', lastName: 'Kumar', dateOfBirth: null, gender: 'male',
  phone: '9876543210', mrn: 'MRN-20261119-0001', hospital: 'City Hospital',
  ...over,
});

describe('patientPickerSubtitle (gap 332)', () => {
  it('shows the MRN and phone, never an internal id', () => {
    const a = m({});
    expect(patientPickerSubtitle(a, [a])).toBe('MRN-20261119-0001 · 9876543210');
  });

  it('adds the DOB only when names collide', () => {
    const a = m({ dateOfBirth: '1980-02-03T00:00:00.000Z' });
    const b = m({ sourcePatientId: 'other', mrn: 'MRN-2', dateOfBirth: '2001-07-08T00:00:00.000Z' });
    expect(patientPickerSubtitle(a, [a, b])).toBe('MRN-20261119-0001 · 9876543210 · DOB 03/02/1980');
  });

  it('names the hospital for a patient registered elsewhere', () => {
    const a = m({ isLocal: false, localPatientId: null, mrn: 'MRN-X' });
    expect(patientPickerSubtitle(a, [a])).toBe('at City Hospital · 9876543210');
  });
});
