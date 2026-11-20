'use client';

import { useMemo, useState } from 'react';
import { IndianRupee, Loader2, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  useServiceTariffs, useUpdateServiceTariff, useCreateServiceTariff, type ServiceTariff,
} from '@/hooks/use-service-tariffs';
import { getApiErrorMessage } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Gap 352: OT charges on surgery / procedure tariffs.
//
// A tariff can be priced at ₹0 (an explicit no-charge procedure — Complete
// posts a labelled "₹0 — no charge" line) and can carry separate theatre,
// surgeon, anaesthesia and assistant charges. When any component is set,
// Complete bills the components INSTEAD of the single base price, never both.
// A blank component means "not configured"; 0 is a real price.
// ---------------------------------------------------------------------------

const COMPONENTS = [
  { key: 'otTheatreCharge', label: 'Theatre' },
  { key: 'otSurgeonCharge', label: 'Surgeon' },
  { key: 'otAnaesthesiaCharge', label: 'Anaesthesia' },
  { key: 'otAssistantCharge', label: 'Assistant' },
] as const;
type ComponentKey = (typeof COMPONENTS)[number]['key'];

type Draft = { basePrice: string } & Record<ComponentKey, string>;

const toText = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(Number(v)));
const toNum = (s: string): number | null => (s.trim() === '' ? null : Number(s));
const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function draftOf(t: ServiceTariff): Draft {
  return {
    basePrice: toText(t.basePrice),
    otTheatreCharge: toText(t.otTheatreCharge),
    otSurgeonCharge: toText(t.otSurgeonCharge),
    otAnaesthesiaCharge: toText(t.otAnaesthesiaCharge),
    otAssistantCharge: toText(t.otAssistantCharge),
  };
}

/** What Complete will bill for this draft — mirrors the backend precedence. */
export function otBillingSummary(d: Draft): string {
  const comps = COMPONENTS.map((c) => ({ label: c.label, v: toNum(d[c.key]) })).filter((c) => c.v !== null);
  if (comps.length > 0) {
    const total = comps.reduce((s, c) => s + (c.v ?? 0), 0);
    if (total === 0) return '₹0 — no charge';
    return `${rupees(total)} as ${comps.filter((c) => (c.v ?? 0) > 0).map((c) => c.label.toLowerCase()).join(' + ')}`;
  }
  const base = toNum(d.basePrice);
  if (base === null) return 'No price';
  return base === 0 ? '₹0 — no charge' : `${rupees(base)} (single procedure charge)`;
}

function invalid(d: Draft): string | null {
  for (const [k, v] of Object.entries(d)) {
    const n = toNum(v);
    if (k === 'basePrice' && n === null) return 'Base price is required (0 = no charge).';
    if (n !== null && (!Number.isFinite(n) || n < 0)) return 'Prices cannot be negative.';
  }
  return null;
}

