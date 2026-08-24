import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NurseIntakeComplaint } from './nurse-intake-complaint';

// The nurse's intake complaint has been stored on the Visit for a while, and
// the nurse writes it from the vitals screen. The doctor's half was built into
// `SoapNoteFormDialog`, which has zero call sites — so it rendered nowhere and
// the doctor never saw one. This is the panel that goes on the surfaces a
// doctor actually uses.

const useVisit = vi.fn();
vi.mock('@/hooks/use-clinical', () => ({
  useVisit: (...a: unknown[]) => useVisit(...a),
}));

const visit = (over: Record<string, unknown> = {}) => ({
  data: {
    id: 'visit-1',
    nurseChiefComplaint: 'Chest pain since this morning, worse on climbing stairs',
    nurseChiefComplaintAt: '2026-08-24T04:30:00.000Z',
    nurseChiefComplaintBy: { id: 'u1', firstName: 'Asha', lastName: 'Rao' },
    ...over,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  useVisit.mockReturnValue(visit());
});

describe('NurseIntakeComplaint', () => {
  it('shows the nurse’s words to the doctor', () => {
    render(<NurseIntakeComplaint visitId="visit-1" />);
    expect(screen.getByText(/Chest pain since this morning/)).toBeInTheDocument();
    expect(screen.getByText(/Recorded at intake/)).toBeInTheDocument();
  });

  it('names who recorded it — the point of a separate field is knowing who said what', () => {
    render(<NurseIntakeComplaint visitId="visit-1" />);
    expect(screen.getByText(/by Asha Rao/)).toBeInTheDocument();
  });

  it('falls back to "by nursing" when the recorder cannot be named', () => {
    useVisit.mockReturnValue(visit({ nurseChiefComplaintBy: null }));
    render(<NurseIntakeComplaint visitId="visit-1" />);
    expect(screen.getByText(/by nursing/)).toBeInTheDocument();
  });

  it('renders nothing when nursing recorded no complaint', () => {
    useVisit.mockReturnValue(visit({ nurseChiefComplaint: null }));
    const { container } = render(<NurseIntakeComplaint visitId="visit-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the complaint is only whitespace', () => {
    useVisit.mockReturnValue(visit({ nurseChiefComplaint: '   ' }));
    const { container } = render(<NurseIntakeComplaint visitId="visit-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hands the text to the doctor’s own field rather than editing the nurse’s', async () => {
    const onUse = vi.fn();
    render(<NurseIntakeComplaint visitId="visit-1" onUse={onUse} currentValue="" />);

    await userEvent.click(screen.getByRole('button', { name: /use this/i }));

    // The nurse's record is never written to — the doctor's box receives a copy
    // and is theirs to rewrite. Two separate statements, both kept.
    expect(onUse).toHaveBeenCalledWith(
      'Chest pain since this morning, worse on climbing stairs',
    );
  });

  it('does not offer to copy text the doctor already has', () => {
    render(
      <NurseIntakeComplaint
        visitId="visit-1"
        onUse={vi.fn()}
        currentValue="Chest pain since this morning, worse on climbing stairs"
      />,
    );
    expect(screen.queryByRole('button', { name: /use this/i })).not.toBeInTheDocument();
  });

  it('is read-only — there is no way to edit the nurse’s text here', () => {
    render(<NurseIntakeComplaint visitId="visit-1" onUse={vi.fn()} currentValue="" />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('asks for nothing when there is no visit to ask about', () => {
    useVisit.mockReturnValue({ data: null });
    const { container } = render(<NurseIntakeComplaint visitId={null} />);
    expect(useVisit).toHaveBeenCalledWith(null);
    expect(container).toBeEmptyDOMElement();
  });
});
