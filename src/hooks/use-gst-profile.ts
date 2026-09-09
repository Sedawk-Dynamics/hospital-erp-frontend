import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api';

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

export function useUpdateGstProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<GstProfile>) =>
      (await apiPut<GstProfile>('/hospital-settings/gst-profile', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: gstProfileKey }),
  });
}
