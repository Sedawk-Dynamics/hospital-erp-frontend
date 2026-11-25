import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { InsuranceClaim } from '@/hooks/use-insurance';
import { ClaimWorkflowPanel } from './claim-workflow-panel';

// Gap 294 (retest): a stale payer query can be closed with a reason from the
// claim's Queries tab; closed queries stop counting as open.

const apiPatch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: (...a: unknown[]) => apiPatch(...a),
  apiDelete: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const day = 24 * 3600_000;
function claimWith(queries: NonNullable<InsuranceClaim['queries']>): InsuranceClaim {
  return { id: 'cl-1', claimNumber: 'CLM-1', claimAmount: 1000, approvedAmount: 0, status: 'query_raised', queries } as unknown as InsuranceClaim;
}
const baseQuery = {
  id: 'q1', queryReference: 'TPA-9', subject: 'Discharge summary missing', queryText: 'Please send the summary',
  raisedAt: new Date(Date.now() - 3 * day).toISOString(), responseText: null, respondedAt: null, resolvedAt: null,
};

function renderPanel(claim: InsuranceClaim) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ClaimWorkflowPanel claim={claim} /></QueryClientProvider>);
}

beforeEach(() => apiPatch.mockReset());

describe('ClaimWorkflowPanel — close a stale payer query (gap 294)', () => {
  it('offers Close with reason only on an overdue open query', () => {
    renderPanel(claimWith([
      { ...baseQuery, id: 'q1', status: 'open', responseDueAt: new Date(Date.now() - day).toISOString() },
      { ...baseQuery, id: 'q2', subject: 'Bills needed', status: 'open', responseDueAt: new Date(Date.now() + day).toISOString() },
    ]));
    expect(screen.getAllByRole('button', { name: 'Close with reason' })).toHaveLength(1);
  });

  it('requires a reason and sends it to the close endpoint', async () => {
    apiPatch.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderPanel(claimWith([{ ...baseQuery, status: 'open', responseDueAt: new Date(Date.now() - day).toISOString() }]));

    await user.click(screen.getByRole('button', { name: 'Close with reason' }));
    const submit = screen.getByRole('button', { name: /Close request/ });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/Reason/), 'Payer closed the file without reply');
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/insurance/claim-queries/q1/close-stale', { reason: 'Payer closed the file without reply' }));
  });

  it('shows a closed query with its reason and leaves it out of the open count', () => {
    renderPanel(claimWith([
      { ...baseQuery, status: 'closed', responseDueAt: new Date(Date.now() - day).toISOString(), closedAt: new Date().toISOString(), closeReason: 'Payer closed the file without reply' },
    ]));
    expect(screen.getByText('Queries (0)')).toBeInTheDocument();
    expect(screen.getByText(/Payer closed the file without reply/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close with reason' })).not.toBeInTheDocument();
  });
});
