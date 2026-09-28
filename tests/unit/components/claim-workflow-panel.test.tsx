import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClaimWorkflowPanel } from '@/components/insurance/claim-workflow-panel';
import type { InsuranceClaim } from '@/hooks/use-insurance';

vi.mock('@/hooks/use-insurance-workflow', () => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    downloadClaimDossier: vi.fn(),
    useCreateClaimAdjustment: mutation,
    useDecideClaimWriteOff: mutation,
    useQueueInsuranceExchange: mutation,
    useRaiseClaimQuery: mutation,
    useRecordClaimSettlement: mutation,
    useRequestClaimWriteOff: mutation,
    useRespondClaimQuery: mutation,
    useResolveClaimQuery: mutation,
  };
});

const claim = {
  id: 'claim-1',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  billId: 'bill-1',
  claimNumber: 'CLM-0001',
  claimAmount: 10_000,
  paidAmount: 0,
  status: 'submitted',
  submissionDate: '2026-09-28T10:00:00.000Z',
  resubmissionCount: 0,
  queries: [],
  settlements: [],
  writeOffs: [],
  adjustments: [],
  auditEvents: [],
} satisfies InsuranceClaim;

describe('ClaimWorkflowPanel', () => {
  it('contains the operational flow without document or checklist controls', () => {
    render(<ClaimWorkflowPanel claim={claim} />);

    expect(screen.getByText('Queries (0)')).toBeInTheDocument();
    expect(screen.getByText(/Payer queries, financial closure/)).toBeInTheDocument();
    expect(screen.queryByText(/Supporting Documents/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Add document/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Submission is blocked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Discharge summary/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Signed claim form/i)).not.toBeInTheDocument();
  });
});
