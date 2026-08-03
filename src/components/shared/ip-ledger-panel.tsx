'use client';

import { useState } from 'react';
import {
  Plus, Loader2, Receipt, Wallet, Stethoscope, LogIn, LogOut, UserCog,
  FlaskConical, ScanLine, Pill, History, Activity, NotebookPen, Trash2, Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import { BillPrintDialog } from '@/components/hospital/billing/bill-print-dialog';
import {
  useAdmissionLedger, useAddIpCharge, useRemoveIpCharge, useAdmissionActivity,
  type ActivityEvent, type LedgerLine,
} from '@/hooks/use-ip-ledger';
import { IpProgressNoteComposer } from '@/components/doctor/ip-progress-note-composer';

type Role = 'doctor' | 'nurse' | 'admin';

// Categories offered in the MANUAL add-charge dialog. Lab, imaging (radiology),
// pharmacy and OT/surgery are deliberately NOT here — those charges flow onto the
// ledger automatically when the doctor orders them, so offering them here would
// double-count.
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'consultation', label: 'Doctor / professional fee' },
  { value: 'procedure', label: 'Nursing / procedure' },
  { value: 'consumable', label: 'Consumable / supplies' },
  { value: 'room', label: 'Bed / room extra' },
  { value: 'other', label: 'Other hospital charge' },
];

// Display labels — covers auto-pulled categories too (they still appear in the
// ledger table and category chips even though they can't be added by hand).
const CATEGORY_LABELS: Record<string, string> = {
  consultation: 'Doctor / professional',
  procedure: 'Nursing / procedure',
  consumable: 'Consumable',
  room: 'Bed / room',
  surgery: 'Surgery / OT',
  lab: 'Lab',
  radiology: 'Imaging',
  pharmacy: 'Pharmacy',
  other: 'Other',
};
const catLabel = (c: string) => CATEGORY_LABELS[c] ?? c;
const money = (n: number) => `₹${(n ?? 0).toFixed(2)}`;

// ---------------------------------------------------------------- Add charge

