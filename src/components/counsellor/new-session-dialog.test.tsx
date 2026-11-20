import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewSessionDialog } from './new-session-dialog';

// Gap #298: New Session opened the doctor New Appointment dialog. This is the
// counselling form that replaced it.

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

// The real picker searches /patients; here it is one button that picks Ravi.
vi.mock('@/components/doctor/patient-visit-picker', () => ({
  PatientVisitPicker: ({ onSelectPatient }: { onSelectPatient: (p: unknown) => void }) => (
    <button type="button" onClick={() => onSelectPatient({ id: 'pat-1', firstName: 'Ravi', lastName: 'Kumar', mrn: 'MRN-1' })}>
      Pick Ravi
    </button>
  ),
}));

const mutateAsync = vi.fn();
vi.mock('@/hooks/use-counselling', async (orig) => ({
  ...(await orig<typeof import('@/hooks/use-counselling')>()),
  useCounsellors: () => ({
    data: [
      { id: 'c-1', firstName: 'Asha', lastName: 'Menon', isCounsellor: true },
      { id: 'c-2', firstName: 'Admin', lastName: 'User', isCounsellor: false },
    ],
    isLoading: false,
  }),
  useCreateCounsellingSession: () => ({ mutateAsync, isPending: false }),
}));

const onOpenChange = vi.fn();
const onCreated = vi.fn();

function renderDialog() {
  return render(
    <NewSessionDialog open onOpenChange={onOpenChange} defaultDate="2026-11-21" onCreated={onCreated} />,
  );
}

async function fillValid() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Pick Ravi' }));
  await user.selectOptions(screen.getByLabelText(/Session type/), 'pre_admission_financial');
  await user.selectOptions(screen.getByLabelText(/Counsellor/), 'c-1');
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('New Counselling Session dialog', () => {
  it('is a counselling form, not New Appointment', () => {
    renderDialog();
    expect(screen.getByText('New Counselling Session')).toBeInTheDocument();
    expect(screen.queryByText('New Appointment')).not.toBeInTheDocument();
    expect(screen.queryByText(/Doctor/)).not.toBeInTheDocument();
  });

  it('shows field errors inline and does not call the API', async () => {
    renderDialog();
    // The single real counsellor is preselected; clear it to test that error too.
    await userEvent.selectOptions(screen.getByLabelText(/Counsellor/), '');
    await userEvent.click(screen.getByRole('button', { name: 'Book Session' }));

    expect(await screen.findByText('Pick a patient')).toBeInTheDocument();
    expect(screen.getByText('Pick a session type')).toBeInTheDocument();
    expect(screen.getByText('Pick a counsellor')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('books a pending session at the IST time chosen and closes', async () => {
    mutateAsync.mockResolvedValue({ id: 's-1', status: 'pending' });
    renderDialog();
    const user = await fillValid();
    await user.type(screen.getByLabelText('Notes'), 'Package estimate');
    await user.click(screen.getByRole('button', { name: 'Book Session' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      patientId: 'pat-1',
      counsellorId: 'c-1',
      sessionType: 'pre_admission_financial',
      // 10:00 IST on the page's day, whatever zone the test runner is in.
      scheduledAt: '2026-11-21T04:30:00.000Z',
      notes: 'Package estimate',
      kind: 'session',
      referralSource: undefined,
    });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith({ id: 's-1', status: 'pending' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows an API failure on its field with no success toast', async () => {
    mutateAsync.mockRejectedValue({
      response: { data: { message: 'Pick an active counsellor of this hospital', details: { field: 'counsellorId' } } },
    });
    renderDialog();
    const user = await fillValid();
    await user.click(screen.getByRole('button', { name: 'Book Session' }));

    expect(await screen.findByText('Pick an active counsellor of this hospital')).toBeInTheDocument();
    expect(toastError).toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('pins a server validation error to its field', async () => {
    mutateAsync.mockRejectedValue({
      response: { data: { message: 'Validation error', errors: [{ field: 'body.scheduledAt', message: 'Invalid date and time' }] } },
    });
    renderDialog();
    const user = await fillValid();
    await user.click(screen.getByRole('button', { name: 'Book Session' }));

    expect(await screen.findByText('Invalid date and time')).toBeInTheDocument();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('records a referral and asks who referred', async () => {
    mutateAsync.mockResolvedValue({ id: 's-2', status: 'pending', kind: 'referral' });
    renderDialog();
    const user = await fillValid();
    await user.click(screen.getByLabelText('This is a referral'));
    await user.click(screen.getByRole('button', { name: 'Add Referral' }));
    expect(await screen.findByText('Say who referred the patient')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Referred by/), 'Dr. Mehta');
    await user.click(screen.getByRole('button', { name: 'Add Referral' }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ kind: 'referral', referralSource: 'Dr. Mehta' })),
    );
  });
});
