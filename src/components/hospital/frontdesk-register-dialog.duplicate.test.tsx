import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// The dialog's data hooks are not what is under test here.
vi.mock('@/hooks/use-hospital', () => ({
  usePatientSearch: () => ({ data: [], isLoading: false }),
  useDoctorsList: () => ({ data: [], isLoading: false }),
  useAvailableSlots: () => ({ data: [], isLoading: false }),
}));

const apiPost = vi.fn();
const apiGet = vi.fn();
const apiPatch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPatch: (...a: unknown[]) => apiPatch(...a),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

import { FrontDeskRegisterDialog } from './frontdesk-register-dialog';

/** The shape the API returns when registration matches somebody already on file. */
function duplicateError() {
  return {
    response: {
      data: {
        success: false,
        message: 'Dup Probe is already registered at this hospital as MRN-20260821-0003.',
        code: 'DUPLICATE_PATIENT',
        details: {
          patient: {
            id: 'existing-1',
            mrn: 'MRN-20260821-0003',
            firstName: 'Dup',
            lastName: 'Probe',
            dateOfBirth: '1990-01-01T00:00:00.000Z',
            gender: 'male',
            phone: '9555444333',
          },
        },
      },
    },
  };
}

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FrontDeskRegisterDialog open onOpenChange={vi.fn()} initialMode="new" />
    </QueryClientProvider>,
  );
}

/** Fill the three fields the form requires — gender already defaults to male. */
async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/first name/i), 'Dup');
  await user.type(screen.getByLabelText(/last name/i), 'Probe');
  await user.type(screen.getByLabelText(/phone/i), '9555444333');
  await user.click(screen.getByRole('button', { name: /register patient/i }));
}

describe('FrontDeskRegisterDialog — duplicate confirmation', () => {
  beforeEach(() => {
    apiPost.mockReset();
    apiGet.mockReset();
    apiPatch.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    // Phone lookup runs on a debounce; nobody owns this number.
    apiGet.mockResolvedValue({ data: [] });
  });

  // Registering the same person again used to just file them as another
  // relative — three attempts, three MRNs for one patient. The desk is now
  // shown the record it matched and decides what to do with it.
  it('shows the matched patient instead of an error toast', async () => {
    const user = userEvent.setup({ delay: null });
    apiPost.mockRejectedValue(duplicateError());
    renderDialog();

    await fillAndSubmit(user);

    expect(await screen.findByText(/did you mean this patient\?/i)).toBeInTheDocument();
    // The record itself, so the desk can recognise it without going to search.
    expect(screen.getByText('Dup Probe')).toBeInTheDocument();
    expect(screen.getByText(/MRN-20260821-0003/)).toBeInTheDocument();
    // A toast would have scrolled away and told them nothing they could act on.
    expect(toastError).not.toHaveBeenCalled();
  });

  it('retries with the override when the desk registers anyway', async () => {
    const user = userEvent.setup({ delay: null });
    apiPost.mockRejectedValue(duplicateError());
    renderDialog();
    await fillAndSubmit(user);
    await screen.findByText(/did you mean this patient\?/i);

    apiPost.mockResolvedValueOnce({ data: { id: 'new-1', mrn: 'MRN-NEW' } });
    await user.click(screen.getByRole('button', { name: /register anyway/i }));

    // Twins, or a father and son sharing a birthday, do exist.
    await waitFor(() => {
      const last = apiPost.mock.calls.at(-1);
      expect(last?.[0]).toBe('/patients');
      expect(last?.[1]).toMatchObject({ allowDuplicate: true });
    });
  });

  it('does not register again when the desk uses the existing patient', async () => {
    const user = userEvent.setup({ delay: null });
    apiPost.mockRejectedValue(duplicateError());
    renderDialog();
    await fillAndSubmit(user);
    await screen.findByText(/did you mean this patient\?/i);
    const callsBefore = apiPost.mock.calls.length;

    await user.click(screen.getByRole('button', { name: /use this patient/i }));

    await waitFor(() =>
      expect(screen.queryByText(/did you mean this patient\?/i)).not.toBeInTheDocument(),
    );
    expect(apiPost.mock.calls.length).toBe(callsBefore);
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('MRN-20260821-0003'));
  });

  // The override is meant to authorise ONE registration. If the retry fails for
  // some unrelated reason it used to stay armed for the rest of the dialog, so
  // the next submit — after editing the form to a different person — skipped
  // the duplicate check entirely.
  it('does not stay armed when the retry fails for another reason', async () => {
    const user = userEvent.setup({ delay: null });
    apiPost.mockRejectedValue(duplicateError());
    renderDialog();
    await fillAndSubmit(user);
    await screen.findByText(/did you mean this patient\?/i);

    // Register anyway, and this attempt fails on something else entirely.
    apiPost.mockRejectedValueOnce({ response: { data: { message: 'Network down' } } });
    await user.click(screen.getByRole('button', { name: /register anyway/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Network down'));

    // An ordinary submit after that must be checked against duplicates again.
    apiPost.mockResolvedValueOnce({ data: { id: 'new-1', mrn: 'MRN-NEW' } });
    await user.click(screen.getByRole('button', { name: /register patient/i }));

    await waitFor(() => {
      expect(apiPost.mock.calls.at(-1)?.[1]).not.toHaveProperty('allowDuplicate');
    });
  });

  it('leaves ordinary failures as a toast', async () => {
    const user = userEvent.setup({ delay: null });
    apiPost.mockRejectedValue({ response: { data: { message: 'Something broke' } } });
    renderDialog();

    await fillAndSubmit(user);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Something broke'));
    expect(screen.queryByText(/did you mean this patient\?/i)).not.toBeInTheDocument();
  });
});
