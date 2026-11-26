'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Mail, Phone, Shield, Calendar, CreditCard,
  Clock, CheckCircle2, XCircle, AlertTriangle, Receipt,
  Loader2, ChevronRight, Building2, KeyRound, ShieldCheck, UserCog, RefreshCw,
} from 'lucide-react';
import { TwoFactorCard, PhoneChangeCard } from './_components/account-security';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth-store';
import { useClinicStore } from '@/stores/clinic-store';
import { apiGet, apiPost } from '@/lib/api';
import { usePermissions } from '@/hooks/use-permissions';
import {
  useMySubscription,
  usePaymentHistory,
  useOfferedPlans,
} from '@/hooks/use-subscriptions';
import { formatDate } from '@/lib/date-utils';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-primary/10', text: 'text-primary' },
  expired: { bg: 'bg-error/10', text: 'text-error' },
  cancelled: { bg: 'bg-on-surface-variant/10', text: 'text-on-surface-variant' },
};

/** GET /auth/me — the live profile, not the copy cached at sign-in. */
interface MeResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  is2faEnabled: boolean;
  roles: string[];
  tenant: { id: string; name: string; slug: string } | null;
}

const prettyRole = (r: string) => r.replace(/_/g, ' ');

/**
 * Change password (gap 297). The current password is required; the server
 * applies the same strength rule as a reset and answers a wrong current
 * password with a 400 so the session is not treated as expired.
 */
