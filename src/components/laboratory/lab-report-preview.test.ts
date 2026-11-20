import { describe, it, expect } from 'vitest';
import { letterheadLines } from './lab-report-preview';
import type { HospitalBranding } from '@/hooks/use-hospital-branding';

const base = {
  name: 'City Care Hospital', addressLine1: '12 MG Road', addressLine2: null, city: 'Pune', state: 'MH', pincode: '411001',
  phone: '020-1234', email: 'desk@citycare.in', accreditation: null,
  show: { tagline: true, address: true, phone: true, email: true, website: true, registrationNo: true, gstin: true, accreditation: true, footer: true },
} as unknown as HospitalBranding;

describe('lab report preview letterhead (gap 374)', () => {
  it("uses the hospital's own details and no sample text", () => {
    const h = letterheadLines(base);
    expect(h.name).toBe('City Care Hospital');
    expect(h.address).toContain('12 MG Road');
    expect(h.contact).toContain('desk@citycare.in');
    expect(JSON.stringify(h)).not.toMatch(/Sample Hospital|123 Care Street|NABL/);
  });

  it('shows NABL only when the hospital has set it', () => {
    expect(letterheadLines({ ...base, accreditation: 'NABL Accredited' }).contact).toContain('NABL Accredited');
  });

  it('falls back to a neutral header without a hospital', () => {
    expect(letterheadLines(null).address).toBe('');
  });
});
