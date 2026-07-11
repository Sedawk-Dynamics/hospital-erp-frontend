'use client';

import { useMemo, useState } from 'react';
import { Plus, Loader2, Receipt, Search, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAdmissionLedger, useAddIpCharge } from '@/hooks/use-ip-ledger';
import { useServiceTariffs, type ServiceTariff } from '@/hooks/use-service-tariffs';

type Role = 'doctor' | 'nurse' | 'admin';

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'consultation', label: 'Doctor / consultation' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'room', label: 'Bed / room' },
  { value: 'surgery', label: 'Surgery / OT' },
  { value: 'lab', label: 'Lab' },
  { value: 'radiology', label: 'Imaging' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'other', label: 'Other' },
];
const catLabel = (c: string) => CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c;
const money = (n: number) => `₹${(n ?? 0).toFixed(2)}`;

function AddChargeDialog({
  admissionId, role, open, onOpenChange,
}: {
  admissionId: string;
  role: Role;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const add = useAddIpCharge(admissionId);
  const defaultCat = role === 'doctor' ? 'consultation' : role === 'nurse' ? 'procedure' : 'other';
  const [category, setCategory] = useState(defaultCat);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [serviceTariffId, setServiceTariffId] = useState<string | undefined>(undefined);
  const [tariffSearch, setTariffSearch] = useState('');
  const [showTariffs, setShowTariffs] = useState(false);

  // Catalog of hospital treatment charges (free-text still allowed).
  const { data: tariffResp } = useServiceTariffs({});
  const tariffs = useMemo(() => (tariffResp?.data ?? []).filter((t) => t.isActive !== false), [tariffResp]);
  const filtered = useMemo(() => {
    const q = tariffSearch.trim().toLowerCase();
    if (!q) return tariffs.slice(0, 20);
    return tariffs.filter((t) => t.serviceName.toLowerCase().includes(q)).slice(0, 20);
  }, [tariffs, tariffSearch]);

  const reset = () => {
    setCategory(defaultCat); setDescription(''); setQuantity(1); setUnitPrice(0); setTaxRate(0);
    setServiceTariffId(undefined); setTariffSearch(''); setShowTariffs(false);
  };

  const pickTariff = (t: ServiceTariff) => {
    setDescription(t.serviceName);
    setUnitPrice(Number(t.basePrice) || 0);
    setTaxRate(Number(t.gstRatePercent) || 0);
    setCategory(String(t.category));
    setServiceTariffId(t.id);
    setTariffSearch(''); setShowTariffs(false);
  };

  const total = Math.max(0, unitPrice) * Math.max(1, quantity) * (1 + Math.max(0, taxRate) / 100);

  const submit = async () => {
    if (!description.trim()) { toast.error('Enter a description.'); return; }
    if (!(unitPrice > 0)) { toast.error('Enter a unit price.'); return; }
    try {
      await add.mutateAsync({ category, description: description.trim(), quantity, unitPrice, taxRate, serviceTariffId });
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
            {role === 'doctor' ? 'Record a visit / professional or treatment charge.' : role === 'nurse' ? 'Record a nursing procedure, consumable or bed charge.' : 'Add a charge to the running IP bill.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Pick from the price catalog (optional) */}
          <div className="relative">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Pick from catalog (optional)</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search hospital charges / tariffs..."
                value={tariffSearch}
                onChange={(e) => { setTariffSearch(e.target.value); setShowTariffs(true); }}
                onFocus={() => setShowTariffs(true)}
                className="pl-8 h-8 text-sm"
              />
              {showTariffs && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-44 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                  {filtered.map((t) => (
                    <button key={t.id} type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent" onClick={() => pickTariff(t)}>
                      <span className="flex-1 truncate">{t.serviceName}</span>
                      <Badge variant="outline" className="text-[9px] capitalize">{catLabel(String(t.category))}</Badge>
                      <span className="text-xs font-medium">{money(Number(t.basePrice) || 0)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={(v) => { if (v) { setCategory(v); setServiceTariffId(undefined); } }}>
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
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Description</Label>
            <Input value={description} onChange={(e) => { setDescription(e.target.value); setServiceTariffId(undefined); }} placeholder="e.g. Consultant round visit" className="mt-1 h-8 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Unit price (₹)</Label>
              <Input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => { setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0)); setServiceTariffId(undefined); }} className="mt-1 h-8 text-sm" />
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

export function IpLedgerPanel({ admissionId, role }: { admissionId: string; patientId: string; role: Role }) {
  const { data: ledger, isLoading } = useAdmissionLedger(admissionId);
  const [addOpen, setAddOpen] = useState(false);
  const isTpa = ledger?.billingCategory === 'insurance' || ledger?.billingCategory === 'corporate';

  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sanctuary p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Receipt className="h-4 w-4 text-primary" />
          Billing Ledger
          {ledger && (
            <Badge variant="outline" className="text-[10px] capitalize">{ledger.billingCategory}</Badge>
          )}
        </h2>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3 w-3" /> Add charge
        </Button>
      </div>

      <AddChargeDialog admissionId={admissionId} role={role} open={addOpen} onOpenChange={setAddOpen} />

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
            <div className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50/50 px-3 py-2 text-xs">
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
            <span className="text-amber-600">Pending</span> = auto-charges (bed days, doctor fee, lab, imaging) not yet posted — they are billed automatically at discharge.
          </p>
        </div>
      )}
    </div>
  );
}
