import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mock the transport ───
const mockGet = vi.fn();
vi.mock('@/lib/api-client', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { IpBillingDetailDialog } from '@/components/hospital/billing/ip-billing-detail-dialog';
import type { IpBill } from '@/hooks/use-ip-billing';

const bill: IpBill = {
  id: 'bill-1',
  billNumber: 'IPB-0001',
  status: 'draft',
  admissionId: 'adm-1',
  totalAmount: 1600,
  insuranceCoveredAmount: 0,
  patientPayableAmount: 1600,
  amountPaid: 0,
  balanceDue: 1600,
  patient: { id: 'pat-1', mrn: 'MRN-1', firstName: 'Asha', lastName: 'Menon' },
  admission: { id: 'adm-1', billingCategory: 'cash', status: 'admitted' },
  insuranceClaims: [],
};

function renderDialog(b: IpBill | null) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = (value: IpBill | null) => (
    <QueryClientProvider client={qc}>
      <IpBillingDetailDialog bill={value} open onOpenChange={() => {}} />
    </QueryClientProvider>
  );
  const view = render(ui(b));
  return { ...view, show: (value: IpBill | null) => view.rerender(ui(value)) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ data: { data: [] } });
});

describe('IpBillingDetailDialog', () => {
  /**
   * The worklist keeps this dialog mounted and swaps the row into it, so the
   * very first render has no bill. Every hook must therefore sit ABOVE the
   * `if (!bill) return null` guard: a `useState` below it made the bill-less
   * render call one hook fewer, and React threw "Rendered more hooks than
   * during the previous render" the moment a row was clicked — a console
   * warning in dev, a blank "Application error" page in a production build.
   */
  it('survives the no-bill → bill transition the worklist performs', () => {
    const { show } = renderDialog(null);
    expect(screen.queryByText(/IP Bill/)).not.toBeInTheDocument();

    expect(() => show(bill)).not.toThrow();
    expect(screen.getByText(/IP Bill/)).toBeInTheDocument();
  });

  it('renders the bill header when opened with a bill already selected', () => {
    renderDialog(bill);
    expect(screen.getByText('IPB-0001')).toBeInTheDocument();
    expect(screen.getByText('MRN-1')).toBeInTheDocument();
  });
});
