import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import type { SubscriptionPlan } from '@/types';

// ============================================================
// Types
// ============================================================

export interface MySubscription {
  active: boolean;
  subscription: {
    id: string;
    planId: string;
    plan: SubscriptionPlan;
    startDate: string;
    endDate: string | null;
    status: 'active' | 'expired' | 'cancelled';
    billingCycle: 'monthly' | 'yearly' | null;
    subscriptionPaymentMethod: 'manual' | 'autopay';
    autoRenew: boolean;
  } | null;
  daysRemaining: number | null;
}

export interface PaymentHistoryItem {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  billingCycle: string;
  plan: { id: string; name: string };
  createdAt: string;
}

// ============================================================
// Query Keys
// ============================================================

export const subscriptionKeys = {
  plans: ['subscription-plans'] as const,
  offeredPlans: ['offered-plans'] as const,
  mySubscription: ['my-subscription'] as const,
  paymentHistory: ['payment-history'] as const,
};

// ============================================================
// Public Hooks
// ============================================================

export function useActivePlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: subscriptionKeys.plans,
    queryFn: async () => {
      const response = await apiGet<SubscriptionPlan[]>('/subscription-plans');
      return response.data;
    },
  });
}

// ============================================================
// Offered Plans (assigned by super admin)
// ============================================================

export function useOfferedPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: subscriptionKeys.offeredPlans,
    queryFn: async () => {
      const response = await apiGet<SubscriptionPlan[]>('/subscription-plans/offered-plans');
      return response.data;
    },
  });
}

// ============================================================
// Manual Payment Flow
// ============================================================

export function useCreateOrder() {
  return useMutation({
    mutationFn: async (data: { planId: string; billingCycle: 'monthly' | 'yearly' }) => {
      const response = await apiPost<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        planName: string;
      }>('/subscription-plans/create-order', data);
      return response.data;
    },
  });
}

export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      const response = await apiPost('/subscription-plans/verify-payment', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.mySubscription });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.paymentHistory });
    },
  });
}

// ============================================================
// AutoPay Flow
// ============================================================

export function useCreateAutoPaySubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { planId: string; billingCycle: 'monthly' | 'yearly' }) => {
      const response = await apiPost<{
        subscriptionId: string;
        razorpaySubscriptionId: string;
        shortUrl: string;
        planName: string;
      }>('/subscription-plans/create-autopay', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.mySubscription });
    },
  });
}

// ============================================================
// Plan Change
// ============================================================

export function useChangePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      planId: string;
      billingCycle: 'monthly' | 'yearly';
      paymentMethod: 'manual' | 'autopay';
    }) => {
      const response = await apiPost('/subscription-plans/change-plan', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.mySubscription });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.paymentHistory });
    },
  });
}

// ============================================================
// User Subscription Management
// ============================================================

export function useMySubscription() {
  return useQuery<MySubscription>({
    queryKey: subscriptionKeys.mySubscription,
    queryFn: async () => {
      const response = await apiGet<MySubscription>('/subscription-plans/my-subscription');
      return response.data;
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiPost('/subscription-plans/cancel');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.mySubscription });
    },
  });
}

export function useTurnOffAutoRenew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiPost('/subscription-plans/turn-off-auto-renew');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.mySubscription });
    },
  });
}

export function usePaymentHistory() {
  return useQuery<PaymentHistoryItem[]>({
    queryKey: subscriptionKeys.paymentHistory,
    queryFn: async () => {
      const response = await apiGet<PaymentHistoryItem[]>('/subscription-plans/payment-history');
      return response.data;
    },
  });
}
