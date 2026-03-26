'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, CreditCard, Calendar, Clock, Shield, AlertTriangle,
  CheckCircle2, XCircle, Loader2, Zap, Receipt, Check, Crown, Building2, Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import {
  useMySubscription,
  useCancelSubscription,
  useTurnOffAutoRenew,
  usePaymentHistory,
  useCreateOrder,
  useVerifyPayment,
  useCreateAutoPaySubscription,
  useOfferedPlans,
} from '@/hooks/use-subscriptions';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { formatDate } from '@/lib/date-utils';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-primary/10 text-primary',
  expired: 'bg-error/10 text-error',
  cancelled: 'bg-on-surface-variant/10 text-on-surface-variant',
};

const planIcons: Record<string, React.ReactNode> = {
  basic: <Building2 className="h-6 w-6" />,
  professional: <Crown className="h-6 w-6" />,
  enterprise: <Rocket className="h-6 w-6" />,
};

export default function ManageSubscriptionPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: subData, isLoading } = useMySubscription();
  const { data: payments, isLoading: paymentsLoading } = usePaymentHistory();
  const { data: offeredPlans, isLoading: plansLoading } = useOfferedPlans();
  const cancelMutation = useCancelSubscription();
  const turnOffAutoRenewMutation = useTurnOffAutoRenew();
  const createOrder = useCreateOrder();
  const verifyPayment = useVerifyPayment();
  const createAutoPay = useCreateAutoPaySubscription();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [autoRenewOffOpen, setAutoRenewOffOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentType, setPaymentType] = useState<'manual' | 'autopay'>('manual');
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

  const sub = subData?.subscription;
  const daysRemaining = subData?.daysRemaining;
  const isExpired = !subData?.active;
  const plans = offeredPlans?.filter((p) => p.priceMonthly || p.priceYearly) ?? [];

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync();
      toast.success('Subscription cancelled');
      setCancelOpen(false);
    } catch {
      toast.error('Failed to cancel subscription');
    }
  };

  const handleTurnOffAutoRenew = async () => {
    try {
      await turnOffAutoRenewMutation.mutateAsync();
      toast.success('Auto-renew turned off. Your plan stays active until the billing period ends.');
      setAutoRenewOffOpen(false);
    } catch {
      toast.error('Failed to turn off auto-renew');
    }
  };

  const openRazorpay = useCallback(
    (orderData: { orderId: string; amount: number; currency: string; keyId: string; planName: string }) => {
      if (typeof window === 'undefined' || !window.Razorpay) {
        toast.error('Payment gateway is loading. Please try again.');
        setProcessingPlanId(null);
        return;
      }
      const options: RazorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Hospital ERP',
        description: `${orderData.planName} - ${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}`,
        order_id: orderData.orderId,
        handler: async (response: RazorpayResponse) => {
          try {
            await verifyPayment.mutateAsync({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Payment successful! Subscription activated.');
            router.push('/select-hospital');
          } catch {
            toast.error('Payment verification failed. Contact support if amount was deducted.');
          } finally {
            setProcessingPlanId(null);
          }
        },
        prefill: {
          name: user ? `${user.firstName} ${user.lastName}` : undefined,
          email: user?.email,
        },
        theme: { color: '#0a685a' },
        modal: {
          ondismiss: () => {
            setProcessingPlanId(null);
            toast.info('Payment cancelled.');
          },
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    },
    [billingCycle, user, verifyPayment, router],
  );

  const handleSubscribe = async (planId: string) => {
    setProcessingPlanId(planId);
    try {
      const orderData = await createOrder.mutateAsync({ planId, billingCycle });
      openRazorpay(orderData);
    } catch {
      toast.error('Failed to initiate payment.');
      setProcessingPlanId(null);
    }
  };

  const handleAutoPay = async (planId: string) => {
    setProcessingPlanId(planId);
    try {
      const result = await createAutoPay.mutateAsync({ planId, billingCycle });
      if (result.shortUrl) {
        window.location.href = result.shortUrl;
      }
    } catch {
      toast.error('Failed to set up AutoPay.');
      setProcessingPlanId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface-container-lowest border-b border-surface-container">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-surface-container-low transition-colors">
              <ArrowLeft className="h-5 w-5 text-on-surface-variant" />
            </button>
            <div>
              <h1 className="font-headline text-xl font-bold">Manage Subscription</h1>
              <p className="font-label text-sm text-on-surface-variant">View your plan, purchase a subscription, or manage billing</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Current Plan Status */}
        {sub ? (
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-headline text-lg font-bold">{sub.plan?.name || 'Current Plan'}</h2>
                  <p className="font-label text-sm text-on-surface-variant">{sub.plan?.description || ''}</p>
                </div>
              </div>
              <Badge className={`${STATUS_COLORS[sub.status] || STATUS_COLORS.active} text-xs font-bold capitalize`}>
                {sub.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-surface-container-low rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-on-surface-variant" />
                  <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Billing</span>
                </div>
                <p className="font-label text-sm font-bold capitalize">{sub.billingCycle || '-'}</p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CreditCard className="h-3.5 w-3.5 text-on-surface-variant" />
                  <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Payment</span>
                </div>
                <p className="font-label text-sm font-bold capitalize flex items-center gap-1">
                  {sub.subscriptionPaymentMethod === 'autopay' && <Zap className="h-3 w-3 text-primary" />}
                  {sub.subscriptionPaymentMethod === 'autopay' ? 'AutoPay' : 'One-time'}
                </p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5 text-on-surface-variant" />
                  <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Days Left</span>
                </div>
                <p className={`font-label text-sm font-bold ${daysRemaining !== null && daysRemaining <= 7 ? 'text-error' : ''}`}>
                  {daysRemaining !== null ? daysRemaining : '-'}
                </p>
              </div>
              <div className="bg-surface-container-low rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="h-3.5 w-3.5 text-on-surface-variant" />
                  <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Auto Renew</span>
                </div>
                <p className="font-label text-sm font-bold">{sub.autoRenew ? 'Yes' : 'No'}</p>
              </div>
            </div>

            {daysRemaining !== null && daysRemaining <= 7 && sub.status === 'active' && (
              <div className="flex items-start gap-3 bg-error/5 border border-error/20 rounded-lg p-4 mb-4">
                <AlertTriangle className="h-5 w-5 text-error shrink-0 mt-0.5" />
                <div>
                  <p className="font-label text-sm font-bold text-error">Expiring soon</p>
                  <p className="font-label text-xs text-on-surface-variant">
                    {sub.endDate ? `Expires ${formatDate(sub.endDate)}` : ''}.
                    {sub.autoRenew ? ' Will renew automatically.' : ' Choose a plan below to renew.'}
                  </p>
                </div>
              </div>
            )}

            {sub.status === 'active' && (
              <div className="pt-4 border-t border-surface-container flex flex-wrap gap-3">
                {sub.autoRenew && (
                  <Button size="sm" variant="outline" className="text-on-surface-variant hover:text-on-surface" onClick={() => setAutoRenewOffOpen(true)}>
                    Turn Off Auto-Renew
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-error hover:text-error" onClick={() => setCancelOpen(true)}>
                  Cancel Subscription
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-error/5 border border-error/20 rounded-xl p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
              <XCircle className="h-6 w-6 text-error" />
            </div>
            <div>
              <h2 className="font-headline text-lg font-bold text-error">No Active Subscription</h2>
              <p className="font-label text-sm text-on-surface-variant">Choose a plan below to activate your account and unlock all features.</p>
            </div>
          </div>
        )}

        {/* Available Plans — only plans assigned by super admin are shown */}
        {plans.length > 0 ? (
          <div>
            <div className="mb-6 space-y-4">
              <div>
                <h2 className="font-headline text-lg font-bold">Choose a Plan</h2>
                <p className="font-label text-sm text-on-surface-variant">Select billing cycle, payment type, and subscribe</p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {/* Billing cycle toggle */}
                <div>
                  <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider font-bold mb-1.5">Billing Cycle</p>
                  <div className="flex bg-surface-container-low rounded-lg p-1">
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className={`px-4 py-2 rounded-md font-label text-xs font-bold transition-all ${
                        billingCycle === 'monthly' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingCycle('yearly')}
                      className={`px-4 py-2 rounded-md font-label text-xs font-bold transition-all ${
                        billingCycle === 'yearly' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                      }`}
                    >
                      Yearly <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Save 17%</span>
                    </button>
                  </div>
                </div>

                {/* Payment type toggle */}
                <div>
                  <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider font-bold mb-1.5">Payment Type</p>
                  <div className="flex bg-surface-container-low rounded-lg p-1">
                    <button
                      onClick={() => setPaymentType('manual')}
                      className={`px-4 py-2 rounded-md font-label text-xs font-bold transition-all ${
                        paymentType === 'manual' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                      }`}
                    >
                      One-time Pay
                    </button>
                    <button
                      onClick={() => setPaymentType('autopay')}
                      className={`px-4 py-2 rounded-md font-label text-xs font-bold transition-all flex items-center gap-1.5 ${
                        paymentType === 'autopay' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                      }`}
                    >
                      AutoPay
                      <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Recommended</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* AutoPay info */}
              {paymentType === 'autopay' && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2.5">
                  <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-label text-xs font-bold text-primary">AutoPay enabled</p>
                    <p className="font-label text-[10px] text-on-surface-variant">
                      Your card/UPI will be charged automatically every {billingCycle === 'monthly' ? 'month' : 'year'}. You can cancel anytime from this page.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;
                const isProcessing = processingPlanId === plan.id;
                const isCurrent = sub?.planId === plan.id && sub?.status === 'active';
                const icon = planIcons[plan.name.toLowerCase()] || <Shield className="h-6 w-6" />;

                return (
                  <div
                    key={plan.id}
                    className={`bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 flex flex-col transition-all hover:shadow-lg ${
                      isCurrent ? 'ring-2 ring-primary' : ''
                    } ${isProcessing ? 'ring-2 ring-primary animate-pulse' : ''}`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        {icon}
                      </div>
                      <div>
                        <h3 className="font-headline text-base font-bold">{plan.name}</h3>
                        {isCurrent && <Badge className="bg-primary/10 text-primary text-[9px] border-0">Current</Badge>}
                      </div>
                    </div>

                    {plan.description && (
                      <p className="font-label text-xs text-on-surface-variant mb-4">{plan.description}</p>
                    )}

                    <div className="mb-4">
                      {price ? (
                        <div className="flex items-baseline gap-1">
                          <span className="font-label text-sm text-on-surface-variant">Rs</span>
                          <span className="font-headline text-3xl font-extrabold">{Number(price).toLocaleString()}</span>
                          <span className="font-label text-sm text-on-surface-variant">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                        </div>
                      ) : (
                        <p className="font-headline text-2xl font-extrabold">Custom</p>
                      )}
                      <div className="flex gap-3 mt-1 font-label text-[10px] text-on-surface-variant">
                        <span>{plan.maxUsers ? `${plan.maxUsers} Users` : 'Unlimited'}</span>
                        <span>{plan.maxHospitals ? `${plan.maxHospitals} Hospital${plan.maxHospitals > 1 ? 's' : ''}` : 'Unlimited'}</span>
                      </div>
                    </div>

                    {/* Features */}
                    {plan.features && (
                      <ul className="space-y-1.5 mb-6 flex-1">
                        {Object.entries(plan.features as Record<string, boolean>).map(([key, enabled]) => (
                          <li key={key} className="flex items-center gap-2 font-label text-xs">
                            <Check className={`h-3.5 w-3.5 shrink-0 ${enabled ? 'text-primary' : 'text-on-surface-variant/30'}`} />
                            <span className={enabled ? 'text-on-surface' : 'text-on-surface-variant/40 line-through'}>
                              {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {price && !isCurrent && !sub ? (
                      <div className="space-y-2 mt-auto">
                        <Button
                          className="w-full"
                          disabled={!!processingPlanId}
                          onClick={() => paymentType === 'autopay' ? handleAutoPay(plan.id) : handleSubscribe(plan.id)}
                        >
                          {isProcessing ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Processing...</>
                          ) : paymentType === 'autopay' ? (
                            <><Zap className="h-4 w-4 mr-1.5" /> Subscribe with AutoPay</>
                          ) : (
                            'Pay Now'
                          )}
                        </Button>
                        <p className="font-label text-[10px] text-center text-on-surface-variant">
                          {paymentType === 'autopay'
                            ? `Auto-charged Rs ${Number(price).toLocaleString()} every ${billingCycle === 'monthly' ? 'month' : 'year'}`
                            : `One-time payment of Rs ${Number(price).toLocaleString()}`}
                        </p>
                      </div>
                    ) : isCurrent ? (
                      <Button className="w-full mt-auto" disabled variant="outline">Current Plan</Button>
                    ) : price && sub ? (
                      <Button className="w-full mt-auto" disabled variant="outline">Cancel current plan first</Button>
                    ) : (
                      <Link href="/contact">
                        <Button variant="outline" className="w-full mt-auto">Contact Sales</Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : isExpired ? (
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-8 text-center">
            <CreditCard className="h-10 w-10 text-on-surface-variant/30 mx-auto mb-3" />
            <h2 className="font-headline text-lg font-bold mb-1">No Plans Available</h2>
            <p className="font-label text-sm text-on-surface-variant max-w-md mx-auto mb-4">
              Your administrator has not assigned any plans to your account yet. Please contact your administrator or support to get a plan.
            </p>
            <Link href="/contact">
              <Button variant="outline">Contact Support</Button>
            </Link>
          </div>
        ) : null}

        {/* Payment History */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-surface-container">
            <Receipt className="h-5 w-5 text-primary" />
            <h2 className="font-headline text-lg font-bold">Payment History</h2>
          </div>
          {paymentsLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : !payments || payments.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-label text-sm text-on-surface-variant">No payment history yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-surface-container">
                    <th className="px-6 py-3 font-label text-xs text-on-surface-variant font-bold">Date</th>
                    <th className="px-6 py-3 font-label text-xs text-on-surface-variant font-bold">Plan</th>
                    <th className="px-6 py-3 font-label text-xs text-on-surface-variant font-bold">Amount</th>
                    <th className="px-6 py-3 font-label text-xs text-on-surface-variant font-bold">Cycle</th>
                    <th className="px-6 py-3 font-label text-xs text-on-surface-variant font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-surface-container">
                      <td className="px-6 py-3 font-label text-sm">{formatDate(p.createdAt)}</td>
                      <td className="px-6 py-3 font-label text-sm font-bold">{p.plan.name}</td>
                      <td className="px-6 py-3 font-label text-sm">{p.currency} {Number(p.amount).toLocaleString()}</td>
                      <td className="px-6 py-3 font-label text-xs capitalize">{p.billingCycle}</td>
                      <td className="px-6 py-3">
                        <span className={`font-label text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          p.status === 'paid' ? 'bg-primary/10 text-primary' :
                          p.status === 'failed' ? 'bg-error/10 text-error' :
                          'bg-surface-container-high text-on-surface-variant'
                        }`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Subscription"
        description={
          sub?.subscriptionPaymentMethod === 'autopay'
            ? 'This will cancel your AutoPay subscription on Razorpay and deactivate your plan immediately. You can purchase a new plan anytime.'
            : 'This will cancel your subscription immediately. You can purchase a new plan anytime.'
        }
        confirmLabel="Confirm Cancellation"
        isLoading={cancelMutation.isPending}
        onConfirm={handleCancel}
      />

      <ConfirmDialog
        open={autoRenewOffOpen}
        onOpenChange={setAutoRenewOffOpen}
        title="Turn Off Auto-Renew"
        description={`Your AutoPay will be cancelled on Razorpay so no future charges will occur. Your current plan stays active until ${sub?.endDate ? formatDate(sub.endDate) : 'the billing period ends'}. After that, you will need to manually purchase a new plan.`}
        confirmLabel="Turn Off Auto-Renew"
        isLoading={turnOffAutoRenewMutation.isPending}
        onConfirm={handleTurnOffAutoRenew}
      />
    </div>
  );
}
