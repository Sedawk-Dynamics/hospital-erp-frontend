'use client';

// ============================================================
// Emergency / Casualty — the "Golden Hour" console (design doc IV).
// "Bypass Validation, Retrospective Merge": an unidentified trauma patient is
// treated before registration. The ER mints a temporary pseudo-ID (TEMP-ER-…),
// life-saving drugs are dispensed against it WITHOUT deposit/registration gates
// (the cost sits on a deferred-hold bill), and once the patient is formally
// registered the whole pharmacy history is merged onto the permanent MRN.
// Flow: [Trauma pseudo-ID] → [Bypass dispense] → [Deferred hold] → [Register & merge]
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import {
  Siren,
  Plus,
  Loader2,
  Search,
  X,
  PackageCheck,
  UserPlus,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import {
  useEmergencyPatients,
  useCreateEmergencyPatient,
  useCreatePharmacySale,
  useFormulary,
  useBatchesByDrug,
  type EmergencyPatient,
  type DrugBatch,
} from '@/hooks/use-pharmacy';
import { EmergencyMergeDialog } from '@/components/pharmacy/emergency-merge-dialog';

const inr = (n?: number | null) => `₹${Number(n ?? 0).toFixed(2)}`;
const NONE = 'none';

// ============================================================
// Main page
// ============================================================

export default function EmergencyGoldenHourPage() {
  const { data: emergencies = [], isLoading, isError } = useEmergencyPatients();

  const [createOpen, setCreateOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [dispenseTarget, setDispenseTarget] = useState<EmergencyPatient | null>(null);

  const totalHeld = useMemo(
    () => emergencies.reduce((s, e) => s + Number(e.heldAmount ?? 0), 0),
    [emergencies],
  );

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline text-xl font-bold flex items-center gap-2">
            <Siren className="h-5 w-5 text-rose-500" />
            Emergency · Golden Hour
          </h1>
          <p className="text-xs text-muted-foreground">
            Treat first, register later. Mint a trauma pseudo-ID, dispense life-saving drugs on a
            deferred hold, then merge onto the permanent record after registration.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMergeOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Register &amp; Merge
          </Button>
          <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => setCreateOpen(true)}>
            <Siren className="mr-1.5 h-4 w-4" />
            Emergency Trauma Admission
          </Button>
        </div>
      </div>

      {/* Golden-hour flow strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
        <span className="font-medium text-muted-foreground">Golden Hour:</span>
        {['Trauma pseudo-ID', 'Bypass dispense', 'Deferred hold', 'Register & merge'].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-2">
            <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700 border border-rose-200">
              {s}
            </span>
            {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
          </span>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Active trauma IDs</div>
          <div className="text-2xl font-bold">{isLoading ? '·' : emergencies.length}</div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Deferred hold total</div>
          <div className="text-2xl font-bold font-mono">{inr(totalHeld)}</div>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 hidden sm:block">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">To reconcile</div>
          <div className="text-sm text-muted-foreground pt-1.5">
            Register each patient, then merge the hold onto their IPD bill.
          </div>
        </div>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load emergency patients.
        </div>
      )}

      {/* Active emergency (temp) patients */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sanctuary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-container">
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Pseudo-ID</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Label</th>
                <th className="px-4 pb-4 pt-5 text-left font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Opened</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Bills</th>
                <th className="px-4 pb-4 pt-5 text-right font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Deferred hold</th>
                <th className="px-4 pb-4 pt-5 text-center font-semibold text-on-surface-variant font-label text-[10px] uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  </td>
                </tr>
              ) : emergencies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Siren className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No active trauma IDs. Click <b>Emergency Trauma Admission</b> to open one.
                    </p>
                  </td>
                </tr>
              ) : (
                emergencies.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium text-rose-700">{e.mrn}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{`${e.firstName} ${e.lastName ?? ''}`.trim()}</span>
                      {e.phone && <div className="text-xs text-muted-foreground">{e.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(e.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{e.billCount}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">{inr(e.heldAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => setDispenseTarget(e)}
                        >
                          <PackageCheck className="mr-1 h-3.5 w-3.5" />
                          Bypass Dispense
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialogs */}
      <CreateEmergencyDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(p) => setDispenseTarget(p)} />
      {dispenseTarget && (
        <BypassDispenseDialog patient={dispenseTarget} onClose={() => setDispenseTarget(null)} />
      )}
      <EmergencyMergeDialog open={mergeOpen} onOpenChange={setMergeOpen} />
    </div>
  );
}

// ============================================================
// Emergency Trauma Admission — mint a TEMP-ER pseudo-ID
// ============================================================

function CreateEmergencyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (patient: EmergencyPatient) => void;
}) {
  const create = useCreateEmergencyPatient();
  const [label, setLabel] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');

  const reset = () => {
    setLabel('');
    setGender('');
    setPhone('');
  };

  const submit = () => {
    create.mutate(
      {
        firstName: label.trim() || undefined,
        gender: gender || undefined,
        phone: phone.trim() || undefined,
      },
      {
        onSuccess: (p) => {
          toast.success(`Trauma ID minted · ${p.mrn}`);
          // Fabricate an EmergencyPatient shell so the caller can dispense right away.
          onCreated({
            id: p.id,
            mrn: p.mrn,
            firstName: p.firstName,
            lastName: p.lastName ?? null,
            createdAt: new Date().toISOString(),
            billCount: 0,
            heldAmount: 0,
            balanceDue: 0,
          });
          reset();
          onOpenChange(false);
        },
        onError: (err: any) => toast.error(err?.message ?? 'Failed to open a trauma ID'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-4 w-4 text-rose-500" /> Emergency Trauma Admission
          </DialogTitle>
          <DialogDescription>
            No name, address or payment required. A temporary pseudo-ID (TEMP-ER-…) is generated so
            treatment can start immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Triage label (optional)</Label>
            <Input
              placeholder="e.g. Unknown male, RTA — bay 3"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Defaults to “Emergency Patient” if left blank.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={gender || NONE} onValueChange={(v: string | null) => setGender(v === NONE ? '' : v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Unknown" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unknown</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Attendant phone</Label>
              <Input placeholder="Optional" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-rose-600 hover:bg-rose-700" onClick={submit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Open Trauma ID
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Bypass Dispense — life-saving drugs against a trauma ID (deferred hold)
// ============================================================

interface BypassLine {
  key: number;
  drugId: string;
  drugName: string;
  looseUnitLabel?: string | null;
  drugBatchId: string;
  batchLabel: string;
  noStock: boolean;
  qty: string;
  saleUnit: 'pack' | 'loose';
}

let bypassKeySeq = 1;

function BypassDispenseDialog({
  patient,
  onClose,
}: {
  patient: EmergencyPatient;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const sale = useCreatePharmacySale();
  const [lines, setLines] = useState<BypassLine[]>([
    { key: 0, drugId: '', drugName: '', drugBatchId: '', batchLabel: '', noStock: false, qty: '', saleUnit: 'pack' },
  ]);

  const addLine = () =>
    setLines((ls) => [
      ...ls,
      { key: bypassKeySeq++, drugId: '', drugName: '', drugBatchId: '', batchLabel: '', noStock: false, qty: '', saleUnit: 'pack' },
    ]);
  const updateLine = (key: number, patch: Partial<BypassLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: number) =>
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  const submit = () => {
    const items = lines
      .filter((l) => l.drugBatchId && Number(l.qty) > 0)
      .map((l) => ({ drugBatchId: l.drugBatchId, quantity: Number(l.qty), saleUnit: l.saleUnit }));
    if (items.length === 0) return toast.error('Add at least one in-stock drug with a quantity');

    // amountPaid: 0 → an explicitly UNPAID (pending) Bill on the trauma ID = the
    // deferred hold ledger. No phantom payment is recorded, so after the merge the
    // IPD bill still shows the cost as owed and it gets settled at final billing.
    sale.mutate(
      { patientId: patient.id, items, amountPaid: 0 },
      {
        onSuccess: () => {
          toast.success('Dispensed — cost held on the deferred ledger for this trauma ID');
          qc.invalidateQueries({ queryKey: ['pharmacy', 'emergency-patients'] });
          onClose();
        },
        onError: (err: any) => toast.error(err?.message ?? 'Failed to dispense'),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-500" />
            Bypass dispense
            <Badge variant="outline" className="font-mono text-[10px] text-rose-700 border-rose-300">{patient.mrn}</Badge>
          </DialogTitle>
          <DialogDescription>
            Deposit / registration / insurance checks are bypassed. Stock is deducted in real time
            (FEFO batch) and the cost is parked on the deferred hold — settled after the merge.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <div className="flex items-center justify-between">
            <Label>Life-saving drugs</Label>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add drug
            </Button>
          </div>
          {lines.map((line) => (
            <BypassDispenseLine
              key={line.key}
              line={line}
              canRemove={lines.length > 1}
              onChange={(patch) => updateLine(line.key, patch)}
              onRemove={() => removeLine(line.key)}
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-rose-600 hover:bg-rose-700" onClick={submit} disabled={sale.isPending}>
            {sale.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Dispense (hold)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// One drug line — searches the formulary and auto-resolves the FEFO batch.
function BypassDispenseLine({
  line,
  canRemove,
  onChange,
  onRemove,
}: {
  line: BypassLine;
  canRemove: boolean;
  onChange: (patch: Partial<BypassLine>) => void;
  onRemove: () => void;
}) {
  const [search, setSearch] = useState('');
  const fq = useFormulary(search.trim().length >= 1 ? { search: search.trim() } : undefined);
  const drugs = fq.data?.data ?? [];
  const batchesQ = useBatchesByDrug(line.drugId || null);

  // Auto-pick the earliest-expiring in-stock batch once a drug is chosen.
  useEffect(() => {
    if (!line.drugId || line.drugBatchId) return;
    if (batchesQ.isLoading || !batchesQ.data) return;
    const usable = (batchesQ.data as DrugBatch[])
      .filter((b) => !b.isExpired && !b.isRecalled && b.quantityInStock > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    const fefo = usable[0];
    if (fefo) {
      const exp = fefo.expiryDate ? new Date(fefo.expiryDate).toLocaleDateString('en-GB') : '—';
      onChange({ drugBatchId: fefo.id, batchLabel: `Batch ${fefo.batchNumber} · exp ${exp} · ${fefo.quantityInStock} in stock`, noStock: false });
    } else {
      onChange({ noStock: true, batchLabel: 'No stock available' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.drugId, line.drugBatchId, batchesQ.data, batchesQ.isLoading]);

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {line.drugId ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium truncate">{line.drugName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange({ drugId: '', drugName: '', drugBatchId: '', batchLabel: '', noStock: false });
                    setSearch('');
                  }}
                >
                  Change
                </Button>
              </div>
              <div className={cn('text-[11px]', line.noStock ? 'text-red-600' : 'text-muted-foreground')}>
                {batchesQ.isLoading && !line.batchLabel ? 'Resolving FEFO batch…' : line.batchLabel}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search drug..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {search.trim().length >= 1 && (
                <div className="rounded-md border bg-popover max-h-40 overflow-y-auto shadow-md">
                  {fq.isLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                    </div>
                  ) : drugs.length > 0 ? (
                    drugs.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          onChange({ drugId: d.id, drugName: d.drugName, looseUnitLabel: d.looseUnitLabel, drugBatchId: '', batchLabel: '', noStock: false });
                          setSearch('');
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                      >
                        <span className="font-medium">{d.drugName}</span>
                        {d.strength && <span className="ml-1 text-xs text-muted-foreground">{d.strength}</span>}
                        {d.isLifeSaving && (
                          <span className="ml-2 text-[10px] font-medium text-emerald-600">Life-saving</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No drugs found</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <Input
          type="number"
          min={1}
          placeholder="Qty"
          value={line.qty}
          onChange={(e) => onChange({ qty: e.target.value })}
          className="w-20 shrink-0"
        />

        <div className="w-28 shrink-0">
          <Select
            value={line.saleUnit}
            onValueChange={(v: string | null) => onChange({ saleUnit: (v as 'pack' | 'loose') ?? 'pack' })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pack">Pack</SelectItem>
              <SelectItem value="loose">{line.looseUnitLabel || 'Loose'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-red-600"
          onClick={onRemove}
          disabled={!canRemove}
          title="Remove"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