function AddChargeDialog({
  admissionId, role, open, onOpenChange,
}: {
  admissionId: string;
  role: Role;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const add = useAddIpCharge(admissionId);
  const defaultCat = role === 'nurse' ? 'procedure' : 'other';
  const [category, setCategory] = useState(defaultCat);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);

  const reset = () => {
    setCategory(defaultCat); setDescription(''); setQuantity(0); setUnitPrice(0); setTaxRate(0);
  };

  const total = Math.max(0, unitPrice) * Math.max(0, quantity) * (1 + Math.max(0, taxRate) / 100);

  const submit = async () => {
    if (!description.trim()) { toast.error('Enter a description.'); return; }
    if (!(unitPrice > 0)) { toast.error('Enter a unit price.'); return; }
    if (!(quantity > 0)) { toast.error('Enter a quantity.'); return; }
    try {
      await add.mutateAsync({ category, description: description.trim(), quantity, unitPrice, taxRate });
      toast.success('Charge added to the ledger.');
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed to add the charge.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Add charge to ledger</DialogTitle>
          <DialogDescription>
            {role === 'nurse'
              ? 'Record a nursing procedure, consumable or bed charge.'
              : 'Record a treatment, consumable or other hospital charge. Lab, imaging and pharmacy are added automatically when ordered.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={(v) => { if (v) setCategory(v); }}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Quantity</Label>
              <NumberInput min={0} integer value={quantity} onValueChange={setQuantity} className="mt-1 h-8 text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Charge name</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Dressing change, Oxygen (per hour), IV cannula" className="mt-1 h-8 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Unit price (₹)</Label>
              <NumberInput min={0} step="0.01" value={unitPrice} onValueChange={setUnitPrice} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Tax %</Label>
              <NumberInput min={0} max={100} step="0.01" value={taxRate} onValueChange={setTaxRate} className="mt-1 h-8 text-sm" />
            </div>
          </div>

          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Line total</span>
            <span className="font-semibold">{money(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={add.isPending}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add charge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------- Doctor visit

// A doctor visit is recorded by WRITING the round's IP progress note (the visit
// note goes into the admission's running log); the note composer optionally posts
// the consultation fee at the same time. This keeps "a visit" tied to "a note".
function RecordVisitButton({ admissionId, patientId }: { admissionId: string; patientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm" variant="outline" className="h-7 gap-1 text-xs"
        onClick={() => setOpen(true)}
        title="Record a doctor visit — write the round's progress note (and optionally bill the visit)"
      >
        <Stethoscope className="h-3 w-3" /> Add visit
      </Button>
      <IpProgressNoteComposer
        open={open}
        onOpenChange={setOpen}
        patientId={patientId}
        admissionId={admissionId}
        defaultBillVisit
      />
    </>
  );
}

// ------------------------------------------------------------ Activity log

const EVENT_STYLE: Record<ActivityEvent['type'], { icon: typeof Stethoscope; color: string; bg: string; label: string }> = {
  admission: { icon: LogIn, color: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Admission' },
  discharge: { icon: LogOut, color: 'text-slate-700', bg: 'bg-slate-200', label: 'Discharge' },
  doctor_visit: { icon: Stethoscope, color: 'text-primary', bg: 'bg-primary/10', label: 'Doctor visit' },
  progress_note: { icon: NotebookPen, color: 'text-teal-700', bg: 'bg-teal-100', label: 'Progress note' },
  vitals: { icon: Activity, color: 'text-pink-700', bg: 'bg-pink-100', label: 'Vitals' },
  charge: { icon: Receipt, color: 'text-amber-700', bg: 'bg-amber-100', label: 'Charge' },
  payment: { icon: Wallet, color: 'text-green-700', bg: 'bg-green-100', label: 'Payment' },
  nurse_assignment: { icon: UserCog, color: 'text-blue-700', bg: 'bg-blue-100', label: 'Nurse' },
  lab_order: { icon: FlaskConical, color: 'text-violet-700', bg: 'bg-violet-100', label: 'Lab' },
  imaging_request: { icon: ScanLine, color: 'text-cyan-700', bg: 'bg-cyan-100', label: 'Imaging' },
  prescription: { icon: Pill, color: 'text-rose-700', bg: 'bg-rose-100', label: 'Prescription' },
};

const ALL_TYPES = Object.keys(EVENT_STYLE) as ActivityEvent['type'][];

/**
 * The full admit-to-discharge activity log — a detailed, filterable timeline.
 * Same care-team access as the ledger (gated server-side).
 */
export function IpActivityLog({ admissionId }: { admissionId: string }) {
  const { data, isLoading } = useAdmissionActivity(admissionId);
  const [filter, setFilter] = useState<ActivityEvent['type'] | 'all'>('all');

  const events = data?.events ?? [];
  const present = ALL_TYPES.filter((t) => events.some((e) => e.type === t));
  const shown = filter === 'all' ? events : events.filter((e) => e.type === filter);

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="h-4 w-4 text-primary" />
          Activity Log
          <span className="text-[11px] font-normal text-muted-foreground">— full record, admit to discharge</span>
        </h2>
        {data && (
          <span className="text-[11px] text-muted-foreground">
            {data.count} event{data.count === 1 ? '' : 's'}
            {data.admittedAt && <> · admitted {formatDateTimeAmPm(data.admittedAt)}</>}
            {data.dischargedAt ? <> · discharged {formatDateTimeAmPm(data.dischargedAt)}</> : <> · ongoing</>}
          </span>
        )}
      </div>

      {/* Type filters */}
      {present.length > 1 && (
        <div className="mb-4 mt-2 flex flex-wrap gap-1.5">
          <button
            type="button" onClick={() => setFilter('all')}
            className={cn('rounded-full border px-2.5 py-0.5 text-[11px] transition-colors', filter === 'all' ? 'border-primary bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:bg-accent')}
          >
            All ({events.length})
          </button>
          {present.map((t) => {
            const s = EVENT_STYLE[t];
            const n = events.filter((e) => e.type === t).length;
            return (
              <button
                key={t} type="button" onClick={() => setFilter(t)}
                className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors', filter === t ? 'border-primary bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:bg-accent')}
              >
                <s.icon className={cn('h-3 w-3', filter === t ? 'text-primary' : s.color)} />
                {s.label} ({n})
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading activity…</div>
      ) : !data ? (
        <p className="text-xs text-muted-foreground">Activity log unavailable.</p>
      ) : shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ol className="relative space-y-4 pl-1">
          {shown.map((e, i) => {
            const s = EVENT_STYLE[e.type] ?? EVENT_STYLE.charge;
            const Icon = s.icon;
            const meta = e.meta ? Object.entries(e.meta) : [];
            return (
              <li key={i} className="relative flex gap-3">
                {i < shown.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%+4px)] w-px bg-border" />}
                <span className={cn('z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', s.bg)}>
                  <Icon className={cn('h-4 w-4', s.color)} />
                </span>
                <div className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{e.title}</p>
                    <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">{formatDateTimeAmPm(e.at)}</span>
                  </div>
                  {e.detail && <p className="mt-1 text-xs text-muted-foreground break-words">{e.detail}</p>}

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {e.actor && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><UserCog className="h-3 w-3" /> {e.actor}</span>}
                    {e.status && <Badge variant="outline" className="text-[9px] capitalize">{e.status.replace(/_/g, ' ')}</Badge>}
                    {typeof e.amount === 'number' && e.amount > 0 && (
                      <span className="ml-auto text-xs font-semibold text-foreground">{money(e.amount)}</span>
                    )}
                  </div>

                  {meta.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
                      {meta.map(([k, v]) => (
                        <span key={k} className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px]">
                          <span className="uppercase tracking-wide text-muted-foreground">{k}</span>
                          <span className="font-medium text-foreground capitalize">{v}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// --------------------------------------------------------------- The panel

export function IpLedgerPanel({ admissionId, patientId, role }: { admissionId: string; patientId: string; role: Role }) {
  const { data: ledger, isLoading } = useAdmissionLedger(admissionId);
  const [addOpen, setAddOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const removeCharge = useRemoveIpCharge(admissionId);
  const isTpa = ledger?.billingCategory === 'insurance' || ledger?.billingCategory === 'corporate';

  // Only manually-posted lines can be removed here — auto-pulled (pending/order)
  // charges come from lab/pharmacy/room/etc. and are managed at source. A nurse
  // may remove only the charges they added themselves (addedByMe); doctors /
  // billing keep the broader ability.
  const canRemove = (l: LedgerLine) =>
    l.status === 'posted' && !l.isAutoPulled && (role !== 'nurse' || !!l.addedByMe);
  const onRemove = async (l: LedgerLine) => {
    if (!window.confirm(`Remove "${l.description}" (${money(l.totalAmount)}) from the ledger?`)) return;
    try {
      await removeCharge.mutateAsync(l.id);
      toast.success('Charge removed from the ledger.');
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed to remove the charge.');
    }
  };

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Receipt className="h-4 w-4 text-primary" />
            Billing Ledger
            {ledger && (
              <Badge variant="outline" className="text-[10px] capitalize">{ledger.billingCategory}</Badge>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {role === 'doctor' && <RecordVisitButton admissionId={admissionId} patientId={patientId} />}
            {/* The printable bill for this stay — reachable from the ward, not
                only from the billing counter, and at any point in the stay. */}
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => setPrintOpen(true)}
              title="Print / download the bill for this stay"
            >
              <Printer className="h-3 w-3" /> Print bill
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setAddOpen(true)}>
              <Plus className="h-3 w-3" /> Add charge
            </Button>
          </div>
        </div>

        <AddChargeDialog admissionId={admissionId} role={role} open={addOpen} onOpenChange={setAddOpen} />
        <BillPrintDialog admissionId={printOpen ? admissionId : null} open={printOpen} onOpenChange={setPrintOpen} />

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !ledger ? (
          <p className="text-xs text-muted-foreground">Ledger unavailable.</p>
        ) : (
          <div className="space-y-3">
            {/* Totals strip */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Grand total</p>
                <p className="text-base font-bold text-foreground">{money(ledger.totals.grandTotal)}</p>
                {/* A counter concession is recorded on the bill header, not on
                    the lines — say so, or the total looks short of the charges. */}
                {ledger.totals.discount > 0 && (
                  <p className="text-[10px] text-emerald-600">after {money(ledger.totals.discount)} discount</p>
                )}
              </div>
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Posted / pending</p>
                <p className="text-sm font-medium">{money(ledger.totals.posted)} <span className="text-amber-600">+ {money(ledger.totals.pending)}</span></p>
              </div>
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Deposit / paid</p>
                <p className="text-sm font-medium">{money(ledger.totals.deposit)} / {money(ledger.totals.paid)}</p>
              </div>
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Balance</p>
                <p className="text-base font-bold text-foreground">{money(ledger.totals.balanceAfterDeposit)}</p>
              </div>
            </div>

            {/* TPA split (insurance / corporate patients) */}
            {isTpa && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-purple-300 bg-purple-50/50 px-3 py-2 text-xs">
                <Wallet className="h-3.5 w-3.5 text-purple-700" />
                <span className="text-purple-800">Insurer (reimbursable): <strong>{money(ledger.totals.reimbursable)}</strong></span>
                <span className="text-purple-800">· Patient (out-of-pocket): <strong>{money(ledger.totals.nonReimbursable)}</strong></span>
              </div>
            )}

            {/* Category totals */}
            {ledger.categoryTotals.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {ledger.categoryTotals.map((c) => (
                  <span key={c.category} className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px]">
                    <span className="capitalize text-muted-foreground">{catLabel(c.category)}</span>
                    <span className="font-medium">{money(c.total)}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Itemized lines */}
            {ledger.lines.length === 0 ? (
              <p className="text-xs text-muted-foreground">No charges yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                      <th className="px-2 py-1.5 whitespace-nowrap">Date / Time</th>
                      <th className="px-2 py-1.5">Item</th>
                      <th className="px-2 py-1.5">Category</th>
                      <th className="px-2 py-1.5 text-right">Qty</th>
                      <th className="px-2 py-1.5 text-right">Total</th>
                      <th className="px-2 py-1.5 text-center">Status</th>
                      <th className="px-2 py-1.5 text-center w-8"><span className="sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.lines.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{l.at ? formatDateTimeAmPm(l.at) : '—'}</td>
                        <td className="px-2 py-1.5 max-w-[240px]"><span className="truncate block">{l.description}</span></td>
                        <td className="px-2 py-1.5 capitalize text-muted-foreground">{catLabel(l.category)}</td>
                        <td className="px-2 py-1.5 text-right">{l.quantity}</td>
                        <td className="px-2 py-1.5 text-right font-medium">{money(l.totalAmount)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase', l.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          {canRemove(l) && (
                            <button
                              type="button"
                              onClick={() => onRemove(l)}
                              disabled={removeCharge.isPending}
                              title="Remove this charge"
                              className="rounded p-1 text-muted-foreground hover:bg-error/10 hover:text-error disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          <p className="text-[11px] text-muted-foreground">
            <span className="text-amber-600">Pending</span> = auto-charges (bed days, doctor fee, lab, imaging, pharmacy) not yet posted — they are billed automatically at discharge.
          </p>
        </div>
      )}
    </div>
  );
}
