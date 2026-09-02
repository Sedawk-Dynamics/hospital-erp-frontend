'use client';

// ============================================================
// GST registration — the hospital's own tax identity.
//
// Nothing else about GST can work without this. Whether a line carries
// CGST+SGST or IGST is decided by comparing this hospital's state against the
// place of supply, and until a GSTIN is entered there is no state to compare.
//
// Off by default. A hospital that leaves it alone keeps behaving exactly as it
// does today: no tax on anything, every document a Bill of Supply.
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save, ReceiptIndianRupee, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/utils';
import {
  useGstProfile,
  useUpdateGstProfile,
  EMPTY_GST_PROFILE,
  type GstProfile,
  type GstRegistrationType,
  type RoomUpgradeTreatment,
} from '@/hooks/use-gst-profile';

const REGISTRATION_TYPES: { value: GstRegistrationType; label: string }[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'composition', label: 'Composition' },
  { value: 'unregistered', label: 'Unregistered' },
];

const ROOM_UPGRADE: { value: RoomUpgradeTreatment; label: string; hint: string }[] = [
  { value: 'accommodation', label: 'Room accommodation', hint: 'Follows the room-rent rule — exempt up to ₹5,000/day, 5% above it' },
  { value: 'other_service', label: 'Other service', hint: 'Taxed at the rate on its own tariff' },
  { value: 'exempt', label: 'Exempt', hint: 'Treated as part of the treatment' },
];

export default function GstRegistrationPage() {
  const { data, isLoading } = useGstProfile();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return <GstForm initial={data ?? EMPTY_GST_PROFILE} />;
}

function Toggle({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <label className="flex items-start gap-2 rounded-md border bg-background px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-primary"
      />
      <span>
        <span className="text-sm font-medium">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function GstForm({ initial }: { initial: GstProfile }) {
  const update = useUpdateGstProfile();
  const [form, setForm] = useState<GstProfile>(initial);
  const [gstinText, setGstinText] = useState(initial.gstin ?? '');

  const set = <K extends keyof GstProfile>(k: K, v: GstProfile[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSave = async () => {
    try {
      const saved = await update.mutateAsync({ ...form, gstin: gstinText.trim() || null });
      setForm(saved);
      setGstinText(saved.gstin ?? '');
      toast.success('GST registration saved.');
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not save the GST registration.'));
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
            <ReceiptIndianRupee className="h-5 w-5 text-primary" /> GST Registration
          </h1>
          <p className="text-xs text-muted-foreground">
            This hospital&apos;s own tax identity. Until it is filled in, no bill carries GST and
            every document is issued as a Bill of Supply.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Registration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            checked={form.registered}
            onChange={(v) => set('registered', v)}
            title="This hospital is registered under GST"
            hint="Off means nothing changes anywhere — no tax on any bill, and no tax invoices."
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-xs text-muted-foreground">GSTIN</Label>
              <Input
                value={gstinText}
                onChange={(e) => setGstinText(e.target.value.toUpperCase())}
                placeholder="27AAPFU0939F1ZV"
                maxLength={15}
                className="font-mono uppercase"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                15 characters. The check digit is verified on save — a GSTIN that is one character
                wrong looks right on an invoice and then matches nothing on the portal.
              </p>
            </div>

            {/* Derived, never typed: the state is what decides CGST+SGST against
                IGST, so it must not be able to disagree with the number. */}
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-xs text-muted-foreground">
                State (from the GSTIN)
              </Label>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {form.stateCode ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="font-medium">{form.stateName}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      code {form.stateCode}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Enter a GSTIN and save — the state is read from its first two digits.
                  </span>
                )}
              </div>
            </div>

            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Registration type</Label>
              <Select
                value={form.registrationType}
                onValueChange={(v: string | null) =>
                  set('registrationType', (v as GstRegistrationType) ?? 'unregistered')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {REGISTRATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                Start filing from (cut-over)
              </Label>
              <Input
                type="date"
                value={form.effectiveFrom ?? ''}
                onChange={(e) => set('effectiveFrom', e.target.value || null)}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Bills before this date are left exactly as they are.
              </p>
            </div>

            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Legal name</Label>
              <Input
                value={form.legalName ?? ''}
                onChange={(e) => set('legalName', e.target.value || null)}
                placeholder="As on the GST registration"
                maxLength={200}
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Trade name</Label>
              <Input
                value={form.tradeName ?? ''}
                onChange={(e) => set('tradeName', e.target.value || null)}
                placeholder="The name on the signboard"
                maxLength={200}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">What applies to this hospital</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            These follow from the hospital&apos;s turnover and from what the department has told it.
            They are switches rather than a turnover figure, so a change in the thresholds does not
            make the software wrong.
          </p>
          <Toggle
            checked={form.sixDigitHsn}
            onChange={(v) => set('sixDigitHsn', v)}
            title="Report HSN and SAC at 6 digits"
            hint="Required above the reporting threshold. Below it, 4 digits is enough."
          />
          <Toggle
            checked={form.eInvoiceApplicable}
            onChange={(v) => set('eInvoiceApplicable', v)}
            title="E-invoicing applies"
            hint="Invoices must be registered on the portal and carry an IRN and QR code."
          />
          <Toggle
            checked={form.eWayBillApplicable}
            onChange={(v) => set('eWayBillApplicable', v)}
            title="E-way bills apply"
            hint="Only where goods physically move above the threshold. Rare for a hospital."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Your auditor&apos;s calls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Three positions the law leaves to judgement. The defaults are the ordinary reading —
            change them only on your auditor&apos;s advice.
          </p>
          <Toggle
            checked={form.inpatientCompositeExempt}
            onChange={(v) => set('inpatientCompositeExempt', v)}
            title="Medicines and consumables used on an admitted patient are exempt"
            hint="They form a composite supply with the treatment, which is the principal supply. On is the ordinary position."
          />
          <Toggle
            checked={form.dischargeMedicinesTaxable}
            onChange={(v) => set('dischargeMedicinesTaxable', v)}
            title="Medicines the patient takes home are taxable"
            hint="The patient carries them out, so this looks like a counter sale rather than part of the treatment."
          />
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              A room better than the medical need
            </Label>
            <Select
              value={form.roomUpgradeTreatment}
              onValueChange={(v: string | null) =>
                set('roomUpgradeTreatment', (v as RoomUpgradeTreatment) ?? 'accommodation')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {ROOM_UPGRADE.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {ROOM_UPGRADE.find((r) => r.value === form.roomUpgradeTreatment)?.hint}
            </p>
          </div>
        </CardContent>
      </Card>

      {!form.registered && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            While this is off, every bill is issued as a Bill of Supply with no tax. That is the
            correct behaviour for a hospital that is not registered — it is not a warning that
            something is broken.
          </span>
        </div>
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
    </div>
  );
}
