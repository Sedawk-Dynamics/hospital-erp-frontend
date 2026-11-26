import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';

// ============================================================
// The hospital's own GST registration.
//
// Off by default. A hospital that never opens the screen keeps behaving as it
// does today: no tax on anything, every document a Bill of Supply.
//
// The state is never typed — the backend derives it from the GSTIN, so the two
// cannot disagree. An invalid GSTIN comes back as a 400 with the reason.
// ============================================================

export type GstRegistrationType = 'regular' | 'composition' | 'unregistered';
export type RoomUpgradeTreatment = 'accommodation' | 'other_service' | 'exempt';

export interface GstProfile {
  registered: boolean;
  gstin: string | null;
  /** Derived from the GSTIN. Read-only as far as the form is concerned. */
  stateCode: string | null;
  stateName: string | null;
  /** The hospital's PAN; the GSTIN's characters 3–12 must match it (gap item 311). */
  pan?: string | null;
  /**
   * True only when the GST service provider confirmed THIS GSTIN as active
   * (gap #311). A sandbox pass also sets it — check gstinVerification.sandbox
   * and label it, because the sandbox is not a real government check.
   */
  gstinVerified?: boolean;
  gstinVerification?: GstinVerificationState | null;
  gstinChecks?: {
    format: boolean; checkDigit: boolean; stateCode: boolean;
    panMatches: boolean | null; looksLikeSample: boolean;
  } | null;
  legalName: string | null;
  tradeName: string | null;
  registrationType: GstRegistrationType;
  /** First day this system's figures are the ones filed from. YYYY-MM-DD. */
  effectiveFrom: string | null;
  sixDigitHsn: boolean;
  eInvoiceApplicable: boolean;
  eWayBillApplicable: boolean;
  /** Days after the document date an invoice may still be registered (report D-2). */
  eInvoiceUploadDays: number;
  /** Consignment value above which goods on a road need an e-way bill (report D-3). */
  eWayBillThreshold: number;
  dischargeMedicinesTaxable: boolean;
  inpatientCompositeExempt: boolean;
  roomUpgradeTreatment: RoomUpgradeTreatment;
}

export const EMPTY_GST_PROFILE: GstProfile = {
  registered: false,
  gstin: null,
  stateCode: null,
  stateName: null,
  legalName: null,
  tradeName: null,
  registrationType: 'unregistered',
  effectiveFrom: null,
  sixDigitHsn: false,
  eInvoiceApplicable: false,
  eWayBillApplicable: false,
  eInvoiceUploadDays: 30,
  eWayBillThreshold: 50000,
  dischargeMedicinesTaxable: true,
  inpatientCompositeExempt: true,
  roomUpgradeTreatment: 'accommodation',
};

export const gstProfileKey = ['hospital-settings', 'gst-profile'] as const;

export function useGstProfile() {
  return useQuery({
    queryKey: gstProfileKey,
    queryFn: async () => (await apiGet<GstProfile>('/hospital-settings/gst-profile')).data,
  });
}

// ── GSTIN verification through the GST service provider (gap #311) ─────────

export type GstinVerificationStatus =
  | 'verified'
  | 'not_found'
  | 'inactive'
  | 'error'
  | 'never_checked'
  | 'stale'
  | 'unreadable';

export interface GstinVerificationState {
  status: GstinVerificationStatus;
  checkedGstin: string | null;
  legalName: string | null;
  tradeName: string | null;
  registrationStatus: string | null;
  provider: string | null;
  /** The QA sandbox answered — NOT a real government check. */
  sandbox: boolean;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  lastError: string | null;
  /** Provider legal name vs the one entered here; null when either is missing. */
  legalNameMatches: boolean | null;
}

export interface GstinProviderInfo {
  configured: boolean;
  provider: string | null;
  sandbox: boolean;
  reason: string | null;
}

export const SANDBOX_LABEL = 'SANDBOX — not a real government check';

export function useGstinVerificationProvider() {
  return useQuery({
    queryKey: ['hospital-settings', 'gstin-verification-provider'] as const,
    queryFn: async () =>
      (await apiGet<GstinProviderInfo>('/hospital-settings/gst/verification-provider')).data,
    staleTime: 60_000,
  });
}

/** Verify the SAVED GSTIN. The number is sent so the server can refuse if it is not the saved one. */
export function useVerifyGstin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gstin: string) =>
      (
        await apiPost<{ profile: GstProfile; result: { status: string; error: string | null; sandbox: boolean } }>(
          '/hospital-settings/gst/verify-gstin',
          { gstin },
        )
      ).data,
    // Settled, not success: a 503 / failed lookup can still have changed what is stored.
    onSettled: () => qc.invalidateQueries({ queryKey: gstProfileKey }),
  });
}

export function useUpdateGstProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<GstProfile>) =>
      (await apiPut<GstProfile>('/hospital-settings/gst-profile', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: gstProfileKey }),
  });
}
