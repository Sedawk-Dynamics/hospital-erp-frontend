import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';

// ============================================================
// Types
// ============================================================

export interface OnlineOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  paymentId: string;
}

export interface OnlinePaymentVerifyResponse {
  verified: boolean;
  transferId: string;
}

// ============================================================
// Hooks
// ============================================================

/** Create a Razorpay order for a patient bill (online payment) */
export function useCreateOnlineOrder() {
  return useMutation({
    mutationFn: async (billId: string) => {
      const response = await apiPost<OnlineOrderResponse>('/online-payments/create-order', { billId });
      return response.data;
    },
  });
}

/** Verify a Razorpay payment after the checkout modal closes */
export function useVerifyOnlinePayment() {
  return useMutation({
    mutationFn: async (data: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      const response = await apiPost<OnlinePaymentVerifyResponse>('/online-payments/verify', data);
      return response.data;
    },
  });
}
