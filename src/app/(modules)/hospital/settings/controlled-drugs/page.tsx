'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ShieldAlert, Loader2, Save, FileBadge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useControlledDrugPolicy,
  useUpdateControlledDrugPolicy,
  useDrugLicence,
  useUpdateDrugLicence,
  WITNESS_ROLE_CHOICES,
  type DrugLicenceSettings,
} from '@/hooks/use-controlled-drug-settings';
import { useSeedOnChange } from '@/hooks/use-seed-on-change';

/**
 * Controlled-drug policy and the hospital's statutory drug licences.
 *
 * The mode switch is the single thing that turns schedule enforcement on. It is
 * written to be read carefully rather than clicked past: both options spell out
 * what actually changes at the counter, because the wrong choice either leaves a
 * compliance hole open or starts refusing sales that used to go through.
 */
export default function ControlledDrugSettingsPage() {
  const { data: policy, isLoading } = useControlledDrugPolicy();
  const { data: licence, isLoading: licenceLoading } = useDrugLicence();
  const savePolicy = useUpdateControlledDrugPolicy();
  const saveLicence = useUpdateDrugLicence();

  const [mode, setMode] = useState<'legacy_block' | 'inline'>('legacy_block');
  const [roles, setRoles] = useState<string[]>([]);
  const [lic, setLic] = useState<DrugLicenceSettings>({
    retailLicenceNumber: '', wholesaleLicenceNumber: '', ndpsLicenceNumber: '',
    state: '', licenceHolderName: '', premisesAddress: '',
  });

  useSeedOnChange(policy ? 'controlled-drugs' : null, () => {
    if (!policy) return;
    setMode(policy.mode);
    setRoles(policy.witnessRoles);
  });
  useSeedOnChange(licence ? 'drug-licence' : null, () => {
    if (licence) setLic(licence);
  });

  const toggleRole = (value: string) =>
    setRoles((r) => (r.includes(value) ? r.filter((x) => x !== value) : [...r, value]));

  const onSavePolicy = async () => {
    if (roles.length === 0) {
      // An empty list would make every witnessed transaction impossible and
      // lock the hospital out of its own narcotics.
      toast.error('Choose at least one role that may witness.');
      return;
    }
    try {
      await savePolicy.mutateAsync({ mode, witnessRoles: roles });
      toast.success('Controlled-drug policy saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the policy');
    }
  };

  const onSaveLicence = async () => {
    try {
      await saveLicence.mutateAsync(lic);
      toast.success('Licence details saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the licence details');
    }
  };

  const licField = (k: keyof DrugLicenceSettings) => ({
    value: lic[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setLic((l) => ({ ...l, [k]: e.target.value })),
  });

  return (
    <div className="max-w-3xl space-y-6 p-4">
      <div>
        <h1 className="font-headline flex items-center gap-2 text-xl font-bold">
          <ShieldAlert className="h-5 w-5 text-primary" /> Controlled Drugs
        </h1>
        <p className="text-sm text-muted-foreground">
          How the pharmacy handles scheduled and narcotic medicines, and the licences printed on
          every statutory register.
        </p>
      </div>

      {/* ── Dispensing mode ── */}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-bold">Dispensing mode</h2>
        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <div className="space-y-2">
            <ModeOption
              selected={mode === 'legacy_block'}
              onSelect={() => setMode('legacy_block')}
              title="Refuse at the counter (current behaviour)"
              body="A vault narcotic cannot be dispensed from the counter, a ward, an indent or an OT kit — the user is told to use the NDPS workflow instead. Schedule H and H1 medicines sell with no prescription check. This is how the system has always worked."
            />
            <ModeOption
              selected={mode === 'inline'}
              onSelect={() => setMode('inline')}
              title="Collect the requirements on the same screen"
              body="A controlled medicine is dispensed where the user already is, once its requirements are met: Schedule H1 and X need a prescription (an outside one counts), and a vault narcotic additionally needs a second authorised person to co-sign with their own password. Nothing is refused without saying what is missing."
              warning="Switching this on starts requiring a prescription for every Schedule H1 and X medicine at the counter. Check how many of your stocked drugs that covers before you flip it."
            />
          </div>
        )}
      </section>

      {/* ── Who may witness ── */}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-bold">Who may witness a controlled hand-over</h2>
        <p className="text-xs text-muted-foreground">
          A witness always has to be a different person from the one dispensing, and always confirms
          with their own password — that is not configurable, it is the point of a witness.
        </p>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex flex-wrap gap-4">
            {WITNESS_ROLE_CHOICES.map((r) => (
              <label key={r.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={roles.includes(r.value)}
                  onChange={() => toggleRole(r.value)}
                  className="rounded border-border"
                />
                {r.label}
              </label>
            ))}
          </div>
        )}
        <Button size="sm" onClick={() => void onSavePolicy()} disabled={savePolicy.isPending || isLoading}>
          {savePolicy.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Save policy
        </Button>
      </section>

      {/* ── Statutory licences ── */}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <FileBadge className="h-4 w-4" /> Drug licences
        </h2>
        <p className="text-xs text-muted-foreground">
          Printed in the header of the Controlled-Drug Register and every statutory form. Left blank,
          the document goes out with an empty space where a legal identifier belongs.
        </p>
        {licenceLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lic-retail" className="text-xs">Retail licence (Form 20 / 21)</Label>
              <Input id="lic-retail" {...licField('retailLicenceNumber')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lic-wholesale" className="text-xs">Wholesale licence (Form 20B / 21B)</Label>
              <Input id="lic-wholesale" {...licField('wholesaleLicenceNumber')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lic-ndps" className="text-xs">NDPS licence</Label>
              <Input id="lic-ndps" placeholder="Essential Narcotic Drug licence" {...licField('ndpsLicenceNumber')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lic-state" className="text-xs">Issuing state</Label>
              <Input id="lic-state" placeholder="Registers are filed per state" {...licField('state')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lic-holder" className="text-xs">Licence holder</Label>
              <Input id="lic-holder" placeholder="If different from the hospital name" {...licField('licenceHolderName')} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lic-premises" className="text-xs">Registered premises</Label>
              <Input id="lic-premises" placeholder="The address the licence names" {...licField('premisesAddress')} />
            </div>
          </div>
        )}
        <Button size="sm" onClick={() => void onSaveLicence()} disabled={saveLicence.isPending || licenceLoading}>
          {saveLicence.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Save licences
        </Button>
      </section>
    </div>
  );
}

function ModeOption({
  selected, onSelect, title, body, warning,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  body: string;
  warning?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
            selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
          }`}
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{body}</p>
          {warning && selected && (
            <p className="text-xs font-medium text-warning">{warning}</p>
          )}
        </div>
      </div>
    </button>
  );
}
