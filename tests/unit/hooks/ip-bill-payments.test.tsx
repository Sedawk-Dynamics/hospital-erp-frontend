import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

import { useBillPayments } from '@/hooks/use-ip-billing';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockResolvedValue({ data: [{ id: 'p1', amount: 500 }] });
});

// There has never been a payments router at the root of the API — payments
// live under /billing. Asking for `/payments` returned Express's own 404 page,
// so the instalment list on the IP bill rendered empty for every stay, and a
// bill settled in three parts looked unpaid on the one screen that shows the
// stay's pharmacy, room and procedure charges together.
describe('useBillPayments', () => {
  it('asks the billing router for the payments, not the API root', async () => {
    const { result } = renderHook(() => useBillPayments('bill-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiGet).toHaveBeenCalledWith('/billing/payments', {
      params: { billId: 'bill-1', limit: 50 },
    });
    // The path that 404'd. Named explicitly so a revert cannot pass quietly.
    expect(apiGet).not.toHaveBeenCalledWith('/payments', expect.anything());
  });

  it('does not ask at all until a bill is open', () => {
    renderHook(() => useBillPayments(null), { wrapper });
    expect(apiGet).not.toHaveBeenCalled();
  });
});
