import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mock apiClient (apiGet/apiPut in @/lib/api delegate to it) ───
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
vi.mock('@/lib/api-client', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import MedicalHistoryPage from '@/app/(patient)/patient-portal/medical-history/page';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MedicalHistoryPage />
    </QueryClientProvider>,
  );
}

describe('Patient portal — Medical History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: { success: true, data: {} } });
    mockPut.mockResolvedValue({ data: { success: true, data: {} } });
  });

  // Regression: TextField / SelectField used to be declared INSIDE PersonalTab's
  // render body. Every keystroke ran setForm → PersonalTab re-rendered → the
  // component functions got a fresh identity → React unmounted and remounted the
  // <input>, so the field lost focus after each character and only the last one
  // survived. The tab was unusable for typing.
  it('keeps focus in a text field across multiple keystrokes', async () => {
    const user = userEvent.setup();
    renderPage();

    const appetite = await screen.findByLabelText('Appetite');
    await user.click(appetite);
    await user.keyboard('poor');

    expect(appetite).toHaveFocus();
    expect(appetite).toHaveValue('poor');
  });

  it('keeps focus in a textarea across multiple keystrokes', async () => {
    const user = userEvent.setup();
    renderPage();

    const notes = await screen.findByLabelText('Notes');
    await user.click(notes);
    await user.keyboard('no complaints');

    expect(notes).toHaveFocus();
    expect(notes).toHaveValue('no complaints');
  });

  // Only the fields the patient actually touched are sent — the backend upsert
  // is a partial merge shared with the clinician side, so posting untouched
  // fields would blank out what a doctor entered.
  it('saves only the edited fields', async () => {
    const user = userEvent.setup();
    renderPage();

    const diet = await screen.findByLabelText('Diet');
    await user.click(diet);
    await user.keyboard('vegetarian');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockPut).toHaveBeenCalled());
    expect(mockPut).toHaveBeenCalledWith(
      '/patient-portal/medical-history/personal',
      { diet: 'vegetarian' },
      undefined,
    );
  });

  // A cleared dropdown must write null, not '' — "no answer" has to stay
  // distinguishable from an empty string on a nullable column.
  it('writes null when a choice is cleared', async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue({ data: { success: true, data: { smokingStatus: 'current' } } });
    renderPage();

    const smoking = await screen.findByLabelText('Smoking');
    await user.selectOptions(smoking, '');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockPut).toHaveBeenCalled());
    expect(mockPut).toHaveBeenCalledWith(
      '/patient-portal/medical-history/personal',
      { smokingStatus: null },
      undefined,
    );
  });
});
