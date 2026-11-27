import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { RateListPreview } from '@/hooks/use-gst-rate-list';

// Gap #262 — the list, and an import that changes only what was confirmed.

const role = { slug: 'pharmacy_admin' };
vi.mock('@/stores/auth-store', () => ({ useAuthStore: () => ({ user: { role } }) }));
const previewAsync = vi.fn();
const applyAsync = vi.fn();
vi.mock('@/hooks/use-gst-rate-list', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useRetiredGstRates: () => ({
    isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
    data: {
      asOf: '2026-11-25', allowedRates: [0, 5, 18, 40], allowed: '0%, 5%, 18% or 40%', slabsConfigured: true, total: 1, inStock: 1,
      items: [{
        drugId: 'd1', drugName: 'Oldcillin', strength: '500mg', manufacturer: 'Cipla', hsnCode: '3004', ratePercent: 12,
        source: 'item_master', sourceLabel: 'Set on the medicine', fixedBy: 'Set a rate on the medicine, or use the rate list',
        reason: 'Retired — last legal on 21/09/2025', stockOnHand: 45, stockText: '4 strips + 5 tablets (45 tablets)', isActive: true,
      }],
    },
  }),
  usePreviewGstRateList: () => ({ mutateAsync: previewAsync, isPending: false }),
  useApplyGstRateList: () => ({ mutateAsync: applyAsync, isPending: false }),
}));

import { RetiredGstPanel } from './retired-gst-panel';

const change = (drugId: string, drugName: string) => ({
  drugId, drugName, strength: null, hsnCode: '3004', currentRate: 12, currentTreatment: null,
  currentSourceLabel: '12% from the medicine itself', newRate: 5, newTreatment: null, stockText: '2 strips (20 tablets)',
});
const row = (over: Partial<RateListPreview['rows'][number]>) => ({
  rowNumber: 2, drugCode: null, drugName: null, hsnCode: null, gstPercent: '5', effectiveFrom: null,
  status: 'ready' as const, message: '', matchedBy: 'name' as const, changes: [], ...over,
});
const PREVIEW: RateListPreview = {
  today: '2026-11-25', allowed: '0%, 5%, 18% or 40%', effectiveDateNote: 'A medicine holds one current rate.',
  rows: [
    row({ rowNumber: 2, drugName: 'Oldcillin', changes: [change('d1', 'Oldcillin')] }),
    row({ rowNumber: 3, drugName: 'Oldmycin', changes: [change('d2', 'Oldmycin')] }),
    row({ rowNumber: 4, drugName: 'Nosuch', status: 'unmatched', matchedBy: null, message: 'No medicine in this hospital matches' }),
    row({ rowNumber: 5, drugName: 'Bad', gstPercent: '12', status: 'error', matchedBy: null, message: '12% is not a legal GST rate on 25/11/2026.' }),
  ],
  summary: { total: 4, ready: 2, medicines: 2, unchanged: 0, notDue: 0, unmatched: 1, errors: 1 },
  notCovered: [{ drugId: 'd9', drugName: 'Leftover', hsnCode: null, ratePercent: 12 }],
};

async function previewIt() {
  previewAsync.mockResolvedValue(PREVIEW);
  render(<RetiredGstPanel />);
  fireEvent.change(screen.getByLabelText('Paste the rate list'), { target: { value: 'Drug name,GST %\nOldcillin,5' } });
  fireEvent.click(screen.getByText('Check pasted rows'));
  await screen.findByText('12% is not a legal GST rate on 25/11/2026.');
}

beforeEach(() => {
  vi.clearAllMocks();
  role.slug = 'pharmacy_admin';
});

describe('RetiredGstPanel', () => {
  it('lists the medicine, its rate, where it comes from and its stock in words', () => {
    render(<RetiredGstPanel />);
    for (const t of ['Oldcillin', '12%', 'Set on the medicine', '4 strips + 5 tablets (45 tablets)', 'Retired — last legal on 21/09/2025']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });

  it('previews without applying, and shows what did not match', async () => {
    await previewIt();
    expect(previewAsync).toHaveBeenCalledWith([expect.objectContaining({ rowNumber: 2, drugName: 'Oldcillin', gstPercent: '5' })]);
    expect(screen.getByText('No medicine in this hospital matches')).toBeInTheDocument();
    expect(screen.getByText(/Leftover \(12%\)/)).toBeInTheDocument();
    expect(applyAsync).not.toHaveBeenCalled();
  });

  it('applies only the ticked rows, and only with a reason', async () => {
    applyAsync.mockResolvedValue({ applied: [], skipped: [{ drugId: 'd1', drugName: 'Oldcillin', rowNumber: 2, reason: 'Changed since the preview.' }], appliedCount: 0, skippedCount: 1 });
    await previewIt();
    fireEvent.click(screen.getByLabelText('Change Oldmycin'));
    const go = screen.getByRole('button', { name: /Change 1 medicine/ });
    expect(go).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Reason for the change/), { target: { value: 'Client list' } });
    fireEvent.click(go);
    await waitFor(() => expect(applyAsync).toHaveBeenCalledTimes(1));
    expect(applyAsync).toHaveBeenCalledWith({
      reason: 'Client list',
      rows: [{ drugId: 'd1', gstPercent: 5, expectedRate: 12, effectiveFrom: null, rowNumber: 2 }],
    });
    expect(await screen.findByText(/Changed since the preview/)).toBeInTheDocument();
  });

  it('is closed to a role that may not change GST rates', () => {
    role.slug = 'pharmacist';
    render(<RetiredGstPanel />);
    expect(screen.getByText('Not available for your role')).toBeInTheDocument();
    expect(screen.queryByText('Import a rate list')).not.toBeInTheDocument();
  });
});
