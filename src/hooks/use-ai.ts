import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';

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
    platformChat: boolean;
    dischargeAi: boolean;
    radiologyAi: boolean;
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
// Super-admin: LLM provider configuration
// ============================================================

export interface AiConfig {
  provider: 'gemini' | 'openai' | 'disabled';
  textModel: string;
  temperature: number;
  maxOutputTokens: number;
  features: {
    patientChatEnabled: boolean;
    platformChatEnabled: boolean;
    dischargeAiEnabled: boolean;
    radiologyAiEnabled: boolean;
  };
  providerKeys: { gemini: boolean; openai: boolean };
  updatedAt: string;
}

export function useAiConfig() {
  return useQuery({
    queryKey: ['ai', 'config'],
    queryFn: async () => {
      const res = await apiGet<AiConfig>('/ai/config');
      return res.data;
    },
  });
}

export function useUpdateAiConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<{
      provider: string;
      textModel: string;
      temperature: number;
      maxOutputTokens: number;
      patientChatEnabled: boolean;
      platformChatEnabled: boolean;
      dischargeAiEnabled: boolean;
      radiologyAiEnabled: boolean;
    }>) => {
      const res = await apiPut('/ai/config', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai', 'config'] });
      queryClient.invalidateQueries({ queryKey: ['ai', 'status'] });
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
  data?: { label: string; value: string };
  sources?: string[];
  model: string;
  provider: string;
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
