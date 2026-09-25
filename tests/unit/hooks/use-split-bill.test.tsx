import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiPatch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: (...args: unknown[]) => apiPatch(...args),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

import { useSplitBill } from '@/hooks/use-insurance';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSplitBill', () => {
  beforeEach(() => {
    apiPatch.mockReset();
    apiPatch.mockResolvedValue({
      data: {
        billId: 'bill-1',
        split: {
          claimAmount: 9000,
          coPayPercent: 0,
          deductibleAmount: 0,
          coverageLimit: 0,
          coveredAmount: 9000,
          copayAmount: 0,
          patientResponsibility: 0,
          insurancePortion: 9000,
        },
        billSplit: {
          insurancePortion: 9000,
          patientPortion: 2000,
          claimPatientPortion: 0,
          balanceDue: 1500,
        },
      },
    });
  });

  it('returns the applied bill-level TPA and patient amounts', async () => {
    const { result } = renderHook(() => useSplitBill(), { wrapper });

    let response: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      response = await result.current.mutateAsync({
        billId: 'bill-1',
        policyId: 'policy-1',
        claimAmount: 9000,
      });
    });

    expect(apiPatch).toHaveBeenCalledWith('/insurance/bills/bill-1/split', {
      policyId: 'policy-1',
      claimAmount: 9000,
    });
    expect(response?.billSplit).toEqual({
      insurancePortion: 9000,
      patientPortion: 2000,
      claimPatientPortion: 0,
      balanceDue: 1500,
    });
  });
});
