import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { gstProfileKey } from '@/hooks/use-gst-profile';

// ============================================================
// G-5 (gap #266): the e-invoice (IRP) and e-way bill portal integration.
//
// "Ready" = a provider is configured on the server AND this hospital's portal
// login is saved. Until then the switches in GST settings are disabled and
// read "Not available", and the server refuses to turn them on.
//
// The server never sends a credential back: only a masked username and
// set/not-set flags.
// ============================================================

export type GstPortal = 'einvoice' | 'eway';

export interface PortalProviderInfo {
  configured: boolean;
  provider: string | null;
  sandbox: boolean;
  reason: string | null;
}

export interface PortalReadiness {
  portal: GstPortal;
  label: string;
  ready: boolean;
  reason: string | null;
  provider: PortalProviderInfo;
  credentials: {
    set: boolean;
    readable: boolean;
    usernameHint: string | null;
    passwordSet: boolean;
    clientIdSet: boolean;
    clientSecretSet: boolean;
    updatedAt: string | null;
    problem: string | null;
  };
  lastTest: { at: string; ok: boolean; message: string | null; provider: string | null } | null;
}

export interface PortalStatus {
  provider: PortalProviderInfo;
  sandboxLabel: string;
  encryption: { available: boolean; source: 'env' | 'development-fallback' | null; reason: string | null };
  cancelWindowHours: number;
  einvoice: PortalReadiness;
  eway: PortalReadiness;
}

/** Carried by the D-1 / D-2 / D-3 report answers. */
export interface PortalIntegration {
  ready: boolean;
  reason: string | null;
  provider: string | null;
  sandbox: boolean;
  cancelWindowHours: number;
}

export const EINVOICE_SANDBOX_LABEL = 'SANDBOX — not registered with the government portal';

export const IRN_CANCEL_REASONS: { value: '1' | '2' | '3' | '4'; label: string }[] = [
  { value: '1', label: 'Duplicate' },
  { value: '2', label: 'Data entry mistake' },
  { value: '3', label: 'Order cancelled' },
  { value: '4', label: 'Others' },
];

const statusKey = ['gst-portal', 'status'] as const;

/** The roles the server lets manage GST registration, credentials and IRNs. */
export const GST_MANAGER_ROLES = ['super_admin', 'admin', 'billing_admin'];

export function useCanManageGst(): boolean {
  const user = useAuthStore((s) => s.user);
  const roles = [user?.role?.slug, user?.role?.name, ...(user?.roles ?? [])].filter(Boolean) as string[];
  return roles.some((r) => GST_MANAGER_ROLES.includes(r));
}

export function useGstPortalStatus(enabled = true) {
  return useQuery({
    queryKey: statusKey,
    queryFn: async () => (await apiGet<PortalStatus>('/gst/portal/status')).data,
    enabled,
    staleTime: 30_000,
  });
}

export interface PortalCredentialInput {
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
}

export function useSavePortalCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ portal, input }: { portal: GstPortal; input: PortalCredentialInput }) =>
      (await apiPut<PortalReadiness>(`/gst/portal/${portal}/credentials`, input)).data,
    onSettled: () => qc.invalidateQueries({ queryKey: statusKey }),
  });
}

export function useDeletePortalCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (portal: GstPortal) => (await apiDelete<PortalReadiness>(`/gst/portal/${portal}/credentials`)).data,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: statusKey });
      qc.invalidateQueries({ queryKey: gstProfileKey });
    },
  });
}

export function useTestPortalConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (portal: GstPortal) =>
      (
        await apiPost<{ ok: boolean; message: string; testedAt: string; provider: string; sandbox: boolean }>(
          `/gst/portal/${portal}/test`,
        )
      ).data,
    onSettled: () => qc.invalidateQueries({ queryKey: statusKey }),
  });
}

export interface IrnOutcome {
  billId: string;
  invoiceNumber: string | null;
  status: 'registered' | 'failed' | 'cancelled' | 'pending';
  irn: string | null;
  ackNo: string | null;
  ackDate: string | null;
  signedQrCode: boolean;
  error: string | null;
  alreadyRegistered: boolean;
  provider: string | null;
  sandbox: boolean;
}

const refreshReports = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: ['gst-report'] });

/** The document an IRN action is for: an invoice, or a credit / debit note against a B2B invoice. */
export type IrnDocKind = 'invoice' | 'credit_note' | 'debit_note';

const irnDocPath = (kind: IrnDocKind | undefined, id: string) =>
  kind === 'credit_note' || kind === 'debit_note' ? `/gst/einvoice/notes/${id}` : `/gst/einvoice/bills/${id}`;

/** Generate (or Retry) the IRN for one finalised B2B invoice — or a credit / debit note against one. */
export function useGenerateIrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ billId, retry, kind }: { billId: string; retry?: boolean; kind?: IrnDocKind }) =>
      (await apiPost<IrnOutcome>(`${irnDocPath(kind, billId)}/${retry ? 'retry' : 'generate'}`)).data,
    onSettled: () => refreshReports(qc),
  });
}

export function useCancelIrn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ billId, reasonCode, remark, kind }: { billId: string; reasonCode: string; remark: string; kind?: IrnDocKind }) =>
      (await apiPost<IrnOutcome & { cancelledAt: string | null }>(`${irnDocPath(kind, billId)}/cancel`, { reasonCode, remark })).data,
    onSettled: () => refreshReports(qc),
  });
}

export interface EwayBillInput {
  transMode: '1' | '2' | '3' | '4';
  distanceKm: number;
  vehicleNo?: string;
  transporterId?: string;
  transporterName?: string;
}

export interface EwayOutcome {
  returnId: string;
  documentNumber: string;
  status: 'generated' | 'failed' | 'cancelled';
  ewayBillNumber: string | null;
  ewayBillDate: string | null;
  validUpto: string | null;
  /** The portal's own words when it refused (kept on the return for D-3). */
  error: string | null;
  alreadyGenerated: boolean;
  provider: string | null;
  sandbox: boolean;
}

/** E-way bill cancellation reasons — the e-way portal's numbering, not the IRN one. */
export const EWAY_CANCEL_REASONS: { value: '1' | '2' | '3' | '4'; label: string }[] = [
  { value: '1', label: 'Duplicate' },
  { value: '2', label: 'Order cancelled' },
  { value: '3', label: 'Data entry mistake' },
  { value: '4', label: 'Others' },
];

/** Generate — or, with `retry`, re-send after a failure — the e-way bill for a vendor return. */
export function useGenerateEwayBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ returnId, input, retry }: { returnId: string; input: EwayBillInput; retry?: boolean }) =>
      (await apiPost<EwayOutcome>(`/gst/eway/returns/${returnId}/${retry ? 'retry' : 'generate'}`, input)).data,
    onSettled: () => refreshReports(qc),
  });
}

export function useCancelEwayBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ returnId, reasonCode, remark }: { returnId: string; reasonCode: string; remark: string }) =>
      (await apiPost<EwayOutcome & { cancelledAt: string | null }>(`/gst/eway/returns/${returnId}/cancel`, { reasonCode, remark })).data,
    onSettled: () => refreshReports(qc),
  });
}
