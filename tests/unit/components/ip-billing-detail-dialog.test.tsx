import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mock the transport ───
const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('@/lib/api-client', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
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
  patientPaidAmount: 0,
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
  mockGet.mockImplementation((url: string) => {
    if (url.endsWith('/ledger')) {
      return Promise.resolve({
        data: {
          data: {
            admissionId: 'adm-1',
            patientId: 'pat-1',
            billingCategory: 'cash',
            lines: [],
            categoryTotals: [],
            bills: [],
            totals: {},
          },
        },
      });
    }
    return Promise.resolve({ data: { data: [] } });
  });
  mockPost.mockResolvedValue({
    data: {
      data: {
        admission: { id: 'adm-1', billingCategory: 'insurance', status: 'admitted' },
        policy: { id: 'policy-1', policyNumber: 'PENDING-1', insurer: { name: 'Pending TPA Assignment' } },
        claim: null,
        connected: true,
      },
    },
  });
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

  it('does not display a TPA remittance as money paid by the patient', () => {
    renderDialog({
      ...bill,
      status: 'partially_paid',
      amountPaid: 13_000,
      patientPaidAmount: 1_000,
      insuranceCoveredAmount: 12_000,
      patientPayableAmount: 5_900,
      balanceDue: 4_900,
      admission: { ...bill.admission!, billingCategory: 'insurance' },
    });

    const row = screen.getByText('Patient paid / patient due').parentElement;
    expect(row).toHaveTextContent('₹1000.00 / ₹4900.00');
    expect(row).not.toHaveTextContent('₹13000.00');
  });

  it('automatically follows full and partial claim approval amounts', async () => {
    const approvedBill: IpBill = {
      ...bill,
      admission: { ...bill.admission!, billingCategory: 'insurance' },
      insuranceCoveredAmount: 8_000,
      patientPayableAmount: 2_000,
      insuranceClaims: [{
        id: 'claim-1',
        claimNumber: 'CLM-1',
        status: 'approved',
        claimAmount: 10_000,
        approvedAmount: 8_000,
        coveredAmount: 8_000,
        patientShare: 2_000,
        paidAmount: 0,
        outstandingAmount: 8_000,
      }],
    };
    const { show } = renderDialog(approvedBill);
    const payment = screen.getByPlaceholderText('TPA payment received (₹)');

    expect(payment).toHaveValue(8_000);
    expect(screen.getByText(/Auto-filled from the approved outstanding amount/)).toHaveTextContent('₹8000.00');

    show({
      ...approvedBill,
      insuranceCoveredAmount: 5_000,
      patientPayableAmount: 5_000,
      insuranceClaims: [{
        ...approvedBill.insuranceClaims![0],
        status: 'partially_approved',
        approvedAmount: 5_000,
        coveredAmount: 5_000,
        patientShare: 5_000,
        outstandingAmount: 5_000,
      }],
    });

    await waitFor(() => {
      expect(payment).toHaveValue(5_000);
      expect(payment).toHaveAttribute('max', '5000');
    });
  });

  it('lets billing staff change a cash admission to TPA after confirmation', async () => {
    const user = userEvent.setup();
    renderDialog(bill);

    await user.click(screen.getByRole('button', { name: 'Change billing to TPA' }));
    expect(screen.getByText(/Confirm this admission should use TPA/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm change' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/billing/admissions/adm-1/change-to-tpa',
        {},
        undefined,
      );
    });
  });
});
