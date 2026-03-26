'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Building2, CheckCircle2, AlertTriangle, Loader2, Unlink, ArrowLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useBankLinkStatus, useLinkBankAccount, useUnlinkBankAccount } from '@/hooks/use-bank-linking';

// ============================================================
// Validation Schema
// ============================================================

const bankAccountSchema = z.object({
  accountHolderName: z.string().min(2, 'Required').max(120),
  accountNumber: z.string().min(9, 'Min 9 digits').max(18, 'Max 18 digits').regex(/^\d+$/, 'Must be numeric'),
  confirmAccountNumber: z.string().min(1, 'Please confirm account number'),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code (e.g. SBIN0001234)'),
  bankName: z.string().min(2, 'Required').max(100),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN (e.g. ABCDE1234F)'),
  gstNumber: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/, 'Invalid GST number').optional().or(z.literal('')),
  businessType: z.enum(['individual', 'proprietorship', 'partnership', 'private_limited', 'public_limited', 'trust', 'society', 'ngo']),
  legalBusinessName: z.string().min(2, 'Required').max(200),
}).refine((data) => data.accountNumber === data.confirmAccountNumber, {
  message: 'Account numbers do not match',
  path: ['confirmAccountNumber'],
});

type BankAccountFormData = z.infer<typeof bankAccountSchema>;

const businessTypes = [
  { value: 'individual', label: 'Individual' },
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'private_limited', label: 'Private Limited' },
  { value: 'public_limited', label: 'Public Limited' },
  { value: 'trust', label: 'Trust' },
  { value: 'society', label: 'Society' },
  { value: 'ngo', label: 'NGO' },
];

// ============================================================
// Page Component
// ============================================================

export default function BankAccountPage() {
  const router = useRouter();
  const { data: bankStatus, isLoading: statusLoading } = useBankLinkStatus();
  const linkMutation = useLinkBankAccount();
  const unlinkMutation = useUnlinkBankAccount();

  const isLinked = bankStatus?.bankVerified === true;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      accountHolderName: '',
      accountNumber: '',
      confirmAccountNumber: '',
      ifscCode: '',
      bankName: '',
      panNumber: '',
      gstNumber: '',
      businessType: 'individual',
      legalBusinessName: '',
    },
  });

  const onSubmit = async (data: BankAccountFormData) => {
    try {
      await linkMutation.mutateAsync(data);
      toast.success('Bank account linked successfully!');
      reset();
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to link bank account. Please try again.';
      toast.error(message);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to unlink your bank account? Online payments will be disabled.')) return;
    try {
      await unlinkMutation.mutateAsync();
      toast.success('Bank account unlinked.');
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to unlink bank account.';
      toast.error(message);
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/hospital/settings')} className="p-2 rounded-lg hover:bg-surface-container-low transition-colors">
          <ArrowLeft className="h-5 w-5 text-on-surface-variant" />
        </button>
        <div>
          <h1 className="font-headline text-xl font-bold">Bank Account</h1>
          <p className="font-label text-sm text-on-surface-variant">
            Link your bank account to accept online payments from patients
          </p>
        </div>
      </div>

      {/* Status Card */}
      {isLinked ? (
        <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary p-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-headline text-lg font-bold">Bank Account Linked</h2>
              <p className="font-label text-sm text-on-surface-variant">
                Your hospital can now accept online payments
              </p>
            </div>
            <Badge variant="default" className="bg-primary/10 text-primary border-0">Verified</Badge>
          </div>

          <div className="border-t border-surface-container pt-4 space-y-2">
            <div className="flex justify-between font-label text-sm">
              <span className="text-on-surface-variant">Linked Account ID</span>
              <span className="font-mono text-xs">{bankStatus?.linkedAccountId?.slice(0, 20)}...</span>
            </div>
          </div>

          <div className="mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlink}
              disabled={unlinkMutation.isPending}
              className="text-destructive hover:text-destructive"
            >
              {unlinkMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="mr-2 h-4 w-4" />
              )}
              Unlink Bank Account
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Warning */}
          <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-label text-sm font-medium text-yellow-800">
                Bank account not linked
              </p>
              <p className="font-label text-xs text-yellow-600 mt-1">
                Online payment is disabled until you link your bank account. Patients can only pay with cash.
              </p>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary animate-fade-in-up">
            <div className="flex items-center gap-2 border-b border-surface-container px-6 py-4">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="font-headline text-lg font-bold">Link Bank Account</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
              {/* Business Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="legalBusinessName">Legal Business Name <span className="text-destructive">*</span></Label>
                  <Input id="legalBusinessName" placeholder="City General Hospital Pvt. Ltd." {...register('legalBusinessName')} />
                  {errors.legalBusinessName && <p className="text-sm text-destructive">{errors.legalBusinessName.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type <span className="text-destructive">*</span></Label>
                  <select
                    id="businessType"
                    {...register('businessType')}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {businessTypes.map((bt) => (
                      <option key={bt.value} value={bt.value}>{bt.label}</option>
                    ))}
                  </select>
                  {errors.businessType && <p className="text-sm text-destructive">{errors.businessType.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="panNumber">PAN Number <span className="text-destructive">*</span></Label>
                  <Input id="panNumber" placeholder="ABCDE1234F" {...register('panNumber')} className="uppercase" />
                  {errors.panNumber && <p className="text-sm text-destructive">{errors.panNumber.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gstNumber">GST Number <span className="text-on-surface-variant text-xs">(optional)</span></Label>
                <Input id="gstNumber" placeholder="22ABCDE1234F1Z5" {...register('gstNumber')} className="uppercase" />
                {errors.gstNumber && <p className="text-sm text-destructive">{errors.gstNumber.message}</p>}
              </div>

              {/* Divider */}
              <div className="border-t border-surface-container" />

              {/* Bank Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="accountHolderName">Account Holder Name <span className="text-destructive">*</span></Label>
                  <Input id="accountHolderName" placeholder="City General Hospital" {...register('accountHolderName')} />
                  {errors.accountHolderName && <p className="text-sm text-destructive">{errors.accountHolderName.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name <span className="text-destructive">*</span></Label>
                  <Input id="bankName" placeholder="State Bank of India" {...register('bankName')} />
                  {errors.bankName && <p className="text-sm text-destructive">{errors.bankName.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ifscCode">IFSC Code <span className="text-destructive">*</span></Label>
                  <Input id="ifscCode" placeholder="SBIN0001234" {...register('ifscCode')} className="uppercase" />
                  {errors.ifscCode && <p className="text-sm text-destructive">{errors.ifscCode.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number <span className="text-destructive">*</span></Label>
                  <Input id="accountNumber" type="password" placeholder="Enter account number" {...register('accountNumber')} />
                  {errors.accountNumber && <p className="text-sm text-destructive">{errors.accountNumber.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmAccountNumber">Confirm Account Number <span className="text-destructive">*</span></Label>
                  <Input id="confirmAccountNumber" placeholder="Re-enter account number" {...register('confirmAccountNumber')} />
                  {errors.confirmAccountNumber && <p className="text-sm text-destructive">{errors.confirmAccountNumber.message}</p>}
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || linkMutation.isPending}
                >
                  {isSubmitting || linkMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Linking Bank Account...
                    </span>
                  ) : (
                    'Link Bank Account'
                  )}
                </Button>
              </div>

              <p className="font-label text-xs text-on-surface-variant text-center">
                Your bank details are securely sent to Razorpay and are not stored on our servers.
              </p>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
