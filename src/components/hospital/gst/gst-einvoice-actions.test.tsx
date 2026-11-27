import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// G-5 (gap #266): the row actions on D-1 / D-2 (IRN — invoices AND credit /
// debit notes) and D-3 (e-way bill — Generate, Retry after a failure, Cancel
// inside the window).

const canManage = vi.fn(() => true);
const genIrn = vi.fn();
const cancelIrn = vi.fn();
const genEway = vi.fn();
const cancelEway = vi.fn();
const apiPost = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/api')>();
  return { ...real, apiPost: (...a: unknown[]) => apiPost(...a) };
});

vi.mock('@/hooks/use-gst-portal', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/hooks/use-gst-portal')>();
  return {
    ...real,
    useCanManageGst: () => canManage(),
    useGenerateIrn: () => ({ mutateAsync: genIrn, isPending: false }),
    useCancelIrn: () => ({ mutateAsync: cancelIrn, isPending: false }),
    useGenerateEwayBill: () => ({ mutateAsync: genEway, isPending: false }),
    useCancelEwayBill: () => ({ mutateAsync: cancelEway, isPending: false }),
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { EwayRowAction, IrnRowActions } from './gst-einvoice-actions';
import type { EwayRow } from '@/hooks/use-gst-reports';

const READY = { ready: true, reason: null, provider: 'sandbox', sandbox: true, cancelWindowHours: 24 };
const HOUR = 3_600_000;

beforeEach(() => {
  vi.clearAllMocks();
  canManage.mockReturnValue(true);
  genIrn.mockResolvedValue({ status: 'registered', alreadyRegistered: false, sandbox: true });
  genEway.mockResolvedValue({ status: 'generated', ewayBillNumber: '125644998983', alreadyGenerated: false, sandbox: true });
});

describe('IrnRowActions for credit / debit notes', () => {
  const noteRow = (o: Record<string, unknown> = {}) => ({
    id: 'cn-1', kind: 'credit_note', documentNumber: 'CN/1', status: 'not_sent', ackDate: null, ...o,
  });

  it('sends a credit note (kind carried through, so the notes route is used)', async () => {
    render(<IrnRowActions row={noteRow()} integration={READY} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Generate IRN/ })));
    expect(genIrn).toHaveBeenCalledWith({ billId: 'cn-1', retry: false, kind: 'credit_note' });
  });

  it('offers Retry on a failed debit note', async () => {
    render(<IrnRowActions row={noteRow({ kind: 'debit_note', status: 'failed' })} integration={READY} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Retry/ })));
    expect(genIrn).toHaveBeenCalledWith({ billId: 'cn-1', retry: true, kind: 'debit_note' });
  });

  it('offers Cancel inside the window, and says how to correct a note after it', () => {
    const { unmount } = render(
      <IrnRowActions row={noteRow({ status: 'registered', ackDate: new Date(Date.now() - HOUR).toISOString() })} integration={READY} />,
    );
    expect(screen.getByRole('button', { name: /Cancel IRN/ })).toBeInTheDocument();
    unmount();
    render(<IrnRowActions row={noteRow({ status: 'registered', ackDate: new Date(Date.now() - 30 * HOUR).toISOString() })} integration={READY} />);
    expect(screen.getByText(/cancel window closed — issue a fresh note/)).toBeInTheDocument();
  });

  it('offers nothing to a role that cannot manage GST', () => {
    canManage.mockReturnValue(false);
    const { container } = render(<IrnRowActions row={noteRow()} integration={READY} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the IRN hooks pick the route by document kind', () => {
  it('posts a note to /gst/einvoice/notes/:id and an invoice to /gst/einvoice/bills/:id', async () => {
    const real = await vi.importActual<typeof import('@/hooks/use-gst-portal')>('@/hooks/use-gst-portal');
    apiPost.mockResolvedValue({ data: { status: 'registered' } });
    let mutate: ReturnType<typeof real.useGenerateIrn>['mutateAsync'] | null = null;
    function Probe() {
      mutate = real.useGenerateIrn().mutateAsync;
      return null;
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Probe />
      </QueryClientProvider>,
    );
    await act(async () => {
      await mutate!({ billId: 'cn-1', kind: 'credit_note' });
      await mutate!({ billId: 'cn-2', kind: 'debit_note', retry: true });
      await mutate!({ billId: 'bill-1' });
    });
    expect(apiPost.mock.calls.map((c) => c[0])).toEqual([
      '/gst/einvoice/notes/cn-1/generate',
      '/gst/einvoice/notes/cn-2/retry',
      '/gst/einvoice/bills/bill-1/generate',
    ]);
  });
});

describe('EwayRowAction', () => {
  const ewayRow = (o: Partial<EwayRow> = {}): EwayRow => ({
    returnId: 'ret-1', date: '2026-11-24T05:00:00Z', documentNumber: 'VR-0001', status: 'processed',
    itemName: 'Paracetamol', hsnCode: '3004', quantity: 10, consignmentValue: 75000,
    supplierName: 'Acme', supplierGstin: '27AAPFU0939F1ZV', destination: 'Mumbai',
    ewayBillNumber: null, ewayBillDate: null, ewayStatus: 'not_generated', billRequired: true,
    ...o,
  });

  it('offers Retry on a failure, prefilled with what was sent, showing the portal\'s words', async () => {
    render(
      <EwayRowAction
        row={ewayRow({
          ewayStatus: 'failed',
          ewayError: '238: Invalid consignee GSTIN',
          ewayTransport: { transMode: '1', distanceKm: 42, vehicleNo: 'TN01AB1234' },
        })}
        integration={READY}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(screen.getByText(/Last attempt: 238: Invalid consignee GSTIN/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('42')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TN01AB1234')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: /^Retry$/ });
    await act(async () => fireEvent.click(buttons[buttons.length - 1]));
    expect(genEway).toHaveBeenCalledWith({
      returnId: 'ret-1',
      retry: true,
      input: { transMode: '1', distanceKm: 42, vehicleNo: 'TN01AB1234' },
    });
  });

  it('offers Cancel inside the window, and not after it', () => {
    const { unmount } = render(
      <EwayRowAction
        row={ewayRow({ ewayStatus: 'generated', ewayBillNumber: '125644998983', ewayBillDate: new Date(Date.now() - HOUR).toISOString() })}
        integration={READY}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(screen.getByText(/Cancel e-way bill 125644998983/)).toBeInTheDocument();
    unmount();
    render(
      <EwayRowAction
        row={ewayRow({ ewayStatus: 'generated', ewayBillNumber: '125644998983', ewayBillDate: new Date(Date.now() - 30 * HOUR).toISOString() })}
        integration={READY}
      />,
    );
    expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
    expect(screen.getByText(/24-hour cancel window closed/)).toBeInTheDocument();
  });

  // #266: a cancelled one can be followed by a new one; the old stays in the history.
  it('offers "Generate new" after a cancellation, prefilled, as a fresh generate', async () => {
    render(
      <EwayRowAction
        row={ewayRow({
          ewayStatus: 'cancelled', ewayBillNumber: '125644998983', ewayBillDate: new Date().toISOString(),
          ewayTransport: { transMode: '1', distanceKm: 42, vehicleNo: 'TN01AB1234' },
        })}
        integration={READY}
      />,
    );
    expect(screen.queryByRole('button', { name: /^Cancel/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Generate new/ }));
    expect(screen.getByText(/125644998983 was cancelled; it stays in this return's history/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Generate$/ })));
    expect(genEway).toHaveBeenCalledWith({
      returnId: 'ret-1', retry: false, input: { transMode: '1', distanceKm: 42, vehicleNo: 'TN01AB1234' },
    });
  });

  it('offers no new one to a role that cannot manage GST', () => {
    canManage.mockReturnValue(false);
    const { container } = render(
      <EwayRowAction row={ewayRow({ ewayStatus: 'cancelled', ewayBillNumber: '125644998983' })} integration={READY} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