export function OtTariffChargesCard({ canEdit }: { canEdit: boolean }) {
  const surgery = useServiceTariffs({ category: 'surgery', limit: 200 });
  const procedure = useServiceTariffs({ category: 'procedure', limit: 200 });
  const update = useUpdateServiceTariff();
  const create = useCreateServiceTariff();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newDraft, setNewDraft] = useState<Draft>({
    basePrice: '', otTheatreCharge: '', otSurgeonCharge: '', otAnaesthesiaCharge: '', otAssistantCharge: '',
  });

  const tariffs = useMemo(
    () => [...(surgery.data?.data ?? []), ...(procedure.data?.data ?? [])].sort((a, b) => a.serviceName.localeCompare(b.serviceName)),
    [surgery.data, procedure.data],
  );
  const isLoading = surgery.isLoading || procedure.isLoading;

  const save = (t: ServiceTariff) => {
    const d = drafts[t.id] ?? draftOf(t);
    const err = invalid(d);
    if (err) return toast.error(err);
    update.mutate(
      {
        id: t.id,
        basePrice: Number(d.basePrice),
        otTheatreCharge: toNum(d.otTheatreCharge),
        otSurgeonCharge: toNum(d.otSurgeonCharge),
        otAnaesthesiaCharge: toNum(d.otAnaesthesiaCharge),
        otAssistantCharge: toNum(d.otAssistantCharge),
      },
      {
        onSuccess: () => {
          toast.success(`${t.serviceName}: OT charges saved`);
          setDrafts((all) => {
            const next = { ...all };
            delete next[t.id];
            return next;
          });
        },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save the tariff')),
      },
    );
  };

  const add = () => {
    const err = invalid(newDraft) ?? (!newName.trim() || !newCode.trim() ? 'Name and code are required.' : null);
    if (err) return toast.error(err);
    create.mutate(
      {
        name: newName.trim(),
        code: newCode.trim(),
        category: 'surgery',
        basePrice: Number(newDraft.basePrice),
        otTheatreCharge: toNum(newDraft.otTheatreCharge),
        otSurgeonCharge: toNum(newDraft.otSurgeonCharge),
        otAnaesthesiaCharge: toNum(newDraft.otAnaesthesiaCharge),
        otAssistantCharge: toNum(newDraft.otAssistantCharge),
      },
      {
        onSuccess: () => {
          toast.success('Surgery tariff added');
          setAdding(false);
          setNewName('');
          setNewCode('');
          setNewDraft({ basePrice: '', otTheatreCharge: '', otSurgeonCharge: '', otAnaesthesiaCharge: '', otAssistantCharge: '' });
        },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Could not add the tariff')),
      },
    );
  };

  const priceCell = (value: string, onChange: (v: string) => void, label: string) => (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      aria-label={label}
      placeholder="—"
      value={value}
      disabled={!canEdit}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-24 text-right text-xs"
    />
  );

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary">
      <div className="p-5 border-b flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <IndianRupee className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-headline text-lg font-bold">Surgery Tariffs &amp; OT Charges</h2>
            <p className="text-sm text-muted-foreground">
              What Complete posts to the patient&apos;s bill. Set theatre / surgeon / anaesthesia / assistant
              charges to bill them as separate lines (they replace the base price); leave them blank to bill the
              base price. ₹0 is an explicit no-charge procedure.
            </p>
          </div>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setAdding((a) => !a)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add surgery tariff
          </Button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {adding && canEdit && (
          <div className="rounded-lg border p-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Procedure name (must match the OT booking)</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Code</Label>
                <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">Base price</Label>
                {priceCell(newDraft.basePrice, (v) => setNewDraft({ ...newDraft, basePrice: v }), 'Base price')}
              </div>
              {COMPONENTS.map((c) => (
                <div key={c.key}>
                  <Label className="text-xs">{c.label}</Label>
                  {priceCell(newDraft[c.key], (v) => setNewDraft({ ...newDraft, [c.key]: v }), `${c.label} charge`)}
                </div>
              ))}
              <Button size="sm" onClick={add} disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Bills: {otBillingSummary(newDraft)}</p>
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : tariffs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No surgery or procedure tariffs yet. Without one (or a charge typed on the booking), completing a case
            bills nothing.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-widest text-on-surface-variant">
                  <th className="px-2 py-2">Procedure</th>
                  <th className="px-2 py-2 text-right">Base price</th>
                  {COMPONENTS.map((c) => (
                    <th key={c.key} className="px-2 py-2 text-right">{c.label}</th>
                  ))}
                  <th className="px-2 py-2">Complete bills</th>
                  {canEdit && <th className="px-2 py-2" />}
                </tr>
              </thead>
              <tbody>
                {tariffs.map((t) => {
                  const d = drafts[t.id] ?? draftOf(t);
                  const dirty = !!drafts[t.id];
                  const set = (k: keyof Draft, v: string) => setDrafts((all) => ({ ...all, [t.id]: { ...d, [k]: v } }));
                  return (
                    <tr key={t.id} className="border-b last:border-b-0 align-middle">
                      <td className="px-2 py-2">
                        <div className="font-medium">{t.serviceName}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {t.serviceCode ?? ''} · {t.category}
                          {!t.isActive && <Badge variant="outline" className="ml-1 text-[9px]">inactive</Badge>}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">{priceCell(d.basePrice, (v) => set('basePrice', v), 'Base price')}</td>
                      {COMPONENTS.map((c) => (
                        <td key={c.key} className="px-2 py-2 text-right">
                          {priceCell(d[c.key], (v) => set(c.key, v), `${c.label} charge`)}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-xs text-muted-foreground">{otBillingSummary(d)}</td>
                      {canEdit && (
                        <td className="px-2 py-2">
                          <Button size="sm" variant={dirty ? 'default' : 'ghost'} disabled={!dirty || update.isPending} onClick={() => save(t)}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
