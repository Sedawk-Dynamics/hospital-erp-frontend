import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface BankLinkStatus {
  linkedAccountId: string | null;
  bankVerified: boolean;
  hospitalName?: string;
}

export interface LinkBankAccountData {
  accountHolderName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  bankName: string;
  panNumber: string;
  gstNumber?: string;
  businessType: string;
  legalBusinessName: string;
}

// ============================================================
// Query Keys
// ============================================================

export const bankLinkingKeys = {
  all: ['bank-linking'] as const,
  status: () => [...bankLinkingKeys.all, 'status'] as const,
};

// ============================================================
// Hooks
// ============================================================

export function useBankLinkStatus() {
  return useQuery<BankLinkStatus>({
    queryKey: bankLinkingKeys.status(),
    queryFn: async () => {
      const response = await apiGet<BankLinkStatus>('/bank-linking/status');
      return response.data;
    },
  });
}

export function useLinkBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: LinkBankAccountData) => {
      const response = await apiPost<BankLinkStatus>('/bank-linking/link', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankLinkingKeys.all });
    },
  });
}

export function useUnlinkBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiDelete<{ success: boolean }>('/bank-linking/unlink');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankLinkingKeys.all });
    },
  });
}
