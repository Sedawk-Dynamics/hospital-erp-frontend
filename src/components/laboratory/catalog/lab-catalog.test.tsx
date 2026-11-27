import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LAB_IMPORT_COLUMNS, labImportTemplate, parseLabImportGrid } from '@/lib/lab-catalog-import';
import type { PendingProposal } from '@/hooks/use-lab-catalog';

const approve = vi.fn();
const reject = vi.fn();
vi.mock('@/hooks/use-lab-catalog', () => ({
  useApproveRanges: () => ({ mutateAsync: approve, isPending: false }),
  useRejectRange: () => ({ mutateAsync: reject, isPending: false }),
  useConfirmRanges: () => ({}),
  usePendingRanges: () => ({}),
  useProposeRange: () => ({}),
  useRangeStatus: () => ({}),
  useSuggestRange: () => ({}),
  useTestRanges: () => ({}),
}));
let userId = 'u-path';
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (sel: (s: { user: { id: string } }) => unknown) => sel({ user: { id: userId } }),
}));
vi.mock('@/hooks/use-lab-role', () => ({ useLabRole: () => ({ canSignRanges: true }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ProposalCard, rangeLabel, readRangeForm } from './range-approval';

const proposal = (over: Partial<PendingProposal> = {}): PendingProposal => ({
  id: 'p1', testId: 't', parameterKey: 'k', parameterName: 'Hemoglobin', source: 'ai', origin: 'ai_suggest', status: 'pending',
  unit: 'g/dL', refLow: 12, refHigh: 16, refText: null, proposedText: '12–16', rationale: 'Usual adult interval', warnings: null,
  aiModel: 'm', proposedById: 'u-path', proposedByName: 'P', proposedAt: '2026-11-25T00:00:00Z', reviewedByName: null,
  reviewedAt: null, reviewNote: null, editedValues: null, previousLive: null, appliedLive: null,
  test: { id: 't', testName: 'CBC', testCode: 'CBC', sampleType: 'Blood' },
  live: { unit: 'g/dL', rangeText: '13–17' }, liveHash: 'h'.repeat(64), stale: false, orphaned: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  userId = 'u-path';
});

describe('range proposal card', () => {
  it('labels an AI suggestion and shows the range in use beside it', () => {
    render(<ProposalCard proposal={proposal()} canSign />);
    expect(screen.getByText(/AI-suggested, not reviewed/)).toBeTruthy();
    expect(screen.getByText('13–17')).toBeTruthy();
    expect(screen.getByText('12–16')).toBeTruthy();
  });

  it('offers nothing to sign to someone who is not a pathologist', () => {
    render(<ProposalCard proposal={proposal()} canSign={false} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('approves against the live range that was on screen', async () => {
    render(<ProposalCard proposal={proposal()} canSign />);
    fireEvent.click(screen.getByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith([{ id: 'p1', expectedLiveHash: 'h'.repeat(64), edits: undefined }]));
  });

  it('blocks approving your own manual proposal, not an AI one you asked for', () => {
    const { unmount } = render(<ProposalCard proposal={proposal({ source: 'manual' })} canSign />);
    expect((screen.getByRole('button', { name: /Approve/ }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(<ProposalCard proposal={proposal()} canSign />);
    expect((screen.getByRole('button', { name: /Approve/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('a rejection needs a reason', async () => {
    render(<ProposalCard proposal={proposal()} canSign />);
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm rejection/ }));
    expect(reject).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(/Why is this/), { target: { value: 'Wrong unit' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm rejection/ }));
    await waitFor(() => expect(reject).toHaveBeenCalledWith({ id: 'p1', reason: 'Wrong unit' }));
  });

  it('a removed parameter can only be rejected', () => {
    render(<ProposalCard proposal={proposal({ orphaned: true, live: null, liveHash: null })} canSign />);
    expect((screen.getByRole('button', { name: /Approve/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('range form', () => {
  it('checks the limits', () => {
    expect(readRangeForm({ unit: '', low: '10', high: '5', text: '' }).error).toMatch(/below/);
    expect(readRangeForm({ unit: '', low: 'x', high: '', text: '' }).error).toMatch(/numbers/);
    expect(readRangeForm({ unit: ' g/dL ', low: '1.5', high: '', text: '' })).toEqual({
      edits: { unit: 'g/dL', refLow: 1.5, refHigh: null, refText: null }, error: null,
    });
    expect(rangeLabel({ refLow: null, refHigh: 5, refText: null })).toBe('≤ 5');
  });
});

describe('catalogue import file', () => {
  const header = LAB_IMPORT_COLUMNS.map((c) => c.header);

  it('reads its own template, ignoring the example rows', () => {
    expect(parseLabImportGrid(labImportTemplate()).error).toMatch(/no tests/);
    const grid = [...labImportTemplate(), ['FER', 'Ferritin', '', '', '', '', '', 1200, '', 'Ferritin', 'ng/mL', 20, 250, '', '']];
    expect(parseLabImportGrid(grid).rows).toEqual([
      { rowNumber: 4, testCode: 'FER', testName: 'Ferritin', price: '1200', parameterName: 'Ferritin', parameterUnit: 'ng/mL', refLow: '20', refHigh: '250' },
    ]);
  });

  it('matches columns by heading in any order, skips blank rows, keeps file row numbers', () => {
    const out = parseLabImportGrid([['My hospital'], ['PRICE', 'Test Name'], ['', ''], ['50', 'ESR']]);
    expect(out).toEqual({ rows: [{ rowNumber: 4, price: '50', testName: 'ESR' }], error: null });
  });

  it('refuses a file it cannot recognise or that is too long', () => {
    expect(parseLabImportGrid([['a', 'b']]).error).toMatch(/Test name/);
    expect(parseLabImportGrid([header, ...Array.from({ length: 2001 }, (_, i) => ['', `T${i}`])]).error).toMatch(/at most/);
  });

  it('keeps a zero limit', () => {
    const out = parseLabImportGrid([['Test name', 'Range low', 'Range high'], ['X', 0, 5]]);
    expect(out.rows[0]).toMatchObject({ refLow: '0', refHigh: '5' });
  });
});
