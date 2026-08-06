import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DischargeSummaryDocument } from './discharge-summary-document';
import type { DischargeDocument } from '@/hooks/use-doctor';

// The printed discharge summary. Everything asserted here was a real defect:
// text the doctor typed was dropped from the page whenever structured data
// existed alongside it, and the header column never reached the document at all.

const HOSPITAL = {
  name: 'Green city Hospital',
  tagline: null,
  logoUrl: null,
  showLogo: false,
  headerStyle: 'centered' as const,
  addressLine1: '12 Ring Road',
  addressLine2: null,
  city: 'Pune',
  state: 'MH',
  pincode: '411001',
  country: 'India',
  phone: null,
  altPhone: null,
  email: null,
  website: null,
  registrationNo: null,
  gstin: null,
  accreditation: null,
  footerText: null,
  accentColor: '#0f766e',
  show: { address: true, phone: false, email: false, website: false, tagline: false, registrationNo: false, gstin: false, accreditation: false, footer: false },
};

function makeDoc(over: Partial<DischargeDocument> = {}): DischargeDocument {
  return {
    hospital: HOSPITAL,
    meta: { id: 'ds1', status: 'published', signedAt: null, signerName: null, attestation: null, generatedAt: new Date().toISOString() },
    patient: { name: 'Asha Menon', mrn: 'MRN-1', age: 44, gender: 'female', dob: null, bloodGroup: null, phone: null, address: null, maritalStatus: null, nationality: null },
    emergencyContact: null,
    admission: { admissionDate: null, dischargeDate: null, lengthOfStayDays: 3, ward: 'A', bed: '4', reason: null, chiefComplaint: null, attendingDoctor: 'Dr. Rao', specialization: null },
    allergies: [],
    diagnoses: [],
    vitals: { admission: null, discharge: null },
    procedures: [],
    imaging: [],
    sections: {
      headerNotes: null,
      diagnosesText: null,
      hospitalCourse: null,
      keyLabs: null,
      labResults: null,
      medicationsText: null,
      dischargeInstructions: null,
      followUpDate: null,
      followUpInstructions: null,
    },
    medications: [],
    ...over,
  } as DischargeDocument;
}

describe('DischargeSummaryDocument', () => {
  // Was `medications.length ? table : text` — so a hand-written medication note
  // vanished the moment the stay had any prescription, which is almost always.
  it('prints typed medication text alongside the prescribed table', () => {
    render(
      <DischargeSummaryDocument
        doc={makeDoc({
          medications: [
            { drug: 'Amoxicillin', dosage: '500mg', frequency: '1-1-1', duration: '5 days', route: 'oral', instructions: null },
          ],
          sections: { ...makeDoc().sections, medicationsText: 'Stop metformin until review.' },
        })}
      />,
    );

    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    expect(screen.getByText(/Stop metformin until review/)).toBeInTheDocument();
  });

  it('still says so when there are no medications at all', () => {
    render(<DischargeSummaryDocument doc={makeDoc()} />);
    expect(screen.getByText(/No discharge medications prescribed/)).toBeInTheDocument();
  });

  // The header column carries the "general" pin bucket. It was never included
  // in the document payload, so none of it could print.
  it('prints the doctor notes held on the header column', () => {
    render(
      <DischargeSummaryDocument
        doc={makeDoc({
          sections: { ...makeDoc().sections, headerNotes: 'Family counselled about diet.' },
        })}
      />,
    );

    expect(screen.getByText(/Family counselled about diet/)).toBeInTheDocument();
  });

  it('omits the summary section when the doctor added nothing', () => {
    render(<DischargeSummaryDocument doc={makeDoc()} />);
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
  });

  // Labs arrive already grouped by day from the server; the document must print
  // that structure rather than collapsing the whitespace out of it.
  it('keeps the date grouping in the lab block', () => {
    render(
      <DischargeSummaryDocument
        doc={makeDoc({
          sections: {
            ...makeDoc().sections,
            labResults: '05/08/2026\n- CBC: Hb = 11 g/dL\n\n04/08/2026\n- CBC: Hb = 9 g/dL',
          },
        })}
      />,
    );

    const block = screen.getByText(/05\/08\/2026/);
    expect(block).toHaveTextContent('04/08/2026');
    expect(block.className).toMatch(/whitespace-pre-wrap/);
  });
});
