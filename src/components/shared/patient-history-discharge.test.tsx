import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PatientHistoryPanel } from './patient-history-panel';

// "Past discharge summary is not available in the patient history view."
//
// The backend half is verified against the real database. This is the half
// that was never checked: that the tab is reachable from the panel the doctor
// opens mid-consultation, and that a row actually renders with the date the
// API now returns rather than the words "Not yet discharged".

const mockGet = vi.fn();
vi.mock('@/lib/api', () => ({
  apiGet: (...a: unknown[]) => mockGet(...a),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

// What GET /mrd/discharge-summary/by-patient/:id returns after the fix — the
// discharge date coalesced from the admission.
const SUMMARIES = [
  {
    id: 'ds-1',
    status: 'published',
    admissionId: 'adm-1',
    admissionType: 'ip',
    admissionDate: '2026-07-09T00:00:00.000Z',
    dischargeDate: '2026-07-11T09:40:00.000Z',
    diagnosesSummary: '- [primary] Fever (100)',
    doctorName: 'Meera Iyer',
    createdAt: '2026-07-11T10:00:00.000Z',
  },
  {
    id: 'ds-2',
    status: 'draft',
    admissionId: 'adm-2',
    admissionType: 'daycare',
    admissionDate: '2026-08-20T00:00:00.000Z',
    dischargeDate: null,
    diagnosesSummary: null,
    doctorName: 'Meera Iyer',
    createdAt: '2026-08-20T10:00:00.000Z',
  },
];

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PatientHistoryPanel patientId="pat-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockImplementation(async (url: string) => {
    if (url.includes('discharge-summary/by-patient')) return { data: SUMMARIES };
    return { data: null };
  });
});

describe('past discharge summaries in the patient history panel', () => {
  it('offers the tab from the panel the doctor opens mid-consultation', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /Discharge Summaries/i })).toBeInTheDocument();
  });

  it('asks the API for this patient’s summaries when the tab is opened', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Discharge Summaries/i }));

    expect(mockGet).toHaveBeenCalledWith('/mrd/discharge-summary/by-patient/pat-1');
  });

  it('shows a past stay by its discharge date, not as "Not yet discharged"', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Discharge Summaries/i }));

    // The bug: every past summary was headlined "Not yet discharged" because
    // the stored dischargeDate was always null.
    await waitFor(() => expect(document.body.textContent).toContain('Under Meera Iyer'));
    expect(document.body.textContent).toContain('11/07/2026');
    expect(document.body.textContent).toContain('admitted 09/07/2026');
    // Exactly one "Not yet discharged" — the stay that genuinely has not ended.
    expect(document.body.textContent?.match(/Not yet discharged/g) ?? []).toHaveLength(1);
  });

  it('marks a summary that is still being written as unfinished', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Discharge Summaries/i }));

    expect(await screen.findByText(/draft/i)).toBeInTheDocument();
  });

  it('says so plainly when the patient has none', async () => {
    mockGet.mockImplementation(async () => ({ data: [] }));
    renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Discharge Summaries/i }));

    expect(await screen.findByText(/No discharge summaries on file/i)).toBeInTheDocument();
  });
});
