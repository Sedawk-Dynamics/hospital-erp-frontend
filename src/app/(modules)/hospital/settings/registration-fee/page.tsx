'use client';

// ============================================================
// Registration fee — the one-time charge for opening a file at this hospital.
//
// One fee per hospital, so it is a setting rather than a row in the service
// catalog: a catalog would let an admin create three "Registration" services
// and leave the front desk guessing which one applies.
//
// It is off by default, so a hospital that does not charge one sees nothing
// change anywhere.
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useGstSlabs } from '@/hooks/use-gst-slabs';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/utils';
import {
  useRegistrationFeeSettings,
  useUpdateRegistrationFeeSettings,
  type RegistrationFeeSettings,
} from '@/hooks/use-registration-fee';

const EMPTY: RegistrationFeeSettings = {
  enabled: false,
  amount: 0,
  gstRatePercent: 0,
  label: 'Registration Fee',
  oncePerPatient: true,
};

export default function RegistrationFeePage() {
  const { data, isLoading } = useRegistrationFeeSettings();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  // The form seeds itself from `initial` on mount rather than syncing in an
  // effect — a settings form has exactly one starting point, and copying props
  // into state from an effect causes a cascading render for no benefit.
  return <RegistrationFeeForm initial={data ?? EMPTY} />;
}

function RegistrationFeeForm({ initial }: { initial: RegistrationFeeSettings }) {
  const update = useUpdateRegistrationFeeSettings();
  const [form, setForm] = useState<RegistrationFeeSettings>(initial);

  const set = <K extends keyof RegistrationFeeSettings>(k: K, v: RegistrationFeeSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // The rates in force today. The same list the finalisation gate checks

  // against, so the form cannot offer something the bill will refuse.

  const { data: slabData } = useGstSlabs();

  const legalRates = (slabData?.slabs ?? [])

    .filter((x) => x.current)

    .map((x) => x.ratePercent)

    .sort((a, b) => a - b);


  const total = form.amount + Math.round(form.amount * (form.gstRatePercent / 100) * 100) / 100;

  const onSave = async () => {
    try {
      await update.mutateAsync(form);
      toast.success('Registration fee saved.');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not save the registration fee.'));
    }
  };

  return (
    <div className="max-w-2xl space-y-4 animate-fade-in-up">
      <div className="flex items-start gap-3">
        <Button
          size="icon"
          variant="ghost"
          className="mt-0.5 h-8 w-8"
          nativeButton={false}
          render={<Link href="/hospital/settings" aria-label="Back to settings" />}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="flex items-center gap-2 font-headline text-xl font-bold">
            <IndianRupee className="h-5 w-5 text-primary" /> Registration Fee
          </h1>
          <p className="text-xs text-muted-foreground">
            A one-time charge added when a patient attends this hospital for the first time. It is
            added to their first appointment&apos;s bill, and the front desk can untick it.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Charge a registration fee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-2 rounded-md border bg-background px-3 py-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="text-sm font-medium">This hospital charges a registration fee</span>
              <span className="block text-[11px] text-muted-foreground">
                Off means nothing changes anywhere — no checkbox at booking, no line on any bill.
              </span>
            </span>
          </label>

          {form.enabled && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Amount (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={form.amount}
                    onChange={(e) => set('amount', Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">GST (%)</Label>
                  {/* A rate the law recognises, not a free number.
                      This was a plain box capped at 28 — a slab that stopped
                      existing on 22 September 2025 — and this hospital's fee
                      sits at 10%, which has never been a slab at all. Four
                      registration lines went out at it. The server refuses an
                      illegal rate now; offering one to be typed would only move
                      the refusal later. */}
                  <Select
                    value={String(form.gstRatePercent)}
                    onValueChange={(v) => v != null && set('gstRatePercent', Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {legalRates.map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          {r === 0 ? 'Nil / exempt' : `${r}%`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!legalRates.includes(form.gstRatePercent) && (
                    <p className="mt-1 text-[11px] text-red-700">
                      {form.gstRatePercent}% is not a legal slab today. Pick one of{' '}
                      {legalRates.map((r) => `${r}%`).join(', ')} — a bill raised at the
                      current rate will be refused when it is finalised.
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1 block text-xs text-muted-foreground">
                    What the patient sees on the bill
                  </Label>
                  <Input
                    value={form.label}
                    onChange={(e) => set('label', e.target.value)}
                    placeholder="Registration Fee"
                    maxLength={120}
                  />
                </div>
              </div>

              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                Patient pays{' '}
                <span className="font-semibold">
                  ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                {form.gstRatePercent > 0 && (
                  <span className="text-muted-foreground">
                    {' '}
                    (₹{form.amount.toFixed(2)} + {form.gstRatePercent}% GST)
                  </span>
                )}
              </div>

              <label className="flex items-start gap-2 rounded-md border bg-background px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.oncePerPatient}
                  onChange={(e) => set('oncePerPatient', e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="text-sm font-medium">Only ever charge it once per patient</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Recommended. With this on the fee can never be taken twice, even if the desk
                    ticks the box again. Turn it off only if you re-register a file after a long
                    absence.
                  </span>
                </span>
              </label>
            </>
          )}

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={update.isPending} className="gap-1.5">
              {update.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        &ldquo;First time&rdquo; means first time at <strong>this</strong> hospital — a patient who
        already has an account on the portal, or who is a regular at another hospital on this
        platform, is still opening a new file here and is still charged.
      </p>
    </div>
  );
}