function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => apiPost('/auth/change-password', { currentPassword: current, newPassword: next }),
    onSuccess: () => {
      toast.success('Password changed');
      setCurrent('');
      setNext('');
      setConfirm('');
      setError(null);
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { message?: string; errors?: { message: string }[] } } })
        ?.response?.data;
      setError(data?.errors?.[0]?.message || data?.message || 'Could not change the password. Try again.');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError('The new passwords do not match');
      return;
    }
    setError(null);
    change.mutate();
  };

  return (
    <form onSubmit={submit} className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-primary" />
        <h2 className="font-headline text-lg font-bold">Change password</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">Current password</Label>
          <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">New password</Label>
          <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">Confirm new password</Label>
          <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
      </div>
      <p className="font-label text-xs text-on-surface-variant">
        At least 8 characters, with upper- and lower-case letters, a number and a symbol (@$!%*?&amp;#).
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-error/10 px-3 py-2 font-label text-sm text-error">{error}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={change.isPending || !current || !next || !confirm}>
          {change.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Change password
        </Button>
      </div>
    </form>
  );
}

export default function MyAccountPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const selectedClinic = useClinicStore((s) => s.selectedClinic);
  // Live profile. If it fails the page still renders from the cached user, but
  // says so and offers Retry (gap 297) — never a silent or blank page.
  const {
    data: me,
    isError: meFailed,
    isFetching: meFetching,
    refetch: refetchMe,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await apiGet<MeResponse>('/auth/me')).data ?? null,
    retry: false,
  });
  const refreshMe = () => queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
  const { isAdmin } = usePermissions();
  const { data: subData, isLoading: subLoading } = useMySubscription();
  const { data: payments, isLoading: paymentsLoading } = usePaymentHistory();
  const { data: offeredPlans } = useOfferedPlans();

  const sub = subData?.subscription;
  const daysRemaining = subData?.daysRemaining;

  if (!user) {
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-surface-container-low transition-colors">
              <ArrowLeft className="h-5 w-5 text-on-surface-variant" />
            </button>
            <div>
              <h1 className="font-headline text-xl font-bold">My Account</h1>
              <p className="font-label text-sm text-on-surface-variant">Your profile, subscription, and billing</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {meFailed && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/20 bg-error/5 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
              <p className="font-label text-sm text-error">
                Couldn&apos;t load your latest account details. What you see below may be out of date.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetchMe()} disabled={meFetching} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${meFetching ? 'animate-spin' : ''}`} />
              Retry
            </Button>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="font-headline text-xl font-bold text-primary">
                {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="font-headline text-lg font-bold">
                {me?.firstName ?? user.firstName} {me?.lastName ?? user.lastName ?? ''}
              </h2>
              <p className="font-label text-sm text-on-surface-variant capitalize">
                {user.role?.name ? prettyRole(String(user.role.name)) : 'User'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 bg-surface-container-low rounded-lg p-3">
              <Mail className="h-4 w-4 text-on-surface-variant shrink-0" />
              <div>
                <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Email</p>
                <p className="font-label text-sm font-medium">{me?.email ?? user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-surface-container-low rounded-lg p-3">
              <Phone className="h-4 w-4 text-on-surface-variant shrink-0" />
              <div>
                <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Phone</p>
                <p className="font-label text-sm font-medium">{me?.phone ?? user.phone ?? '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-surface-container-low rounded-lg p-3">
              <UserCog className="h-4 w-4 text-on-surface-variant shrink-0" />
              <div>
                <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Roles</p>
                <p className="font-label text-sm font-medium capitalize">
                  {(me?.roles ?? user.roles ?? []).map((r) => prettyRole(String(r))).join(', ') || '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-surface-container-low rounded-lg p-3">
              <Building2 className="h-4 w-4 text-on-surface-variant shrink-0" />
              <div>
                <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Hospital</p>
                <p className="font-label text-sm font-medium">
                  {/* The hospital being worked in; the platform tenant is not a hospital. */}
                  {selectedClinic?.name ||
                    (me?.tenant && me.tenant.slug !== '__platform__' ? me.tenant.name : null) ||
                    '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-surface-container-low rounded-lg p-3 sm:col-span-2">
              <ShieldCheck className="h-4 w-4 text-on-surface-variant shrink-0" />
              <div>
                <p className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Two-factor sign-in</p>
                <p className="font-label text-sm font-medium">
                  {me ? (me.is2faEnabled ? 'On' : 'Off') : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <ChangePasswordCard />

        {/* 2FA and phone change need the live profile; hidden until it loads. */}
        {me && (
          <>
            <TwoFactorCard enabled={me.is2faEnabled} onChanged={refreshMe} />
            <PhoneChangeCard
              currentPhone={me.phone}
              onChanged={(phone) => {
                setUser({ ...user, phone });
                refreshMe();
              }}
            />
          </>
        )}

        {/* Subscription Card */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="font-headline text-lg font-bold">Subscription</h2>
            </div>
            {isAdmin() && (
              <Link href="/manage-subscription">
                <Button variant="outline" size="sm" className="gap-1.5 font-label text-xs">
                  Manage <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </div>

          {subLoading ? (
            <div className="py-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : sub ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="font-headline text-base font-bold">{sub.plan?.name || 'Current Plan'}</h3>
                {(() => {
                  const sc = STATUS_COLORS[sub.status] || STATUS_COLORS.active;
                  return <Badge className={`${sc.bg} ${sc.text} text-[10px] font-bold capitalize border-0`}>{sub.status}</Badge>;
                })()}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-surface-container-low rounded-lg p-3">
                  <Calendar className="h-3.5 w-3.5 text-on-surface-variant mb-1" />
                  <p className="font-label text-[10px] text-on-surface-variant">Billing</p>
                  <p className="font-label text-sm font-bold capitalize">{sub.billingCycle || '-'}</p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <CreditCard className="h-3.5 w-3.5 text-on-surface-variant mb-1" />
                  <p className="font-label text-[10px] text-on-surface-variant">Payment</p>
                  <p className="font-label text-sm font-bold capitalize">{sub.subscriptionPaymentMethod}</p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <Clock className="h-3.5 w-3.5 text-on-surface-variant mb-1" />
                  <p className="font-label text-[10px] text-on-surface-variant">Days Left</p>
                  <p className={`font-label text-sm font-bold ${daysRemaining != null && daysRemaining <= 7 ? 'text-error' : ''}`}>
                    {daysRemaining ?? '-'}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg p-3">
                  <Calendar className="h-3.5 w-3.5 text-on-surface-variant mb-1" />
                  <p className="font-label text-[10px] text-on-surface-variant">Expires</p>
                  <p className="font-label text-sm font-bold">
                    {sub.endDate ? formatDate(sub.endDate) : '-'}
                  </p>
                </div>
              </div>

              {daysRemaining != null && daysRemaining <= 7 && sub.status === 'active' && (
                <div className="flex items-start gap-3 bg-error/5 border border-error/20 rounded-lg p-3 mt-4">
                  <AlertTriangle className="h-4 w-4 text-error shrink-0 mt-0.5" />
                  <p className="font-label text-xs text-error font-bold">
                    Your subscription is expiring soon. <Link href="/manage-subscription" className="underline">Renew now</Link>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-error/5 border border-error/20 rounded-lg p-4">
              <XCircle className="h-5 w-5 text-error shrink-0" />
              <div>
                <p className="font-label text-sm font-bold text-error">No Active Subscription</p>
                <p className="font-label text-xs text-on-surface-variant">
                  {offeredPlans && offeredPlans.length > 0
                    ? 'Your admin has offered you plans. '
                    : 'Contact your admin to get a plan. '}
                  <Link href="/manage-subscription" className="text-primary font-bold underline">View plans</Link>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Offered Plans (if any) */}
        {offeredPlans && offeredPlans.length > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
                <h2 className="font-headline text-base font-bold text-purple-900">Plans Available for You</h2>
              </div>
              <Link href="/manage-subscription">
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-xs gap-1">
                  Choose & Pay <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {offeredPlans.map((p) => (
                <span key={p.id} className="font-label text-xs font-bold px-3 py-1.5 rounded-full bg-purple-100 text-purple-700">
                  {p.name}
                  {p.priceMonthly ? ` — Rs ${Number(p.priceMonthly).toLocaleString()}/mo` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Payment History */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-surface-container">
            <Receipt className="h-5 w-5 text-primary" />
            <h2 className="font-headline text-base font-bold">Payment History</h2>
          </div>
          {paymentsLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : !payments || payments.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-label text-sm text-on-surface-variant">No payments yet.</p>
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
                  {payments.slice(0, 10).map((p) => (
                    <tr key={p.id} className="border-b border-surface-container">
                      <td className="px-6 py-3 font-label text-sm">{formatDate(p.createdAt)}</td>
                      <td className="px-6 py-3 font-label text-sm font-bold">{p.plan?.name ?? '-'}</td>
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
              {payments.length > 10 && (
                <div className="px-6 py-3 text-center border-t border-surface-container">
                  <Link href="/manage-subscription" className="font-label text-xs text-primary font-bold hover:underline">
                    View all payments
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
