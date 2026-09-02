import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The banner the front desk reads before booking: has this patient been here
 * before, when, and is the one-time registration fee due.
 *
 * It carries a money decision, so it is pinned on what it SAYS rather than how
 * it looks — and the numbers it says were wrong. "N visits" added the
 * Appointment, Visit and Admission rows of the SAME attendance together, so a
 * patient who had been in ten times was shown as fifteen.
 */

const status = { current: {} as Record<string, unknown> };
vi.mock('@/hooks/use-registration-fee', () => ({
  usePatientVisitStatus: () => ({ data: status.current, isLoading: false }),
}));

import { PatientVisitPanel } from './create-appointment-dialog';

const SETTINGS = { enabled: true, amount: 600, gstRatePercent: 10, label: 'Registration Fee', oncePerPatient: true };

function base(over: Record<string, unknown> = {}) {
  return {
    patientId: 'p1',
    isFirstVisit: false,
    lastVisitAt: '2026-07-22T09:00:00.000Z',
    lastVisitKind: 'visit',
    priorEncounters: 7,
    registrationFeeCharged: false,
    registrationFeeChargedAt: null,
    settings: SETTINGS,
    suggestCharge: false,
    ...over,
  };
}

const renderPanel = (charge: boolean | null = false, onChange = vi.fn()) =>
  render(<PatientVisitPanel patientId="p1" chargeRegistration={charge} onChangeCharge={onChange} />);

beforeEach(() => {
  vi.clearAllMocks();
  status.current = base();
});

describe('the front desk visit banner', () => {
  it('shows when the patient was last here, and how many times', () => {
    renderPanel();
    expect(screen.getByText('Existing patient')).toBeInTheDocument();
    // dd/MM/yyyy — the house format everywhere in this app.
    expect(screen.getByText(/22\/07\/2026/)).toBeInTheDocument();
    // Exact, not /7/ — that also matches the 7 inside "22/07/2026".
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText(/visits here/)).toBeInTheDocument();
  });

  it('names the kind of encounter, so "last visit" means something', () => {
    // A row can be an appointment, a walk-in visit or an admission; saying which
    // is the difference between "they were seen" and "they were admitted".
    status.current = base({ lastVisitKind: 'admission' });
    renderPanel();
    expect(screen.getByText(/Last admitted/)).toBeInTheDocument();
  });

  it('says visit, singular, when there has only been one', () => {
    status.current = base({ priorEncounters: 1 });
    renderPanel();
    expect(screen.getByText(/visit here/)).toBeInTheDocument();
    expect(screen.queryByText(/visits here/)).not.toBeInTheDocument();
  });

  it('calls a first-timer out instead of showing a visit history', () => {
    status.current = base({ isFirstVisit: true, lastVisitAt: null, priorEncounters: 0 });
    renderPanel();
    expect(screen.getByText('First visit to this hospital')).toBeInTheDocument();
    expect(screen.queryByText(/Last /)).not.toBeInTheDocument();
  });

  it('shows the fee inclusive of tax, which is what lands on the bill', () => {
    renderPanel();
    // 600 + 10% = 660.00
    expect(screen.getByText(/660\.00/)).toBeInTheDocument();
  });

  it('lets the desk tick the fee on for a returning patient who never paid it', () => {
    const onChange = vi.fn();
    renderPanel(false, onChange);
    return userEvent.click(screen.getByRole('checkbox')).then(() => {
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  it('locks the fee once it has been taken, and says when', () => {
    status.current = base({ registrationFeeCharged: true, registrationFeeChargedAt: '2026-05-18T06:00:00.000Z' });
    renderPanel();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText(/Already charged on 18\/05\/2026/)).toBeInTheDocument();
  });

  it('lets the fee be charged again where the hospital allows it, and says it was charged before', () => {
    // With once-per-patient off the fee may be taken more than once, so the box
    // stays tickable — but the desk is told it has been taken before, or a
    // repeat charge looks like a mistake to whoever reads the bill later.
    status.current = base({
      settings: { ...SETTINGS, oncePerPatient: false },
      registrationFeeCharged: true,
      registrationFeeChargedAt: '2026-05-18T06:00:00.000Z',
    });
    renderPanel();
    expect(screen.getByRole('checkbox')).not.toBeDisabled();
    expect(screen.getByText(/Charged before on 18\/05\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/allows it more than once/)).toBeInTheDocument();
  });

  it('says nothing about a fee the hospital does not charge', () => {
    status.current = base({ settings: { ...SETTINGS, enabled: false } });
    renderPanel();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('Existing patient')).toBeInTheDocument();
  });
});
