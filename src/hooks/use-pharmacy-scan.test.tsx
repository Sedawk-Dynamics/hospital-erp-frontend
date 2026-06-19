import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock('@/lib/api', () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  apiPatch: vi.fn(),
}));

import { useResolveScan, useCheckSaleCompliance } from './use-pharmacy';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useResolveScan (barcode → product/batch)', () => {
  beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); });

  it('calls the scan endpoint with the code and returns the resolved product', async () => {
    apiGet.mockResolvedValue({
      data: { resolvedVia: 'gs1', drug: { id: 'd1', drugName: 'Crocin 650' }, batch: { id: 'b1', batchNumber: 'CRT8821' }, totalStock: 120 },
    });
    const { result } = renderHook(() => useResolveScan(), { wrapper });

    const res = await result.current.mutateAsync('010890123456789017280831');
    expect(apiGet).toHaveBeenCalledWith('/pharmacy/scan', { params: { code: '010890123456789017280831' } });
    expect(res.drug.drugName).toBe('Crocin 650');
    expect(res.batch?.batchNumber).toBe('CRT8821');
  });
});

describe('useCheckSaleCompliance (HSN/GST/Schedule pre-check)', () => {
  beforeEach(() => { apiGet.mockReset(); apiPost.mockReset(); });

  it('posts the cart and surfaces blockers/warnings', async () => {
    apiPost.mockResolvedValue({ data: { ok: false, blockers: ['Schedule X requires a prescription'], warnings: [] } });
    const { result } = renderHook(() => useCheckSaleCompliance(), { wrapper });

    const res = await result.current.mutateAsync({ items: [{ drugBatchId: 'b1' }] });
    expect(apiPost).toHaveBeenCalledWith('/pharmacy/sales/compliance-check', { items: [{ drugBatchId: 'b1' }] });
    expect(res.ok).toBe(false);
    expect(res.blockers[0]).toMatch(/Schedule X/);
  });

  it('reports ok when compliant', async () => {
    apiPost.mockResolvedValue({ data: { ok: true, blockers: [], warnings: ['Vitamin C: HSN code not set'] } });
    const { result } = renderHook(() => useCheckSaleCompliance(), { wrapper });
    const res = await result.current.mutateAsync({ items: [{ drugBatchId: 'b2' }], prescriptionId: 'rx1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(res.ok).toBe(true);
    expect(res.warnings).toHaveLength(1);
  });
});
