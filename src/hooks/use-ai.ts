import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

// ============================================================
// Shared AI types
// ============================================================

export type AiChatTurn = { role: 'user' | 'assistant'; content: string };

export interface AiStatus {
  enabled: boolean;
  provider: 'gemini' | 'openai' | 'disabled';
  model: string | null;
  features: {
    patientChat: boolean;
    bloodReport: boolean;
    platformChat: boolean;
    dischargeAi: boolean;
    radiologyAi: boolean;
    progressNotesAi: boolean;
    ocrInvoice: boolean;
  };
}

/** Drives whether the UI shows AI panels/buttons. Cached for the session. */
export function useAiStatus() {
  return useQuery({
    queryKey: ['ai', 'status'],
    queryFn: async () => {
      const res = await apiGet<AiStatus>('/ai/status');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// Super-admin: per-hospital LLM provider configuration
// ============================================================

export interface AiConfig {
  /** null = platform default scope; a uuid = a hospital override. */
  tenantId: string | null;
  /** true when a hospital is showing the inherited platform default. */
  inherited: boolean;
  provider: 'gemini' | 'openai' | 'disabled';
  textModel: string;
  fallbackModels: string[];
  resolvedFallbacks: string[];
  temperature: number;
  maxOutputTokens: number;
  features: {
    patientChatEnabled: boolean;
    bloodReportEnabled: boolean;
    platformChatEnabled: boolean;
    dischargeAiEnabled: boolean;
    radiologyAiEnabled: boolean;
    progressNotesAiEnabled: boolean;
    ocrInvoiceEnabled: boolean;
  };
  providerKeys: { gemini: boolean; openai: boolean };
  updatedAt: string;
}

export interface AiModelInfo {
  id: string;
  label: string;
  provider: 'gemini' | 'openai';
  free: boolean;
  limits: string;
  notes?: string;
  recommended?: boolean;
  /** Set when the provider has withdrawn the model — it can only fail now. */
  retired?: string;
}

/** Catalog of selectable models + which providers have a key on the server. */
export function useAiModels() {
  return useQuery({
    queryKey: ['ai', 'models'],
    queryFn: async () => {
      const res = await apiGet<{ models: AiModelInfo[]; providerKeys: { gemini: boolean; openai: boolean } }>(
        '/ai/models',
      );
      return res.data;
    },
    staleTime: 30 * 60 * 1000,
  });
}

/** Config for a scope: tenantId omitted = platform default. */
export function useAiConfig(tenantId?: string | null) {
  return useQuery({
    queryKey: ['ai', 'config', tenantId ?? 'platform'],
    queryFn: async () => {
      const res = await apiGet<AiConfig>('/ai/config', {
        params: tenantId ? { tenantId } : undefined,
      });
      return res.data;
    },
  });
}

export interface AiConfigSummary {
  tenantId: string | null;
  hospitalName: string | null;
  provider: string;
  textModel: string;
  updatedAt: string;
}

export function useAiConfigs() {
  return useQuery({
    queryKey: ['ai', 'configs'],
    queryFn: async () => {
      const res = await apiGet<AiConfigSummary[]>('/ai/configs');
      return res.data;
    },
  });
}

export interface UpdateAiConfigPayload {
  tenantId?: string | null;
  provider?: string;
  textModel?: string;
  fallbackModels?: string[];
  temperature?: number;
  maxOutputTokens?: number;
  patientChatEnabled?: boolean;
  bloodReportEnabled?: boolean;
  platformChatEnabled?: boolean;
  dischargeAiEnabled?: boolean;
  radiologyAiEnabled?: boolean;
  progressNotesAiEnabled?: boolean;
  ocrInvoiceEnabled?: boolean;
}

export function useUpdateAiConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateAiConfigPayload) => {
      const res = await apiPut('/ai/config', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai'] });
    },
  });
}

/** Remove a hospital override so it reverts to the platform default. */
export function useResetAiConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await apiDelete('/ai/config', { params: { tenantId } });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai'] });
    },
  });
}

// ============================================================
// UC2: Patient AI chatbot for the doctor
// ============================================================

export interface PatientChatResponse {
  reply: string;
  model: string;
  provider: string;
  context: {
    patient: { id: string; name: string; mrn: string; age: number | null; gender: string | null; bloodGroup: string | null };
    counts: Record<string, number>;
  };
}

export function usePatientAiChat() {
  return useMutation({
    mutationFn: async (data: { patientId: string; message: string; history?: AiChatTurn[] }) => {
      const res = await apiPost<PatientChatResponse>('/ai/patient/chat', data);
      return res.data;
    },
  });
}

export interface BloodReportAnalysis {
  score: number;
  severity: 'normal' | 'mild' | 'moderate' | 'severe';
  summary: string;
  flagged: Array<{ parameter: string; value: string; status: string; note: string }>;
  recommendations: string[];
  resultCount: number;
}

export function useBloodReportAnalysis() {
  return useMutation({
    mutationFn: async (data: { patientId: string; labOrderId?: string }) => {
      const res = await apiPost<BloodReportAnalysis>('/ai/patient/blood-report', data);
      return res.data;
    },
  });
}

// ============================================================
// UC3: Platform-wide support chatbot (read-only)
// ============================================================

export interface PlatformChatResponse {
  reply: string;
  mode: 'data' | 'help';
  intent?: string;
  /** true when a data figure was refused because the role may not see it. */
  restricted?: boolean;
  /** help-mode scope: 'in' = tailored steps, 'out' = task belongs to another role. */
  scope?: 'in' | 'out';
  /** the role label the answer was tailored to (help mode). */
  role?: string;
  data?: { label: string; value: string };
  sources?: string[];
  /** Catalogue products the answer was allowed to draw on, when it was about a medicine. */
  medicines?: Array<{ id: string; name: string }>;
  model?: string;
  provider?: string;
}

export function usePlatformAiChat() {
  return useMutation({
    mutationFn: async (data: { message: string; history?: AiChatTurn[] }) => {
      const res = await apiPost<PlatformChatResponse>('/ai/support/chat', data);
      return res.data;
    },
  });
}

// ============================================================
// UC4: AI discharge-summary narrative
// ============================================================

export interface DischargeNarrativeSuggestions {
  suggestions: {
    proceduresSummary: string;
    dischargeInstructions: string;
    followUpInstructions: string;
  };
  note: string;
}

export function useGenerateDischargeNarrative() {
  return useMutation({
    mutationFn: async (summaryId: string) => {
      const res = await apiPost<DischargeNarrativeSuggestions>(
        `/mrd/discharge-summary/${summaryId}/ai-narrative`,
      );
      return res.data;
    },
  });
}
