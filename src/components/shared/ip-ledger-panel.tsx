'use client';

import { useState } from 'react';
import {
  Plus, Loader2, Receipt, Wallet, Stethoscope, LogIn, LogOut, UserCog,
  FlaskConical, ScanLine, Pill, History,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDateTimeAmPm } from '@/lib/date-utils';
import {
  useAdmissionLedger, useAddIpCharge, useRecordDoctorVisit, useAdmissionActivity,
  type ActivityEvent,
} from '@/hooks/use-ip-ledger';

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
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);

  const reset = () => {
    setCategory(defaultCat); setDescription(''); setQuantity(1); setUnitPrice(0); setTaxRate(0);
  };

  const total = Math.max(0, unitPrice) * Math.max(1, quantity) * (1 + Math.max(0, taxRate) / 100);

  const submit = async () => {
    if (!description.trim()) { toast.error('Enter a description.'); return; }
    if (!(unitPrice > 0)) { toast.error('Enter a unit price.'); return; }
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
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="mt-1 h-8 text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Charge name</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Dressing change, Oxygen (per hour), IV cannula" className="mt-1 h-8 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Unit price (₹)</Label>
              <Input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Tax %</Label>
              <Input type="number" min={0} max={100} step="0.01" value={taxRate} onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} className="mt-1 h-8 text-sm" />
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

function DoctorVisitDialog({
  admissionId, open, onOpenChange,
}: {
  admissionId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const record = useRecordDoctorVisit(admissionId);
  const [review, setReview] = useState('');
  const [fee, setFee] = useState<number>(0);

  const reset = () => { setReview(''); setFee(0); };

  const submit = async () => {
    try {
      await record.mutateAsync({ review: review.trim() || undefined, fee });
      toast.success('Doctor visit recorded.');
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed to record the visit.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /> Record doctor visit</DialogTitle>
          <DialogDescription>
            Log that you saw the patient and note the situation / review. Adds a visit entry to the timeline and the visit fee (if any) to the ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Review / situation</Label>
            <Textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="e.g. Patient stable, afebrile, chest clear. Continue current plan, review tomorrow."
              rows={4}
              className="mt-1 text-sm"
            />
          </div>
          <div className="w-1/2">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Visit fee (₹)</Label>
            <Input type="number" min={0} step="0.01" value={fee} onChange={(e) => setFee(Math.max(0, parseFloat(e.target.value) || 0))} className="mt-1 h-8 text-sm" />
            <p className="mt-1 text-[10px] text-muted-foreground">Leave 0 for a no-charge review round.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={record.isPending}>
            {record.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />} Record visit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------ Activity log

const EVENT_STYLE: Record<ActivityEvent['type'], { icon: typeof Stethoscope; color: string; bg: string }> = {
  admission: { icon: LogIn, color: 'text-emerald-700', bg: 'bg-emerald-100' },
  discharge: { icon: LogOut, color: 'text-slate-700', bg: 'bg-slate-200' },
  doctor_visit: { icon: Stethoscope, color: 'text-primary', bg: 'bg-primary/10' },
  charge: { icon: Receipt, color: 'text-amber-700', bg: 'bg-amber-100' },
  nurse_assignment: { icon: UserCog, color: 'text-blue-700', bg: 'bg-blue-100' },
  lab_order: { icon: FlaskConical, color: 'text-violet-700', bg: 'bg-violet-100' },
  imaging_request: { icon: ScanLine, color: 'text-cyan-700', bg: 'bg-cyan-100' },
  prescription: { icon: Pill, color: 'text-rose-700', bg: 'bg-rose-100' },
};

function ActivityTimeline({ admissionId }: { admissionId: string }) {
  const { data, isLoading } = useAdmissionActivity(admissionId);

  return (
    <div className="mt-4 rounded-xl border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <History className="h-4 w-4 text-primary" />
        Activity Log
        <span className="text-[11px] font-normal text-muted-foreground">— admit to discharge</span>
      </h3>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : !data ? (
        <p className="text-xs text-muted-foreground">Activity log unavailable.</p>
      ) : data.events.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ol className="relative space-y-3 pl-1">
          {data.events.map((e, i) => {
            const s = EVENT_STYLE[e.type] ?? EVENT_STYLE.charge;
            const Icon = s.icon;
            return (
              <li key={i} className="relative flex gap-3">
                {/* connector line */}
                {i < data.events.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-4px)] w-px bg-border" />}
                <span className={cn('z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', s.bg)}>
                  <Icon className={cn('h-3.5 w-3.5', s.color)} />
                </span>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{e.title}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{formatDateTimeAmPm(e.at)}</span>
                  </div>
                  {e.detail && <p className="mt-0.5 text-[11px] text-muted-foreground break-words">{e.detail}</p>}
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {e.actor && <span className="text-[10px] text-muted-foreground">by {e.actor}</span>}
                    {e.status && <Badge variant="outline" className="text-[9px] capitalize">{e.status.replace(/_/g, ' ')}</Badge>}
                    {typeof e.amount === 'number' && e.amount > 0 && <span className="text-[10px] font-medium text-foreground">{money(e.amount)}</span>}
                  </div>
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

export function IpLedgerPanel({ admissionId, role }: { admissionId: string; patientId: string; role: Role }) {
  const { data: ledger, isLoading } = useAdmissionLedger(admissionId);
  const [addOpen, setAddOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const isTpa = ledger?.billingCategory === 'insurance' || ledger?.billingCategory === 'corporate';

  return (
    <div>
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
            {role === 'doctor' && (
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setVisitOpen(true)}>
                <Stethoscope className="h-3 w-3" /> Record visit
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setAddOpen(true)}>
              <Plus className="h-3 w-3" /> Add charge
            </Button>
          </div>
        </div>

        <AddChargeDialog admissionId={admissionId} role={role} open={addOpen} onOpenChange={setAddOpen} />
        <DoctorVisitDialog admissionId={admissionId} open={visitOpen} onOpenChange={setVisitOpen} />

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
                      <th className="px-2 py-1.5">Item</th>
                      <th className="px-2 py-1.5">Category</th>
                      <th className="px-2 py-1.5 text-right">Qty</th>
                      <th className="px-2 py-1.5 text-right">Total</th>
                      <th className="px-2 py-1.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.lines.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="px-2 py-1.5 max-w-[240px]"><span className="truncate block">{l.description}</span></td>
                        <td className="px-2 py-1.5 capitalize text-muted-foreground">{catLabel(l.category)}</td>
                        <td className="px-2 py-1.5 text-right">{l.quantity}</td>
                        <td className="px-2 py-1.5 text-right font-medium">{money(l.totalAmount)}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase', l.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                            {l.status}
                          </span>
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

      {/* Detailed admit-to-discharge activity log (same access as the ledger). */}
      <ActivityTimeline admissionId={admissionId} />
    </div>
  );
}
