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
import {
  ArrowLeft,
  BadgeCheck,
  Loader2,
  RefreshCw,
  Save,
  ReceiptIndianRupee,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
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
  useGstinVerificationProvider,
  useVerifyGstin,
  EMPTY_GST_PROFILE,
  SANDBOX_LABEL,
  type GstinProviderInfo,
  type GstinVerificationState,
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

/** Loose legal-name comparison, mirroring the server's (case, punctuation, PVT/LTD). */
function normaliseLegalName(name: string): string {
  return name
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\bPVT\b/g, 'PRIVATE')
    .replace(/\bLTD\b/g, 'LIMITED')
    .replace(/\bCO\b/g, 'COMPANY')
    .replace(/\s+/g, ' ')
    .trim();
}

const fmtWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** The precise reason a GSTIN is not verified, in words (gap #311). */
function unverifiedReason(v: GstinVerificationState | null | undefined, provider: GstinProviderInfo | undefined): string {
  switch (v?.status) {
    case 'not_found':
      return 'Not found on the GST portal';
    case 'inactive':
      return `Inactive — registration status is “${v.registrationStatus ?? 'unknown'}”`;
    case 'error':
      return v.lastError?.startsWith('Lookup failed') ? v.lastError : `Lookup failed: ${v.lastError ?? 'unknown error'}`;
    case 'stale':
      return `The last check was for a different GSTIN (${v.checkedGstin ?? '—'})`;
    case 'unreadable':
      return 'The verification record could not be read';
    default:
      return provider && !provider.configured ? 'Provider not configured' : 'Never checked with the GST provider';
  }
}

/**
 * Gap #311: Verify the SAVED GSTIN through the hospital's GST service provider
 * and show what it said — or exactly why the number is still unverified.
 * Reads the saved profile (not the form) so it can never show a verification
 * for a number that is only typed, not saved.
 */
function GstinVerificationPanel({
  gstinText,
  legalNameText,
}: {
  gstinText: string;
  legalNameText: string | null;
}) {
  const { data: saved } = useGstProfile();
  const { data: provider } = useGstinVerificationProvider();
  const verify = useVerifyGstin();
  const [lastAttemptError, setLastAttemptError] = useState<string | null>(null);

  const savedGstin = saved?.gstin ?? null;
  if (!savedGstin) return null;

  const v = saved?.gstinVerification;
  const verified = !!saved?.gstinVerified;
  const sandbox = !!v?.sandbox;
  const unsaved = gstinText.trim().toUpperCase() !== savedGstin;
  const nameMismatch =
    !!v?.legalName &&
    !!legalNameText?.trim() &&
    v.status === 'verified' &&
    normaliseLegalName(v.legalName) !== normaliseLegalName(legalNameText);

  const onVerify = async () => {
    setLastAttemptError(null);
    try {
      const out = await verify.mutateAsync(savedGstin);
      if (out.result.status === 'verified') {
        toast.success(out.result.sandbox ? `GSTIN verified — ${SANDBOX_LABEL}` : 'GSTIN verified with the GST portal.');
      } else {
        toast.error(`GSTIN not verified: ${out.result.error ?? out.result.status}`);
      }
    } catch (e) {
      const msg = getApiErrorMessage(e, 'GSTIN verification failed.');
      setLastAttemptError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-md border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {verified ? (
            <BadgeCheck className={`h-4 w-4 ${sandbox ? 'text-amber-600' : 'text-green-600'}`} />
          ) : (
            <ShieldAlert className="h-4 w-4 text-red-600" />
          )}
          {verified
            ? sandbox
              ? 'Verified by the SANDBOX provider'
              : 'Verified with the GST portal'
            : 'Not verified'}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={onVerify}
          disabled={verify.isPending || unsaved || (provider ? !provider.configured : false)}
          title={
            unsaved
              ? 'Save the GSTIN first — only the saved number can be verified'
              : provider && !provider.configured
                ? provider.reason ?? 'Provider not configured'
                : undefined
          }
        >
          {verify.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {verified ? 'Re-verify' : 'Verify'}
        </Button>
      </div>

      {sandbox && (
        <p className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-200">
          {SANDBOX_LABEL}. For local testing only — reports and bills carry this label.
        </p>
      )}
      {provider?.sandbox && !sandbox && provider.configured && (
        <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
          The configured provider is the SANDBOX — {SANDBOX_LABEL}.
        </p>
      )}

      {verified && v ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
          <dt className="text-muted-foreground">GSTIN checked</dt>
          <dd className="font-mono">{v.checkedGstin}</dd>
          <dt className="text-muted-foreground">Legal name</dt>
          <dd>{v.legalName ?? '—'}</dd>
          {v.tradeName ? (
            <>
              <dt className="text-muted-foreground">Trade name</dt>
              <dd>{v.tradeName}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Registration status</dt>
          <dd>{v.registrationStatus ?? '—'}</dd>
          <dt className="text-muted-foreground">Provider</dt>
          <dd>{v.provider ?? '—'}</dd>
          <dt className="text-muted-foreground">Checked</dt>
          <dd>{fmtWhen(v.lastCheckedAt)}</dd>
        </dl>
      ) : (
        <div className="space-y-0.5 text-[12px]">
          <p className="text-red-700 dark:text-red-300">{unverifiedReason(v, provider)}</p>
          {v?.lastCheckedAt ? (
            <p className="text-muted-foreground">
              Last checked {fmtWhen(v.lastCheckedAt)} via {v.provider ?? '—'}
              {v.checkedGstin ? ` for ${v.checkedGstin}` : ''}.
            </p>
          ) : null}
          {provider && !provider.configured ? (
            <p className="text-muted-foreground">
              Provider not configured ({provider.reason ?? 'no GST service provider on this server'}).
              The GSTIN cannot be verified, so reports and bills keep showing it as not verified.
            </p>
          ) : null}
        </div>
      )}

      {nameMismatch && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The legal name on the GST registration (“{v?.legalName}”) differs from the legal name
          entered below (“{legalNameText}”). Correct the entered name to match the registration.
        </p>
      )}
      {unsaved && (
        <p className="text-[11px] text-muted-foreground">
          The GSTIN above is not saved yet. Save it, then verify — changing the GSTIN clears the
          previous verification.
        </p>
      )}
      {lastAttemptError && <p className="text-[11px] text-red-700 dark:text-red-300">{lastAttemptError}</p>}
    </div>
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
                // Not a real-looking GSTIN: the old placeholder was the GST
                // documentation's sample number, which then got saved (gap 311).
                placeholder="15-character GSTIN"
                maxLength={15}
                className="font-mono uppercase"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                15 characters. Format, state code and check digit are checked on save, and the PAN
                inside it must match the hospital PAN below. Those checks are not verification: use
                Verify below to confirm the number through the hospital&apos;s GST service provider.
                Until that succeeds, reports and bills show it as not verified.
              </p>
              {form.gstinChecks ? (
                <p
                  className={`mt-1 text-[11px] ${
                    form.gstinChecks.looksLikeSample || form.gstinChecks.panMatches === false
                      ? 'text-red-700'
                      : 'text-muted-foreground'
                  }`}
                >
                  {form.gstinChecks.looksLikeSample
                    ? 'This looks like a sample or placeholder GSTIN — check the registration certificate.'
                    : form.gstinChecks.panMatches === false
                      ? 'The PAN inside this GSTIN does not match the hospital PAN.'
                      : `Local checks passed: format, state code, check digit${
                          form.gstinChecks.panMatches ? ', PAN' : ''
                        }.`}
                </p>
              ) : null}
              <GstinVerificationPanel gstinText={gstinText} legalNameText={form.legalName} />
            </div>

            <div className="sm:col-span-2">
              <Label className="mb-1 block text-xs text-muted-foreground">Hospital PAN</Label>
              <Input
                value={form.pan ?? ''}
                onChange={(e) => set('pan', e.target.value.toUpperCase() || null)}
                placeholder="10-character PAN"
                maxLength={10}
                className="font-mono uppercase"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Optional. When entered, characters 3–12 of the GSTIN must be this PAN.
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
          {/* G-5: these switches RECORD that the law applies — they drive the
              D-1/D-2/D-3 registers, which then list every invoice still owed
              an IRN. They do not generate anything: there is no IRP or e-way
              bill portal integration (no API credentials), so nobody should
              read "on" as "our invoices are e-invoices". */}
          <Toggle
            checked={form.eInvoiceApplicable}
            onChange={(v) => set('eInvoiceApplicable', v)}
            title="E-invoicing applies — IRN generation not available"
            hint="Records the legal obligation only. This system does not register invoices on the IRP or print an IRN/QR."
          />
          <Toggle
            checked={form.eWayBillApplicable}
            onChange={(v) => set('eWayBillApplicable', v)}
            title="E-way bills apply — generation not available"
            hint="Records the obligation only. This system does not generate e-way bills. Rare for a hospital."
          />
          {(form.eInvoiceApplicable || form.eWayBillApplicable) && (
            <div
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
            >
              <b>Not available in this system.</b> There is no e-invoice (IRP) or e-way bill portal
              integration, so switching this on does not make invoices compliant. Invoices print
              without an IRN or QR code and say so. Register B2B invoices
              {form.eWayBillApplicable ? ' and generate e-way bills' : ''} on the government portal
              yourself; report D-2 lists every invoice still without an IRN.
            </div>
          )}

          {/* The two numbers behind the switches. Here rather than in the
              reports for the same reason as the switches themselves: both have
              already moved once, and a report that compiles one in starts
              lying the day the rule changes rather than the day this hospital
              does. Shown only when the switch above them is on, so a hospital
              outside the regime is not asked a question it cannot answer. */}
          {form.eInvoiceApplicable ? (
            <div className="pl-1">
              <Label className="mb-1 block text-xs text-muted-foreground">
                Days to register an invoice
              </Label>
              <Input
                type="number"
                min={0}
                max={365}
                className="max-w-[10rem]"
                value={String(form.eInvoiceUploadDays)}
                onChange={(e) => set('eInvoiceUploadDays', Number(e.target.value))}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                The window report D-2 measures its deadline against. Zero means the invoice must be
                registered the same day.
              </p>
            </div>
          ) : null}

          {form.eWayBillApplicable ? (
            <div className="pl-1">
              <Label className="mb-1 block text-xs text-muted-foreground">
                Consignment value needing an e-way bill
              </Label>
              <Input
                type="number"
                min={0}
                className="max-w-[12rem]"
                value={String(form.eWayBillThreshold)}
                onChange={(e) => set('eWayBillThreshold', Number(e.target.value))}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Report D-3 lists the goods movements that cross it.
              </p>
            </div>
          ) : null}
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
