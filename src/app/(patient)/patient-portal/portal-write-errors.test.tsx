import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppointmentsPage from './appointments/page';

// Every write in the patient portal failed silently. The mutations had
// `onSuccess` and no `onError`, and the pages imported no toast at all — so a
// rejected save did nothing observable.
//
// This is the same defect the clinician-side history panel had (C11); that fix
// covered the doctor's panel and never looked at the patient's own pages.

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

const apiPost = vi.fn();
vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(async () => ({ data: [APPOINTMENT] })),
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('@/stores/patient-profile-store', () => ({
  usePatientProfileStore: () => ({ activeProfileId: 'pat-1' }),
}));

/**
 * Dated RELATIVE to today, never hardcoded.
 *
 * This fixture said '2026-09-01'. The page's default filter is "upcoming", and
 * isPastAppointment() calls anything before today past — so on 2026-09-01 the
 * appointment would have dropped out of the list, the Cancel button would never
 * render, and both tests here would have failed for good. A fixture with an
 * expiry date is a test that reports a bug that is not there.
 */
const daysFromToday = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const APPOINTMENT = {
  id: 'appt-1',
  appointmentDate: daysFromToday(30),
  startTime: '10:00',
  status: 'booked',
  doctor: { user: { firstName: 'Meera', lastName: 'Iyer' } },
  tenant: { name: 'Green city Hospital' },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AppointmentsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cancelling an appointment in the portal', () => {
  it('tells the patient when the cancellation failed', async () => {
    apiPost.mockRejectedValue(new Error('Network error'));
    renderPage();

    // The button renders only once the appointments query resolves. findBy
    // defaults to 1s, which the full suite running 50 files in parallel can
    // genuinely exceed — that is what made this test flaky, not the component.
    const cancel = await screen.findByRole('button', { name: /cancel/i }, { timeout: 5000 });
    await userEvent.click(cancel);

    // A silent failure here is the worst of the portal writes: the patient
    // believes they have cancelled and does not turn up, while the slot stays
    // booked and the desk is still expecting them.
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it('confirms when it worked, so the patient knows it landed', async () => {
    apiPost.mockResolvedValue({ data: {} });
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: /cancel/i }, { timeout: 5000 }),
    );

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
  });
});
