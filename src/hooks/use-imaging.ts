import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiPut } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface ImagingRequest {
  id: string;
  patientId: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    mrn?: string;
    uhid?: string;
    phone?: string;
  };
  visitId?: string;
  imagingType: string;
  bodyPart?: string;
  /** legacy alias for `urgency` */
  priority?: string;
  urgency?: 'routine' | 'urgent' | 'stat';
  status: string;
  orderedBy?: string;
  orderer?: { id: string; firstName: string; lastName: string };
  /** legacy alias for `orderer` */
  requestedBy?: { id: string; firstName: string; lastName: string };
  assignedTechnicianId?: string | null;
  assignedTechnician?: { id: string; firstName: string; lastName: string } | null;
  room?: string | null;
  scheduledAt?: string | null;
  /** legacy alias derived from scheduledAt */
  scheduledDate?: string;
  scheduledTime?: string;
  clinicalIndication?: string;
  clinicalNotes?: string;
  reason?: string;
  notes?: string;
  imagingResult?: { id: string; status: string } | null;
  // Payment-verify gate (2026-05-27 flow)
  paymentVerified?: boolean;
  paymentVerifiedBy?: string | null;
  paymentVerifiedAt?: string | null;
  paymentVerifier?: { id: string; firstName: string; lastName: string } | null;
  // Linked bill summary — decorated by the list endpoint so admin can see
  // payment status before clicking Verify Payment.
  linkedBill?: {
    id?: string;
    billNumber?: string;
    status?: string;
    amountPaid?: number | string;
    totalAmount?: number | string;
    balanceDue?: number | string;
    chargeAmount?: number | string;
    payments?: Array<{
      paymentMethod: string;
      amount: number | string;
      paymentDate?: string;
    }>;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImagingResult {
  id: string;
  imagingRequestId: string;
  imagingRequest?: ImagingRequest;
  /** legacy alias for imagingRequestId */
  requestId?: string;
  request?: ImagingRequest;
  patientId?: string;
  impression?: string;
  conclusion?: string;
  pdfReportUrl?: string;
  /** legacy alias */
  reportUrl?: string;
  imageUrls?: string[];
  pacsReferenceId?: string;
  // Uploaded files (PDF / image / DICOM / video). Returned by GET /imaging/results/:id.
  attachments?: Array<{
    id: string;
    category?: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    sizeBytes?: number;
    description?: string | null;
    deletedAt?: string | null;
  }>;
  radiologistId?: string;
  radiologist?: { id: string; firstName: string; lastName: string };
  /** legacy alias */
  reportedBy?: { id: string; firstName: string; lastName: string };
  signedBy?: string;
  signedAt?: string;
  signer?: { id: string; firstName: string; lastName: string };
  /** legacy alias for signer */
  verifiedBy?: { id: string; firstName: string; lastName: string };
  status: string;
  /** legacy convenience */
  isVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ImagingRequestParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  urgency?: string;
  imagingType?: string;
  date?: string;
  patientId?: string;
  assignedTechnicianId?: string;
  fromDate?: string;
  toDate?: string;
  sortOrder?: 'asc' | 'desc';
  /**
   * 'true'  → only payment-verified requests (radiologist queue)
   * 'false' → only un-verified requests (radiology_admin queue)
   * omit    → both
   */
  paymentVerified?: 'true' | 'false';
  /** Radiology module passes this to hide cancelled requests. */
  excludeCancelled?: boolean;
}

interface ImagingResultParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

// ============================================================
// Query Keys
// ============================================================

export const imagingKeys = {
  all: ['imaging'] as const,
  requests: {
    all: ['imaging', 'requests'] as const,
    list: (params?: ImagingRequestParams) => ['imaging', 'requests', 'list', params] as const,
    detail: (id: string) => ['imaging', 'requests', 'detail', id] as const,
  },
  results: {
    all: ['imaging', 'results'] as const,
    list: (params?: ImagingResultParams) => ['imaging', 'results', 'list', params] as const,
    detail: (id: string) => ['imaging', 'results', 'detail', id] as const,
  },
};

// ============================================================
// Imaging Request Hooks
// ============================================================

export function useImagingRequests(params?: ImagingRequestParams) {
  return useQuery({
    queryKey: imagingKeys.requests.list(params),
    queryFn: async () => {
      const response = await apiGet<ImagingRequest[]>('/imaging/requests', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useImagingRequest(id: string) {
  return useQuery({
    queryKey: imagingKeys.requests.detail(id),
    queryFn: async () => {
      const response = await apiGet<ImagingRequest>(`/imaging/requests/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateImagingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      imagingType: string;
      bodyPart?: string;
      priority?: string;
      clinicalNotes?: string;
      reason?: string;
      scheduledDate?: string;
      scheduledTime?: string;
    }) => {
      const response = await apiPost<ImagingRequest>('/imaging/requests', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
    },
  });
}

export function useVerifyImagingPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<ImagingRequest>(`/imaging/requests/${id}/verify-payment`);
      return response.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.detail(id) });
      queryClient.invalidateQueries({ queryKey: ['imaging', 'dashboard'] });
    },
  });
}

export function useCancelImagingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<ImagingRequest>(`/imaging/requests/${id}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
    },
  });
}

export function useScheduleImaging() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      scheduledAt,
      scheduledDate,
      scheduledTime,
      assignedTechnicianId,
      room,
    }: {
      id: string;
      scheduledAt?: string; // preferred ISO datetime
      scheduledDate?: string; // legacy
      scheduledTime?: string; // legacy
      assignedTechnicianId?: string;
      room?: string;
    }) => {
      // Compose ISO datetime when only date+time provided
      const at = scheduledAt
        || (scheduledDate
          ? new Date(`${scheduledDate}T${scheduledTime ?? '09:00'}`).toISOString()
          : undefined);
      const response = await apiPatch<ImagingRequest>(`/imaging/requests/${id}/schedule`, {
        scheduledAt: at,
        assignedTechnicianId,
        room,
      });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.detail(variables.id) });
    },
  });
}

