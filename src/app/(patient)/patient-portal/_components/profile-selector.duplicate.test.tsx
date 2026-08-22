import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const apiPost = vi.fn();
vi.mock('@/lib/api', () => ({
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiGet: vi.fn(),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

// The switcher lists one entry per PERSON, so the row the API matched is not
// always the row the list shows — here the lead entry has a different id.
const selectProfile = vi.fn();
const PROFILES = [
  { id: 'lead-1', mrn: 'MRN-LEAD', firstName: 'Riya', lastName: 'Portal', relationship: 'child' },
];
vi.mock('@/stores/patient-profile-store', () => ({
  usePatientProfileStore: (sel: (s: unknown) => unknown) =>
    sel({ profiles: PROFILES, selectProfile }),
}));

import { AddProfileDialog } from './profile-selector';

/** The shape the API returns when the person is already on the account. */
function duplicateError() {
  return {
    response: {
      data: {
        success: false,
        message: 'Riya Portal is already one of your profiles (MRN-20260821-0003).',
        code: 'DUPLICATE_PATIENT',
        details: {
          patient: {
            id: 'row-3',
            mrn: 'MRN-20260821-0003',
            firstName: 'Riya',
            lastName: 'Portal',
            dateOfBirth: '2016-04-05T00:00:00.000Z',
            gender: 'female',
            phone: null,
            relationship: 'child',
          },
        },
      },
    },
  };
}

const onOpenChange = vi.fn();
function renderDialog(onCreated = vi.fn()) {
  return render(<AddProfileDialog open onOpenChange={onOpenChange} onCreated={onCreated} />);
}

/**
 * The dialog's labels are not wired to their inputs, so getByLabelText cannot
 * find them — take the input sitting in the same field group as the label.
 */
function fieldFor(text: RegExp): HTMLInputElement {
  const label = screen.getAllByText(text).find((el) => el.tagName === 'LABEL');
  const input = label?.parentElement?.querySelector('input');
  if (!input) throw new Error(`no input found for ${text}`);
  return input as HTMLInputElement;
}

async function fillAndAdd(user: ReturnType<typeof userEvent.setup>) {
  await user.type(fieldFor(/^First Name/i), 'Riya');
  await user.click(screen.getByRole('button', { name: /add profile/i }));
}

describe('AddProfileDialog — duplicate confirmation', () => {
  beforeEach(() => {
    apiPost.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    selectProfile.mockReset();
    onOpenChange.mockReset();
  });

  // Adding the same child twice used to mint a second profile and a second MRN
  // for one person, and the switcher hid it, so it kept happening unnoticed.
  it('shows the matched profile instead of an error toast', async () => {
    const user = userEvent.setup({ delay: null });
    apiPost.mockRejectedValue(duplicateError());
    renderDialog();

    await fillAndAdd(user);

    expect(await screen.findByText(/did you mean this profile\?/i)).toBeInTheDocument();
    expect(screen.getByText(/MRN-20260821-0003/)).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('switches to the entry the list actually shows, not the matched row', async () => {
    const user = userEvent.setup({ delay: null });
    apiPost.mockRejectedValue(duplicateError());
    renderDialog();
    await fillAndAdd(user);
    await screen.findByText(/did you mean this profile\?/i);

    await user.click(screen.getByRole('button', { name: /use this profile/i }));

    // 'row-3' is a collapsed row the switcher cannot highlight; 'lead-1' is the
    // entry standing for that person.
    expect(selectProfile).toHaveBeenCalledWith('lead-1');
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('Riya Portal'));
    // And the dialog gets out of the way.
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('retries with the override when they add anyway', async () => {
    const user = userEvent.setup({ delay: null });
    apiPost.mockRejectedValue(duplicateError());
    renderDialog();
    await fillAndAdd(user);
    await screen.findByText(/did you mean this profile\?/i);

    apiPost.mockResolvedValueOnce({ data: { id: 'new-1' } });
    await user.click(screen.getByRole('button', { name: /add anyway/i }));

    await waitFor(() => {
      const last = apiPost.mock.calls.at(-1);
      expect(last?.[0]).toBe('/patient-portal/profiles');
      expect(last?.[1]).toMatchObject({ allowDuplicate: true });
    });
  });

  it('does not carry the override into the next add', async () => {
    const user = userEvent.setup({ delay: null });
    apiPost.mockRejectedValue(duplicateError());
    renderDialog();
    await fillAndAdd(user);
    await screen.findByText(/did you mean this profile\?/i);

    apiPost.mockResolvedValueOnce({ data: { id: 'new-1' } });
    await user.click(screen.getByRole('button', { name: /add anyway/i }));
    await waitFor(() => expect(apiPost.mock.calls.at(-1)?.[1]).toMatchObject({ allowDuplicate: true }));

    // A second, unrelated add must be checked again — otherwise one override
    // would wave every later duplicate through.
    apiPost.mockResolvedValueOnce({ data: { id: 'new-2' } });
    await user.click(screen.getByRole('button', { name: /add profile/i }));

    await waitFor(() => {
      expect(apiPost.mock.calls.at(-1)?.[1]).not.toHaveProperty('allowDuplicate');
    });
  });

  // The override authorises ONE add. If the retry fails for some unrelated
  // reason it used to stay armed for the rest of the dialog, so the next add —
  // after editing the form to a different person — skipped the check entirely.
  it('does not stay armed when the retry fails for another reason', async () => {
    const user = userEvent.setup({ delay: null });
    apiPost.mockRejectedValue(duplicateError());
    renderDialog();
    await fillAndAdd(user);
    await screen.findByText(/did you mean this profile\?/i);

    apiPost.mockRejectedValueOnce({ response: { data: { message: 'Network down' } } });
    await user.click(screen.getByRole('button', { name: /add anyway/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Network down'));

    apiPost.mockResolvedValueOnce({ data: { id: 'new-1' } });
    await user.click(screen.getByRole('button', { name: /add profile/i }));

    await waitFor(() => {
      expect(apiPost.mock.calls.at(-1)?.[1]).not.toHaveProperty('allowDuplicate');
    });
  });

  it('leaves ordinary failures as a toast', async () => {
    const user = userEvent.setup({ delay: null });
    apiPost.mockRejectedValue({ response: { data: { message: 'Something broke' } } });
    renderDialog();

    await fillAndAdd(user);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Something broke'));
    expect(screen.queryByText(/did you mean this profile\?/i)).not.toBeInTheDocument();
  });
});
