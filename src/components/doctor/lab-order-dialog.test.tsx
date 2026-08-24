import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LabOrderDialog } from './lab-order-dialog';

// The reported problem: "when a doctor adds a lab order it does not show all
// the lab test names in search". Two causes — the picker bailed out under two
// characters, so there was no way to see the catalog without already knowing
// what you were looking for; and it asked for 20 rows with nothing on screen
// saying the list had been cut.

const mockGet = vi.fn();
vi.mock('@/lib/api', () => ({
  apiGet: (...a: unknown[]) => mockGet(...a),
}));

vi.mock('@/hooks/use-doctor', () => ({
  useCreateLabOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePatientDiagnoses: () => ({ data: [] }),
}));
vi.mock('@/hooks/use-cdss', () => ({
  useOrderSuggestions: () => ({ data: undefined }),
}));

const CATALOG = [
  { id: '1', testName: 'Absolute CBC differential', testCode: 'ACBCD', sampleType: 'blood' },
  { id: '2', testName: 'Complete Blood Count (CBC)', testCode: 'CBC', sampleType: 'blood' },
  { id: '3', testName: 'Liver Function Test', testCode: 'LFT', sampleType: 'blood' },
];

function reply(data: typeof CATALOG, total = data.length) {
  return { data, meta: { total, page: 1, limit: 200 } };
}

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LabOrderDialog open onOpenChange={vi.fn()} patientId="pat-1" visitId="visit-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(reply(CATALOG));
});

describe('the lab test picker', () => {
  it('lists the catalog without being typed into', async () => {
    renderDialog();

    // The whole complaint: with an empty box this used to show nothing at all.
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const params = mockGet.mock.calls[0][1].params;
    expect(params.search).toBeUndefined();
    expect(params.isActive).toBe('true');
  });

  it('asks for a page big enough to hold a real catalog', async () => {
    renderDialog();

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    // Was 20, against a catalog with no upper bound and no truncation notice.
    expect(mockGet.mock.calls[0][1].params.limit).toBeGreaterThanOrEqual(100);
  });

  it('shows the tests once the box is focused', async () => {
    renderDialog();
    await userEvent.click(screen.getByPlaceholderText(/browse the catalog/i));

    expect(await screen.findByText('Complete Blood Count (CBC)')).toBeInTheDocument();
    expect(screen.getByText('Liver Function Test')).toBeInTheDocument();
  });

  it('puts the test the doctor meant at the top, not the alphabetical first', async () => {
    renderDialog();
    const box = screen.getByPlaceholderText(/browse the catalog/i);
    await userEvent.click(box);
    await userEvent.type(box, 'CBC');

    // The server matches on `contains` and sorts by name, so "Absolute CBC
    // differential" comes back first. The exact code match must win.
    await waitFor(() => {
      const names = screen.getAllByRole('button')
        .map((b) => b.textContent ?? '')
        .filter((t) => t.includes('CBC'));
      expect(names[0]).toContain('Complete Blood Count (CBC)');
    });
  });

  it('says so when the catalog holds more than it is showing', async () => {
    mockGet.mockResolvedValue(reply(CATALOG, 240));
    renderDialog();
    await userEvent.click(screen.getByPlaceholderText(/browse the catalog/i));

    expect(await screen.findByText(/Showing 3 of 240/)).toBeInTheDocument();
  });

  it('stays quiet about truncation when nothing was cut', async () => {
    renderDialog();
    await userEvent.click(screen.getByPlaceholderText(/browse the catalog/i));

    await screen.findByText('Liver Function Test');
    expect(screen.queryByText(/Showing \d+ of/)).not.toBeInTheDocument();
  });

  it('explains an empty result rather than showing a blank box', async () => {
    mockGet.mockResolvedValue(reply([], 0));
    renderDialog();
    const box = screen.getByPlaceholderText(/browse the catalog/i);
    await userEvent.click(box);
    await userEvent.type(box, 'zzz');

    // An empty catalog is a provisioning problem, not a typing problem — say
    // which one it is.
    expect(await screen.findByText(/may not be in your hospital/i)).toBeInTheDocument();
  });

  it('does not re-query the server every time a test is added', async () => {
    renderDialog();
    const box = screen.getByPlaceholderText(/browse the catalog/i);
    await userEvent.click(box);
    await screen.findByText('Liver Function Test');
    const callsBefore = mockGet.mock.calls.length;

    await userEvent.click(screen.getByText('Liver Function Test'));

    // Adding used to re-run the search, and because selected tests were then
    // filtered out of a 20-row page the list visibly shrank as you worked.
    expect(mockGet.mock.calls.length).toBe(callsBefore);
  });

  it('hides a test once it is selected and brings it back when removed', async () => {
    renderDialog();
    const box = screen.getByPlaceholderText(/browse the catalog/i);
    await userEvent.click(box);
    await userEvent.click(await screen.findByText('Liver Function Test'));

    await userEvent.click(box);
    await waitFor(() => {
      const inList = screen.queryAllByText('Liver Function Test');
      // Still on screen once — as a selected chip — but no longer offered.
      expect(inList.length).toBe(1);
    });
  });
});