export function useUpdateImagingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      bodyPart?: string;
      urgency?: 'routine' | 'urgent' | 'stat';
      clinicalIndication?: string;
      notes?: string;
      scheduledAt?: string;
      assignedTechnicianId?: string;
      room?: string;
    }) => {
      const response = await apiPut<ImagingRequest>(`/imaging/requests/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.detail(variables.id) });
    },
  });
}

// ============================================================
// Imaging Result Hooks
// ============================================================

export function useImagingResults(params?: ImagingResultParams) {
  return useQuery({
    queryKey: imagingKeys.results.list(params),
    queryFn: async () => {
      const response = await apiGet<ImagingResult[]>('/imaging/results', { params });
      return { data: response.data, meta: response.meta as PaginationMeta };
    },
  });
}

export function useImagingResult(id: string) {
  return useQuery({
    queryKey: imagingKeys.results.detail(id),
    queryFn: async () => {
      const response = await apiGet<ImagingResult>(`/imaging/results/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useUploadImagingResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      imagingRequestId: string;
      patientId: string;
      impression?: string;
      imageUrls?: string[];
      pacsReferenceId?: string;
    }) => {
      const response = await apiPost<ImagingResult>('/imaging/results', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.results.all });
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
    },
  });
}

export function useAddImagingReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      impression?: string;
      recommendation?: string;
      pdfReportUrl?: string;
    }) => {
      const response = await apiPost<ImagingResult>(`/imaging/results/${id}/report`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.results.all });
    },
  });
}

export interface ImagingAnalytics {
  summary: {
    totalRequests: number;
    completedRequests: number;
    openRequests: number;
    publishedReports: number;
    avgTatHours: number;
    medianTatHours: number;
  };
  statusMix: Record<string, number>;
  urgencyMix: Record<string, number>;
  modalityVolume: { modality: string; count: number }[];
  bodyPartVolume: { bodyPart: string; count: number }[];
  technicianWorkload: { id: string; name: string; count: number }[];
}

export function useImagingAnalytics(params?: { fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: ['imaging', 'analytics', params],
    queryFn: async () => {
      const response = await apiGet<ImagingAnalytics>('/imaging/analytics', { params });
      return response.data;
    },
  });
}

// ── Dashboard (counts + recent activity) ──────────────────────────────────
export interface ImagingDashboard {
  counts: {
    /** Admin queue: new requests not yet payment-verified. */
    awaitingPaymentVerify: number;
    /** Radiologist queue: cleared-on-payment but not yet scheduled. */
    pending: number;
    scheduled: number;
    inProgress: number;
    completedToday: number;
    statToday: number;
    /** Admin queue: radiologist marked complete, awaiting admin publish. */
    awaitingApproval: number;
    /** Legacy alias for awaitingApproval — kept for backward compat. */
    awaitingVerify: number;
    publishedToday: number;
    cancelledToday: number;
    totalRequestsToday: number;
    overdueScheduled: number;
  };
  recentRequests: Array<{
    id: string;
    status: string;
    imagingType: string;
    bodyPart?: string | null;
    urgency: string;
    createdAt: string;
    scheduledAt?: string | null;
    patient?: { firstName: string; lastName: string; mrn?: string } | null;
  }>;
  recentResults: Array<{
    id: string;
    status: string;
    updatedAt: string;
    signedAt?: string | null;
    imagingRequest?: { imagingType: string; bodyPart?: string | null } | null;
    patient?: { firstName: string; lastName: string; mrn?: string } | null;
  }>;
}

export function useImagingDashboard() {
  return useQuery({
    queryKey: ['imaging', 'dashboard'] as const,
    queryFn: async () => {
      const response = await apiGet<ImagingDashboard>('/imaging/dashboard');
      return response.data;
    },
    // Refresh every minute so the worklist counts stay close to live.
    refetchInterval: 60_000,
  });
}

// ── Billing summary (auto-linked imaging bill-items roll-up) ──────────────
export interface ImagingBillingSummary {
  summary: {
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    itemCount: number;
  };
  statusMix: Record<string, number>;
  recent: Array<{
    id: string;
    description: string;
    totalAmount: number | string;
    createdAt: string;
    referenceId: string;
    bill: {
      id: string;
      billNumber: string;
      status: string;
      amountPaid: number | string;
      totalAmount: number | string;
      balanceDue: number | string;
      patient?: { id: string; mrn: string; firstName: string; lastName: string };
    };
  }>;
}

export function useImagingBillingSummary(params?: { fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: ['imaging', 'billing-summary', params] as const,
    queryFn: async () => {
      const response = await apiGet<ImagingBillingSummary>('/imaging/billing-summary', { params });
      return response.data;
    },
  });
}

export function useEditImagingResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      impression?: string;
      pacsReferenceId?: string;
      pdfReportUrl?: string;
    }) => {
      const response = await apiPatch<ImagingResult>(`/imaging/results/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.results.all });
      queryClient.invalidateQueries({ queryKey: imagingKeys.results.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: imagingKeys.requests.all });
    },
  });
}

export function useVerifyImagingResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiPatch<ImagingResult>(`/imaging/results/${id}/verify`);
      return response.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: imagingKeys.results.all });
      queryClient.invalidateQueries({ queryKey: imagingKeys.results.detail(id) });
    },
  });
}
